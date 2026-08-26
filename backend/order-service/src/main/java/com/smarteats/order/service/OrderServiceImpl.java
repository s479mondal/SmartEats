package com.smarteats.order.service;

import com.smarteats.common.exception.BadRequestException;
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

    @Value("${kafka.topic.order-created:smarteats.order.created}")
    private String orderCreatedTopic;

    @Value("${kafka.topic.order-status:smarteats.order.status}")
    private String orderStatusTopic;

    private static final String CART_KEY_PREFIX = "cart:";

    // Constructor injection
    public OrderServiceImpl(OrderRepository orderRepository,
                            RedisTemplate<String, Object> redisTemplate,
                            org.springframework.kafka.core.KafkaTemplate<String, Object> kafkaTemplate) {
        this.orderRepository = orderRepository;
        this.redisTemplate = redisTemplate;
        this.kafkaTemplate = kafkaTemplate;
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

        double totalAmount = cart.getItems().stream()
                .mapToDouble(item -> item.getPrice() * item.getQuantity())
                .sum();

        Order order = Order.builder()
                .customerEmail(userEmail)
                .restaurantId(cart.getRestaurantId())
                .items(cart.getItems())
                .totalAmount(totalAmount)
                .status(OrderStatus.CREATED)
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

        // Simple validation: customer can cancel order before restaurant accepts it, restaurant owners can manage preparation
        if (newStatus == OrderStatus.CANCELLED && !order.getCustomerEmail().equals(userEmail) && !roles.contains("ADMIN") && !roles.contains("RESTAURANT_OWNER")) {
            throw new UnauthorizedException("You are not authorized to cancel this order!");
        }

        order.setStatus(newStatus);
        Order savedOrder = orderRepository.save(order);
        log.info("Order {} status updated to {}", orderId, newStatus);

        // If restaurant accepts the order, publish event to Kafka
        if (newStatus == OrderStatus.ACCEPTED) {
            kafkaTemplate.send(orderStatusTopic, orderId, savedOrder.getId());
            log.info("Published RestaurantAccepted event to Kafka for order ID: {}", orderId);
        }

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
                .createdAt(order.getCreatedAt())
                .build();
    }
}
