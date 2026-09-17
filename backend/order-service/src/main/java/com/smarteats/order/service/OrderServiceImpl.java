package com.smarteats.order.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.ResourceNotFoundException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.order.dto.CartDto;
import com.smarteats.order.dto.CartItemRequest;
import com.smarteats.order.dto.OrderCreatedEvent;
import com.smarteats.order.dto.OrderResponse;
import com.smarteats.order.entity.CartItem;
import com.smarteats.order.entity.Order;
import com.smarteats.order.entity.OrderStatus;
import com.smarteats.order.repository.OrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    private final org.springframework.kafka.core.KafkaTemplate<String, Object> kafkaTemplate;
    private final com.smarteats.order.client.AuthServiceClient authServiceClient;
    private final com.smarteats.order.client.RestaurantServiceClient restaurantServiceClient;

    @Value("${kafka.topic.order-created:smarteats.order.created}")
    private String orderCreatedTopic;

    @Value("${kafka.topic.order-status:smarteats.order.status}")
    private String orderStatusTopic;

    private static final String CART_KEY_PREFIX = "cart:";

    // Constructor injection
    public OrderServiceImpl(OrderRepository orderRepository,
                            RedisTemplate<String, Object> redisTemplate,
                            org.springframework.kafka.core.KafkaTemplate<String, Object> kafkaTemplate,
                            com.smarteats.order.client.AuthServiceClient authServiceClient,
                            com.smarteats.order.client.RestaurantServiceClient restaurantServiceClient) {
        this.orderRepository = orderRepository;
        this.redisTemplate = redisTemplate;
        this.kafkaTemplate = kafkaTemplate;
        this.authServiceClient = authServiceClient;
        this.restaurantServiceClient = restaurantServiceClient;
    }

    private String getCartKey(String email) {
        return CART_KEY_PREFIX + email;
    }

    @Override
    public CartDto addItemToCart(String userEmail, String restaurantId, CartItemRequest request) {
        String key = getCartKey(userEmail);
        CartDto cart = (CartDto) redisTemplate.opsForValue().get(key);

        if (cart == null) {
            cart = CartDto.builder()
                    .userEmail(userEmail)
                    .restaurantId(restaurantId)
                    .items(new ArrayList<>())
                    .build();
        } else if (!cart.getRestaurantId().equals(restaurantId)) {
            // Cart cannot contain items from multiple restaurants
            throw new BadRequestException("Your cart already contains items from another restaurant. Please clear it first.");
        }

        // Add or update item
        List<CartItem> items = cart.getItems();
        boolean itemExists = false;
        for (CartItem item : items) {
            if (item.getMenuItemId().equals(request.getMenuItemId())) {
                item.setQuantity(item.getQuantity() + request.getQuantity());
                itemExists = true;
                break;
            }
        }

        if (!itemExists) {
            items.add(CartItem.builder()
                    .menuItemId(request.getMenuItemId())
                    .name(request.getName())
                    .quantity(request.getQuantity())
                    .price(request.getPrice())
                    .build());
        }

        redisTemplate.opsForValue().set(key, cart);
        log.info("Item added to cart in Redis for user {}", userEmail);
        return cart;
    }

    @Override
    public CartDto getCart(String userEmail) {
        String key = getCartKey(userEmail);
        CartDto cart = (CartDto) redisTemplate.opsForValue().get(key);
        if (cart == null) {
            return CartDto.builder()
                    .userEmail(userEmail)
                    .restaurantId("")
                    .items(new ArrayList<>())
                    .build();
        }
        return cart;
    }

    @Override
    public void clearCart(String userEmail) {
        String key = getCartKey(userEmail);
        redisTemplate.delete(key);
        log.info("Cart cleared in Redis for user {}", userEmail);
    }

    @Override
    public OrderResponse placeOrder(String userEmail) {
        CartDto cart = getCart(userEmail);
        if (cart.getItems().isEmpty()) {
            throw new BadRequestException("Cannot place order. Shopping cart is empty!");
        }

        // Authoritatively validate that restaurant is currently open
        boolean isOpen = restaurantServiceClient.isRestaurantOpen(cart.getRestaurantId());
        if (!isOpen) {
            log.warn("Attempted order placement rejected: Restaurant {} is currently closed", cart.getRestaurantId());
            throw new BadRequestException("Restaurant is currently closed for orders.");
        }

        double totalAmount = cart.getItems().stream()
                .mapToDouble(item -> item.getPrice() * item.getQuantity())
                .sum();

        // Authoritatively fetch customer's stored coordinates from auth-service
        com.smarteats.order.client.CustomerCoordinates customerCoords = authServiceClient.getCustomerCoordinates(userEmail);

        Order order = Order.builder()
                .customerEmail(userEmail)
                .restaurantId(cart.getRestaurantId())
                .items(cart.getItems())
                .totalAmount(totalAmount)
                .status(OrderStatus.CREATED)
                .deliveryLatitude(customerCoords.getLatitude())
                .deliveryLongitude(customerCoords.getLongitude())
                .build();

        Order savedOrder = orderRepository.save(order);
        log.info("Order placed successfully in DB with ID: {}", savedOrder.getId());

        // Clear cart in Redis
        clearCart(userEmail);

        // Publish OrderCreated event to Kafka
        OrderCreatedEvent event = OrderCreatedEvent.builder()
                .orderId(savedOrder.getId())
                .customerEmail(savedOrder.getCustomerEmail())
                .restaurantId(savedOrder.getRestaurantId())
                .totalAmount(savedOrder.getTotalAmount())
                .items(savedOrder.getItems())
                .build();

        kafkaTemplate.send(orderCreatedTopic, savedOrder.getId(), event);
        log.info("Published OrderCreated event to Kafka for order ID: {}", savedOrder.getId());

        return mapToResponse(savedOrder);
    }

    @Override
    public OrderResponse getOrderById(String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with ID: " + orderId));
        return mapToResponse(order);
    }

    @Override
    public OrderResponse getOrderById(String orderId, String userEmail, String roles) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with ID: " + orderId));

        boolean isAdmin = roles != null && (roles.contains("ADMIN") || roles.contains("ROLE_ADMIN"));
        boolean isOwner = userEmail != null && userEmail.equalsIgnoreCase(order.getCustomerEmail());

        if (!isAdmin && !isOwner) {
            log.warn("Access Denied (IDOR Prevention): User '{}' with roles '{}' attempted to access order '{}' owned by '{}'",
                    userEmail, roles, orderId, order.getCustomerEmail());
            throw new ForbiddenException("Access Denied: You do not have permission to view this order");
        }

        return mapToResponse(order);
    }

    @Override
    public List<OrderResponse> getOrdersForCustomer(String userEmail) {
        return orderRepository.findByCustomerEmail(userEmail).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public List<OrderResponse> getOrdersForRestaurant(String restaurantId, String ownerEmail) {
        // In a real microservice, we might verify with restaurant-service if ownerEmail owns the restaurantId.
        // For foundation purposes, we retrieve the orders directly.
        return orderRepository.findByRestaurantId(restaurantId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Value("${kafka.topic.order-accepted:smarteats.order.accepted}")
    private String orderAcceptedTopic;

    @Value("${kafka.topic.order-ready:smarteats.order.ready}")
    private String orderReadyTopic;

    @Override
    public List<OrderResponse> getMyRestaurantOrders(String ownerEmail) {
        log.info("Fetching orders for restaurant owner {}", ownerEmail);
        return orderRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public OrderResponse getMyRestaurantOrderById(String orderId, String ownerEmail) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with ID: " + orderId));
        return mapToResponse(order);
    }

    @Override
    public OrderResponse acceptOrder(String orderId, String ownerEmail) {
        return transitionOrderStatus(orderId, OrderStatus.ACCEPTED, ownerEmail);
    }

    @Override
    public OrderResponse rejectOrder(String orderId, String ownerEmail) {
        return transitionOrderStatus(orderId, OrderStatus.REJECTED, ownerEmail);
    }

    @Override
    public OrderResponse preparingOrder(String orderId, String ownerEmail) {
        return transitionOrderStatus(orderId, OrderStatus.PREPARING, ownerEmail);
    }

    @Override
    public OrderResponse readyOrder(String orderId, String ownerEmail) {
        return transitionOrderStatus(orderId, OrderStatus.READY, ownerEmail);
    }

    private OrderResponse transitionOrderStatus(String orderId, OrderStatus targetStatus, String ownerEmail) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with ID: " + orderId));

        OrderStatus currentStatus = order.getStatus();
        validateStateTransition(currentStatus, targetStatus);

        order.setStatus(targetStatus);
        Order savedOrder = orderRepository.save(order);
        log.info("Order {} status transitioned from {} to {} by {}", orderId, currentStatus, targetStatus, ownerEmail);

        // Kafka Event Publishing based on transition
        if (targetStatus == OrderStatus.ACCEPTED) {
            // Retrieve authoritative restaurant coordinates from restaurant-service
            com.smarteats.order.client.RestaurantCoordinates restCoords = restaurantServiceClient.getRestaurantCoordinates(savedOrder.getRestaurantId());

            // Validate that order has valid delivery coordinates
            if (savedOrder.getDeliveryLatitude() == null || savedOrder.getDeliveryLongitude() == null ||
                    (savedOrder.getDeliveryLatitude() == 0.0 && savedOrder.getDeliveryLongitude() == 0.0)) {
                log.error("Order {} cannot be accepted because delivery coordinates are missing", orderId);
                throw new BadRequestException("Order cannot be accepted: Missing delivery location coordinates for order ID: " + orderId);
            }

            com.smarteats.common.event.OrderAcceptedEvent event = com.smarteats.common.event.OrderAcceptedEvent.builder()
                    .orderId(savedOrder.getId())
                    .restaurantId(savedOrder.getRestaurantId())
                    .customerEmail(savedOrder.getCustomerEmail())
                    .totalAmount(savedOrder.getTotalAmount())
                    .restaurantLatitude(restCoords.getLatitude())
                    .restaurantLongitude(restCoords.getLongitude())
                    .deliveryLatitude(savedOrder.getDeliveryLatitude())
                    .deliveryLongitude(savedOrder.getDeliveryLongitude())
                    .createdAt(savedOrder.getCreatedAt() != null ? savedOrder.getCreatedAt().toString() : java.time.LocalDateTime.now().toString())
                    .build();
            kafkaTemplate.send(orderAcceptedTopic, orderId, event);
            log.info("Published OrderAcceptedEvent to Kafka topic '{}' with real coordinates for order ID {}: rest=[{}, {}], del=[{}, {}]",
                    orderAcceptedTopic, orderId, restCoords.getLatitude(), restCoords.getLongitude(),
                    savedOrder.getDeliveryLatitude(), savedOrder.getDeliveryLongitude());
        } else if (targetStatus == OrderStatus.READY) {
            kafkaTemplate.send(orderReadyTopic, orderId, mapToResponse(savedOrder));
            log.info("Published OrderReady event to Kafka topic '{}' for order ID: {}", orderReadyTopic, orderId);
        }

        return mapToResponse(savedOrder);
    }

    private void validateStateTransition(OrderStatus current, OrderStatus next) {
        if (current == OrderStatus.CREATED || current == OrderStatus.NEW) {
            if (next != OrderStatus.ACCEPTED && next != OrderStatus.REJECTED && next != OrderStatus.CANCELLED) {
                throw new BadRequestException("Invalid state transition: Cannot change status from " + current + " to " + next + ". Expected ACCEPTED or REJECTED.");
            }
        } else if (current == OrderStatus.ACCEPTED) {
            if (next != OrderStatus.PREPARING && next != OrderStatus.CANCELLED) {
                throw new BadRequestException("Invalid state transition: Cannot change status from " + current + " to " + next + ". Expected PREPARING.");
            }
        } else if (current == OrderStatus.PREPARING) {
            if (next != OrderStatus.READY && next != OrderStatus.CANCELLED) {
                throw new BadRequestException("Invalid state transition: Cannot change status from " + current + " to " + next + ". Expected READY.");
            }
        } else if (current == OrderStatus.READY) {
            if (next != OrderStatus.DISPATCHED && next != OrderStatus.DELIVERED) {
                throw new BadRequestException("Invalid state transition: Order is already READY.");
            }
        } else if (current == OrderStatus.DISPATCHED) {
            if (next != OrderStatus.DELIVERED) {
                throw new BadRequestException("Invalid state transition: Cannot change status from DISPATCHED to " + next);
            }
        } else if (current == OrderStatus.REJECTED || current == OrderStatus.CANCELLED) {
            throw new BadRequestException("Invalid state transition: Cannot modify order in terminal state " + current);
        }
    }

    @Override
    public OrderResponse updateOrderStatus(String orderId, String status, String userEmail, String roles) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with ID: " + orderId));

        OrderStatus newStatus;
        try {
            newStatus = OrderStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid Order Status: " + status);
        }

        validateStateTransition(order.getStatus(), newStatus);

        order.setStatus(newStatus);
        Order savedOrder = orderRepository.save(order);
        log.info("Order {} status updated to {}", orderId, newStatus);
        return mapToResponse(savedOrder);
    }

    private OrderResponse mapToResponse(Order order) {
        return OrderResponse.builder()
                .id(order.getId())
                .customerEmail(order.getCustomerEmail())
                .restaurantId(order.getRestaurantId())
                .items(order.getItems())
                .totalAmount(order.getTotalAmount())
                .status(order.getStatus())
                .deliveryLatitude(order.getDeliveryLatitude())
                .deliveryLongitude(order.getDeliveryLongitude())
                .createdAt(order.getCreatedAt())
                .build();
    }
}
