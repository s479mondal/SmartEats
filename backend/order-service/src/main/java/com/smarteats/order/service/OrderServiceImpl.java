package com.smarteats.order.service;

import com.smarteats.common.enums.PaymentStatus;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.ResourceNotFoundException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.order.dto.CartDto;
import com.smarteats.order.dto.CartItemRequest;
import com.smarteats.order.dto.OrderCreatedEvent;
import com.smarteats.order.dto.OrderResponse;
import com.smarteats.order.dto.PaymentOrderResponse;
import com.smarteats.order.dto.PaymentVerifyRequest;
import com.smarteats.order.dto.PaymentVerifyResponse;
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
    private final com.smarteats.order.client.RazorpayClientWrapper razorpayClientWrapper;

    @Value("${kafka.topic.order-created:smarteats.order.created}")
    private String orderCreatedTopic;

    @Value("${kafka.topic.order-status:smarteats.order.status}")
    private String orderStatusTopic;

    @Value("${payment.pending-expiry-minutes:15}")
    private int pendingExpiryMinutes;

    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    private static final String CART_KEY_PREFIX = "cart:";

    // Constructor injection
    public OrderServiceImpl(OrderRepository orderRepository,
                            RedisTemplate<String, Object> redisTemplate,
                            org.springframework.kafka.core.KafkaTemplate<String, Object> kafkaTemplate,
                            com.smarteats.order.client.AuthServiceClient authServiceClient,
                            com.smarteats.order.client.RestaurantServiceClient restaurantServiceClient,
                            com.smarteats.order.client.RazorpayClientWrapper razorpayClientWrapper) {
        this.orderRepository = orderRepository;
        this.redisTemplate = redisTemplate;
        this.kafkaTemplate = kafkaTemplate;
        this.authServiceClient = authServiceClient;
        this.restaurantServiceClient = restaurantServiceClient;
        this.razorpayClientWrapper = razorpayClientWrapper;
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
        return placeCodOrder(userEmail, null);
    }

    @Override
    public OrderResponse placeOrder(String userEmail, String idempotencyKey) {
        return placeCodOrder(userEmail, idempotencyKey);
    }

    @Override
    public OrderResponse placeCodOrder(String userEmail) {
        return placeCodOrder(userEmail, null);
    }

    @Override
    public OrderResponse placeCodOrder(String userEmail, String idempotencyKey) {
        // 1. Idempotency lookup if key is provided
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Order existingOrder = orderRepository.findFirstByIdempotencyKey(idempotencyKey).orElse(null);
            if (existingOrder != null) {
                // IDOR ownership check
                if (!userEmail.equalsIgnoreCase(existingOrder.getCustomerEmail())) {
                    log.warn("IDOR violation: User {} attempted to reuse idempotency key {} owned by {}",
                            userEmail, idempotencyKey, existingOrder.getCustomerEmail());
                    throw new ForbiddenException("Access Denied: Idempotency key belongs to another customer");
                }
                // Check payment method mismatch
                if ("RAZORPAY".equalsIgnoreCase(existingOrder.getPaymentMethod()) || existingOrder.getRazorpayOrderId() != null) {
                    log.warn("Idempotency conflict: Key {} was originally used for RAZORPAY order {}", idempotencyKey, existingOrder.getId());
                    throw new BadRequestException("Idempotency key mismatch: Key was originally used for an Online / Razorpay payment order");
                }
                log.info("Idempotent COD checkout replay for key {}: Returning existing order {}", idempotencyKey, existingOrder.getId());
                return mapToResponse(existingOrder);
            }
        }

        CartDto cart = getCart(userEmail);
        if (cart.getItems() == null || cart.getItems().isEmpty()) {
            throw new BadRequestException("Cannot place order. Shopping cart is empty!");
        }

        // Authoritatively validate that restaurant is currently open
        boolean isOpen = restaurantServiceClient.isRestaurantOpen(cart.getRestaurantId());
        if (!isOpen) {
            log.warn("Attempted COD order placement rejected: Restaurant {} is currently closed", cart.getRestaurantId());
            throw new BadRequestException("Restaurant is currently closed for orders.");
        }

        // Authoritatively reserve portion inventory on restaurant-service
        List<com.smarteats.order.dto.InventoryItemRequest> reservationRequests = cart.getItems().stream()
                .map(item -> new com.smarteats.order.dto.InventoryItemRequest(item.getMenuItemId(), item.getQuantity()))
                .collect(Collectors.toList());

        boolean inventoryReserved = restaurantServiceClient.reserveInventory(cart.getRestaurantId(), reservationRequests);
        if (!inventoryReserved) {
            log.warn("COD order checkout aborted: Insufficient inventory in restaurant {} for customer {}",
                    cart.getRestaurantId(), userEmail);
            throw new BadRequestException("One or more items are no longer available in the requested quantity.");
        }

        double totalAmount = cart.getItems().stream()
                .mapToDouble(item -> item.getPrice() * item.getQuantity())
                .sum();

        // Authoritatively fetch customer's stored coordinates from auth-service
        com.smarteats.order.client.CustomerCoordinates customerCoords = authServiceClient.getCustomerCoordinates(userEmail);

        String effectiveIdempotencyKey = (idempotencyKey != null && !idempotencyKey.isBlank())
                ? idempotencyKey
                : java.util.UUID.randomUUID().toString();

        Order order = Order.builder()
                .idempotencyKey(effectiveIdempotencyKey)
                .customerEmail(userEmail)
                .restaurantId(cart.getRestaurantId())
                .items(cart.getItems())
                .totalAmount(totalAmount)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("COD")
                .razorpayOrderId(null)
                .razorpayPaymentId(null)
                .razorpaySignature(null)
                .paymentTime(null)
                .deliveryLatitude(customerCoords != null ? customerCoords.getLatitude() : null)
                .deliveryLongitude(customerCoords != null ? customerCoords.getLongitude() : null)
                .build();

        Order savedOrder;
        try {
            savedOrder = orderRepository.save(order);
            log.info("COD Order placed successfully in DB with ID: {} and idempotency key: {}", savedOrder.getId(), effectiveIdempotencyKey);
        } catch (org.springframework.dao.DuplicateKeyException | com.mongodb.DuplicateKeyException ex) {
            // Concurrent race condition: Another thread won the write race with the same idempotency key
            log.warn("DuplicateKeyException caught on COD order save for key {}. Releasing inventory compensation and retrieving winning order.", effectiveIdempotencyKey);
            try {
                restaurantServiceClient.releaseInventory(cart.getRestaurantId(), reservationRequests);
            } catch (Exception releaseEx) {
                log.error("CRITICAL: Failed to release inventory on duplicate key compensation: {}", releaseEx.getMessage());
            }
            savedOrder = orderRepository.findFirstByIdempotencyKey(effectiveIdempotencyKey)
                    .orElseThrow(() -> new BadRequestException("Failed to process order due to concurrent conflict"));
            return mapToResponse(savedOrder);
        } catch (Exception ex) {
            log.error("Failed to persist COD order to database after inventory reservation. Initiating compensation rollback: {}", ex.getMessage());
            try {
                restaurantServiceClient.releaseInventory(cart.getRestaurantId(), reservationRequests);
            } catch (Exception releaseEx) {
                log.error("CRITICAL: Failed to release inventory during compensation rollback: {}", releaseEx.getMessage());
            }
            throw ex;
        }

        // Clear cart in Redis
        clearCart(userEmail);

        // Publish OrderCreated event to Kafka
        try {
            OrderCreatedEvent event = OrderCreatedEvent.builder()
                    .orderId(savedOrder.getId())
                    .customerEmail(savedOrder.getCustomerEmail())
                    .restaurantId(savedOrder.getRestaurantId())
                    .totalAmount(savedOrder.getTotalAmount())
                    .items(savedOrder.getItems())
                    .build();

            kafkaTemplate.send(orderCreatedTopic, savedOrder.getId(), event);
            log.info("Published OrderCreated event to Kafka for COD order ID: {}", savedOrder.getId());
        } catch (Exception kafkaEx) {
            log.warn("Non-fatal note: Kafka publish for COD order ID {} encountered: {}", savedOrder.getId(), kafkaEx.getMessage());
        }

        return mapToResponse(savedOrder);
    }

    @Override
    public PaymentOrderResponse createPaymentOrder(String userEmail) {
        return createPaymentOrder(userEmail, null);
    }

    @Override
    public PaymentOrderResponse createPaymentOrder(String userEmail, String idempotencyKey) {
        // 1. Idempotency lookup if key is provided
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Order existingOrder = orderRepository.findFirstByIdempotencyKey(idempotencyKey).orElse(null);
            if (existingOrder != null) {
                // IDOR ownership check
                if (!userEmail.equalsIgnoreCase(existingOrder.getCustomerEmail())) {
                    log.warn("IDOR violation: User {} attempted to reuse idempotency key {} owned by {}",
                            userEmail, idempotencyKey, existingOrder.getCustomerEmail());
                    throw new ForbiddenException("Access Denied: Idempotency key belongs to another customer");
                }
                // Check payment method mismatch
                if ("COD".equalsIgnoreCase(existingOrder.getPaymentMethod())) {
                    log.warn("Idempotency conflict: Key {} was originally used for COD order {}", idempotencyKey, existingOrder.getId());
                    throw new BadRequestException("Idempotency key mismatch: Key was originally used for a Cash on Delivery (COD) order");
                }
                if (existingOrder.getRazorpayOrderId() != null && !existingOrder.getRazorpayOrderId().isBlank()) {
                    log.info("Idempotent Razorpay create-order replay for key {}: Returning existing order {} with Razorpay ID {}",
                            idempotencyKey, existingOrder.getId(), existingOrder.getRazorpayOrderId());
                    long amountInPaise = Math.round(existingOrder.getTotalAmount() * 100);
                    return PaymentOrderResponse.builder()
                            .success(true)
                            .orderId(existingOrder.getId())
                            .razorpayOrderId(existingOrder.getRazorpayOrderId())
                            .amount(existingOrder.getTotalAmount())
                            .amountInPaise(amountInPaise)
                            .currency("INR")
                            .keyId(razorpayClientWrapper.getKeyId())
                            .customerEmail(existingOrder.getCustomerEmail())
                            .restaurantId(existingOrder.getRestaurantId())
                            .idempotencyKey(existingOrder.getIdempotencyKey())
                            .message("Payment order retrieved successfully (idempotent replay)")
                            .build();
                } else {
                    // Check if an in-flight winning thread is currently creating the Razorpay order
                    for (int i = 0; i < 25; i++) {
                        try {
                            Thread.sleep(100);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                        existingOrder = orderRepository.findFirstByIdempotencyKey(idempotencyKey).orElse(existingOrder);
                        if (existingOrder.getRazorpayOrderId() != null && !existingOrder.getRazorpayOrderId().isBlank()) {
                            break;
                        }
                    }

                    if (existingOrder.getRazorpayOrderId() != null && !existingOrder.getRazorpayOrderId().isBlank()) {
                        long amountInPaise = Math.round(existingOrder.getTotalAmount() * 100);
                        return PaymentOrderResponse.builder()
                                .success(true)
                                .orderId(existingOrder.getId())
                                .razorpayOrderId(existingOrder.getRazorpayOrderId())
                                .amount(existingOrder.getTotalAmount())
                                .amountInPaise(amountInPaise)
                                .currency("INR")
                                .keyId(razorpayClientWrapper.getKeyId())
                                .customerEmail(existingOrder.getCustomerEmail())
                                .restaurantId(existingOrder.getRestaurantId())
                                .idempotencyKey(existingOrder.getIdempotencyKey())
                                .message("Payment order retrieved successfully (idempotent replay)")
                                .build();
                    }

                    // Order exists but Razorpay order was not yet generated (e.g. prior crash)
                    String razorpayOrderId;
                    try {
                        razorpayOrderId = razorpayClientWrapper.createRazorpayOrder(existingOrder.getId(), existingOrder.getTotalAmount(), userEmail);
                        existingOrder.setRazorpayOrderId(razorpayOrderId);
                        existingOrder = orderRepository.save(existingOrder);
                    } catch (Exception ex) {
                        throw new BadRequestException("Failed to initiate payment with Razorpay: " + ex.getMessage());
                    }
                    long amountInPaise = Math.round(existingOrder.getTotalAmount() * 100);
                    return PaymentOrderResponse.builder()
                            .success(true)
                            .orderId(existingOrder.getId())
                            .razorpayOrderId(razorpayOrderId)
                            .amount(existingOrder.getTotalAmount())
                            .amountInPaise(amountInPaise)
                            .currency("INR")
                            .keyId(razorpayClientWrapper.getKeyId())
                            .customerEmail(existingOrder.getCustomerEmail())
                            .restaurantId(existingOrder.getRestaurantId())
                            .idempotencyKey(existingOrder.getIdempotencyKey())
                            .message("Payment order created successfully")
                            .build();
                }
            }
        }

        CartDto cart = getCart(userEmail);
        if (cart.getItems() == null || cart.getItems().isEmpty()) {
            throw new BadRequestException("Cannot place order. Shopping cart is empty!");
        }

        // Authoritatively validate that restaurant is currently open
        boolean isOpen = restaurantServiceClient.isRestaurantOpen(cart.getRestaurantId());
        if (!isOpen) {
            log.warn("Attempted payment order creation rejected: Restaurant {} is currently closed", cart.getRestaurantId());
            throw new BadRequestException("Restaurant is currently closed for orders.");
        }

        // Authoritatively reserve portion inventory on restaurant-service
        List<com.smarteats.order.dto.InventoryItemRequest> reservationRequests = cart.getItems().stream()
                .map(item -> new com.smarteats.order.dto.InventoryItemRequest(item.getMenuItemId(), item.getQuantity()))
                .collect(Collectors.toList());

        boolean inventoryReserved = restaurantServiceClient.reserveInventory(cart.getRestaurantId(), reservationRequests);
        if (!inventoryReserved) {
            log.warn("Payment order creation aborted: Insufficient inventory in restaurant {} for customer {}",
                    cart.getRestaurantId(), userEmail);
            throw new BadRequestException("One or more items are no longer available in the requested quantity.");
        }

        double totalAmount = cart.getItems().stream()
                .mapToDouble(item -> item.getPrice() * item.getQuantity())
                .sum();

        // Authoritatively fetch customer's stored coordinates from auth-service
        com.smarteats.order.client.CustomerCoordinates customerCoords = authServiceClient.getCustomerCoordinates(userEmail);

        String effectiveIdempotencyKey = (idempotencyKey != null && !idempotencyKey.isBlank())
                ? idempotencyKey
                : java.util.UUID.randomUUID().toString();

        Order order = Order.builder()
                .idempotencyKey(effectiveIdempotencyKey)
                .customerEmail(userEmail)
                .restaurantId(cart.getRestaurantId())
                .items(cart.getItems())
                .totalAmount(totalAmount)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("RAZORPAY")
                .deliveryLatitude(customerCoords != null ? customerCoords.getLatitude() : null)
                .deliveryLongitude(customerCoords != null ? customerCoords.getLongitude() : null)
                .build();

        Order savedOrder = null;
        try {
            savedOrder = orderRepository.save(order);
            log.info("Pending payment order created in DB with ID: {} and idempotency key: {}", savedOrder.getId(), effectiveIdempotencyKey);
        } catch (org.springframework.dao.DuplicateKeyException | com.mongodb.DuplicateKeyException ex) {
            // Concurrent race: Another thread saved with same idempotency key
            log.warn("DuplicateKeyException caught on payment order save for key {}. Releasing inventory compensation and retrieving winning order.", effectiveIdempotencyKey);
            try {
                restaurantServiceClient.releaseInventory(cart.getRestaurantId(), reservationRequests);
            } catch (Exception releaseEx) {
                log.error("CRITICAL: Failed to release inventory on duplicate key compensation: {}", releaseEx.getMessage());
            }

            // Wait for winning thread to finish populating razorpayOrderId
            for (int i = 0; i < 30; i++) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
                savedOrder = orderRepository.findFirstByIdempotencyKey(effectiveIdempotencyKey).orElse(null);
                if (savedOrder != null && savedOrder.getRazorpayOrderId() != null && !savedOrder.getRazorpayOrderId().isBlank()) {
                    long amountInPaise = Math.round(savedOrder.getTotalAmount() * 100);
                    return PaymentOrderResponse.builder()
                            .success(true)
                            .orderId(savedOrder.getId())
                            .razorpayOrderId(savedOrder.getRazorpayOrderId())
                            .amount(savedOrder.getTotalAmount())
                            .amountInPaise(amountInPaise)
                            .currency("INR")
                            .keyId(razorpayClientWrapper.getKeyId())
                            .customerEmail(savedOrder.getCustomerEmail())
                            .restaurantId(savedOrder.getRestaurantId())
                            .idempotencyKey(savedOrder.getIdempotencyKey())
                            .message("Payment order retrieved successfully (concurrent replay)")
                            .build();
                }
            }

            if (savedOrder == null) {
                savedOrder = orderRepository.findFirstByIdempotencyKey(effectiveIdempotencyKey)
                        .orElseThrow(() -> new BadRequestException("Failed to process payment order due to concurrent conflict"));
            }
            
            if (savedOrder.getRazorpayOrderId() != null && !savedOrder.getRazorpayOrderId().isBlank()) {
                long amountInPaise = Math.round(savedOrder.getTotalAmount() * 100);
                return PaymentOrderResponse.builder()
                        .success(true)
                        .orderId(savedOrder.getId())
                        .razorpayOrderId(savedOrder.getRazorpayOrderId())
                        .amount(savedOrder.getTotalAmount())
                        .amountInPaise(amountInPaise)
                        .currency("INR")
                        .keyId(razorpayClientWrapper.getKeyId())
                        .customerEmail(savedOrder.getCustomerEmail())
                        .restaurantId(savedOrder.getRestaurantId())
                        .idempotencyKey(savedOrder.getIdempotencyKey())
                        .message("Payment order retrieved successfully (concurrent replay)")
                        .build();
            }
        } catch (Exception ex) {
            log.error("Failed to persist order to database after inventory reservation. Initiating compensation rollback: {}", ex.getMessage());
            try {
                restaurantServiceClient.releaseInventory(cart.getRestaurantId(), reservationRequests);
            } catch (Exception releaseEx) {
                log.error("CRITICAL: Failed to release inventory during compensation rollback: {}", releaseEx.getMessage());
            }
            throw ex;
        }

        // Create Razorpay Order via SDK / Client wrapper if not already present
        String razorpayOrderId = savedOrder.getRazorpayOrderId();
        if (razorpayOrderId == null || razorpayOrderId.isBlank()) {
            try {
                razorpayOrderId = razorpayClientWrapper.createRazorpayOrder(savedOrder.getId(), savedOrder.getTotalAmount(), userEmail);
                savedOrder.setRazorpayOrderId(razorpayOrderId);
                savedOrder = orderRepository.save(savedOrder);
                log.info("Razorpay order created with ID: {} for SmartEats order: {}", razorpayOrderId, savedOrder.getId());
            } catch (Exception ex) {
                log.error("Failed to create Razorpay order for order ID {}. Releasing inventory compensation: {}", savedOrder.getId(), ex.getMessage());
                try {
                    restaurantServiceClient.releaseInventory(cart.getRestaurantId(), reservationRequests);
                } catch (Exception releaseEx) {
                    log.error("CRITICAL: Failed to release inventory after Razorpay creation error: {}", releaseEx.getMessage());
                }
                savedOrder.setStatus(OrderStatus.CANCELLED);
                savedOrder.setPaymentStatus(PaymentStatus.FAILED);
                try {
                    orderRepository.save(savedOrder);
                } catch (Exception ignore) {}
                throw new BadRequestException("Failed to initiate payment with Razorpay: " + ex.getMessage());
            }
        }

        long amountInPaise = Math.round(savedOrder.getTotalAmount() * 100);
        return PaymentOrderResponse.builder()
                .success(true)
                .orderId(savedOrder.getId())
                .razorpayOrderId(razorpayOrderId)
                .amount(savedOrder.getTotalAmount())
                .amountInPaise(amountInPaise)
                .currency("INR")
                .keyId(razorpayClientWrapper.getKeyId())
                .customerEmail(savedOrder.getCustomerEmail())
                .restaurantId(savedOrder.getRestaurantId())
                .idempotencyKey(savedOrder.getIdempotencyKey())
                .message("Payment order created successfully")
                .build();
    }

    @Override
    public PaymentVerifyResponse verifyPayment(String userEmail, PaymentVerifyRequest request) {
        if (request == null || request.getOrderId() == null || request.getOrderId().isBlank()) {
            throw new BadRequestException("Invalid payment verification request: orderId is required");
        }

        Order order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with ID: " + request.getOrderId()));

        // IDOR / Ownership validation: Verify order belongs to the authenticated customer
        if (userEmail == null || !userEmail.equalsIgnoreCase(order.getCustomerEmail())) {
            log.warn("Access Denied (IDOR Prevention): User '{}' attempted to verify payment for order '{}' owned by '{}'",
                    userEmail, request.getOrderId(), order.getCustomerEmail());
            throw new ForbiddenException("Access Denied: You do not have permission to verify payment for this order");
        }

        // Razorpay Order ID validation: Ensure supplied razorpayOrderId matches stored order
        if (order.getRazorpayOrderId() == null || !order.getRazorpayOrderId().equals(request.getRazorpayOrderId())) {
            log.warn("Payment verification rejected: Razorpay order ID mismatch. Expected '{}', got '{}' for order '{}'",
                    order.getRazorpayOrderId(), request.getRazorpayOrderId(), order.getId());
            throw new BadRequestException("Invalid payment verification: Razorpay order ID mismatch");
        }

        // Idempotency: If already verified and PAID, return idempotent success without duplicate processing
        if (order.getStatus() == OrderStatus.CREATED && order.getPaymentStatus() == PaymentStatus.PAID) {
            log.info("Payment already verified for order ID: {}. Returning idempotent response.", order.getId());
            return PaymentVerifyResponse.builder()
                    .success(true)
                    .orderId(order.getId())
                    .paymentStatus(order.getPaymentStatus())
                    .orderStatus(order.getStatus())
                    .message("Payment already verified")
                    .build();
        }

        // Validate that order is in expected pending state
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT || order.getPaymentStatus() != PaymentStatus.PENDING) {
            log.warn("Payment verification rejected: Order {} is not in PENDING_PAYMENT status (current: {}, paymentStatus: {})",
                    order.getId(), order.getStatus(), order.getPaymentStatus());
            throw new BadRequestException("Cannot verify payment: Order is in status " + order.getStatus());
        }

        // Cryptographic Signature Verification using HMAC-SHA256
        boolean isSignatureValid = razorpayClientWrapper.verifyPaymentSignature(
                request.getRazorpayOrderId(),
                request.getRazorpayPaymentId(),
                request.getRazorpaySignature()
        );

        if (!isSignatureValid) {
            log.error("Payment signature verification FAILED for order ID: {}, razorpayOrderId: {}",
                    order.getId(), request.getRazorpayOrderId());

            order.setStatus(OrderStatus.CANCELLED);
            order.setPaymentStatus(PaymentStatus.FAILED);
            try {
                orderRepository.save(order);
            } catch (Exception saveEx) {
                log.error("Failed to update order to FAILED/CANCELLED in DB for order {}: {}", order.getId(), saveEx.getMessage());
            }

            // Release reserved inventory compensation exactly once
            if (order.getItems() != null && !order.getItems().isEmpty()) {
                List<com.smarteats.order.dto.InventoryItemRequest> itemsToRestore = order.getItems().stream()
                        .map(i -> new com.smarteats.order.dto.InventoryItemRequest(i.getMenuItemId(), i.getQuantity()))
                        .collect(Collectors.toList());
                try {
                    restaurantServiceClient.releaseInventory(order.getRestaurantId(), itemsToRestore);
                    log.info("Successfully released reserved inventory compensation for failed payment on order {}", order.getId());
                } catch (Exception releaseEx) {
                    log.error("CRITICAL: Failed to release inventory during payment verification failure for order {}: {}",
                            order.getId(), releaseEx.getMessage());
                }
            }

            throw new BadRequestException("Payment verification failed: Invalid Razorpay signature");
        }

        // Signature is valid -> Successful Payment
        String paymentMethod = razorpayClientWrapper.fetchPaymentMethod(request.getRazorpayPaymentId());

        order.setStatus(OrderStatus.CREATED);
        order.setPaymentStatus(PaymentStatus.PAID);
        order.setRazorpayPaymentId(request.getRazorpayPaymentId());
        order.setRazorpaySignature(request.getRazorpaySignature());
        order.setPaymentMethod(paymentMethod);
        order.setPaymentTime(java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata")));

        Order savedOrder = orderRepository.save(order);
        log.info("Payment verified successfully for order ID: {}. Status updated to CREATED / PAID via {}",
                savedOrder.getId(), paymentMethod);

        // Clear user's shopping cart in Redis upon successful payment
        try {
            clearCart(userEmail);
        } catch (Exception cartEx) {
            log.warn("Non-fatal note: Clearing cart failed after successful payment for user {}: {}", userEmail, cartEx.getMessage());
        }

        // Publish OrderCreated event to Kafka smarteats.order.created ONLY after successful payment verification
        try {
            OrderCreatedEvent event = OrderCreatedEvent.builder()
                    .orderId(savedOrder.getId())
                    .customerEmail(savedOrder.getCustomerEmail())
                    .restaurantId(savedOrder.getRestaurantId())
                    .totalAmount(savedOrder.getTotalAmount())
                    .items(savedOrder.getItems())
                    .build();

            kafkaTemplate.send(orderCreatedTopic, savedOrder.getId(), event);
            log.info("Published OrderCreated event to Kafka topic '{}' for verified order ID: {}", orderCreatedTopic, savedOrder.getId());
        } catch (Exception kafkaEx) {
            log.error("CRITICAL/Non-fatal: Failed to publish Kafka OrderCreatedEvent for verified order ID {}: {}. Order remains PAID in DB.",
                    savedOrder.getId(), kafkaEx.getMessage());
        }

        return PaymentVerifyResponse.builder()
                .success(true)
                .orderId(savedOrder.getId())
                .paymentStatus(savedOrder.getPaymentStatus())
                .orderStatus(savedOrder.getStatus())
                .message("Payment verified successfully")
                .build();
    }

    @Override
    public com.smarteats.order.dto.WebhookResponse processWebhook(String rawPayload, String signature) {
        if (rawPayload == null || rawPayload.isBlank() || signature == null || signature.isBlank()) {
            log.warn("Webhook rejected: Missing raw body or X-Razorpay-Signature header");
            throw new BadRequestException("Invalid webhook signature: Missing payload or signature");
        }

        boolean isValid = razorpayClientWrapper.verifyWebhookSignature(rawPayload, signature);
        if (!isValid) {
            log.warn("Webhook rejected: Cryptographic signature mismatch");
            throw new BadRequestException("Invalid webhook signature");
        }

        com.fasterxml.jackson.databind.JsonNode root;
        try {
            root = objectMapper.readTree(rawPayload);
        } catch (Exception e) {
            log.error("Failed to parse valid Razorpay webhook JSON: {}", e.getMessage());
            throw new BadRequestException("Invalid JSON payload");
        }

        String event = root.path("event").asText("");
        log.info("Processing verified Razorpay webhook event: {}", event);

        if ("payment.captured".equalsIgnoreCase(event) || "order.paid".equalsIgnoreCase(event)) {
            return handlePaymentCapturedWebhook(root, event);
        } else if ("payment.failed".equalsIgnoreCase(event)) {
            return handlePaymentFailedWebhook(root, event);
        } else {
            log.info("Acknowledged unhandled Razorpay webhook event '{}' without state changes", event);
            return com.smarteats.order.dto.WebhookResponse.builder()
                    .success(true)
                    .event(event)
                    .message("Event acknowledged: " + event)
                    .build();
        }
    }

    private com.smarteats.order.dto.WebhookResponse handlePaymentCapturedWebhook(com.fasterxml.jackson.databind.JsonNode root, String event) {
        com.fasterxml.jackson.databind.JsonNode paymentEntity = root.path("payload").path("payment").path("entity");
        com.fasterxml.jackson.databind.JsonNode orderEntity = root.path("payload").path("order").path("entity");

        String razorpayOrderId = paymentEntity.path("order_id").asText(null);
        if (razorpayOrderId == null || razorpayOrderId.isBlank()) {
            razorpayOrderId = orderEntity.path("id").asText(null);
        }

        String razorpayPaymentId = paymentEntity.path("id").asText(null);
        String method = paymentEntity.path("method").asText(null);

        if (razorpayOrderId == null || razorpayOrderId.isBlank()) {
            log.warn("Webhook payment.captured received without razorpayOrderId in payload");
            return com.smarteats.order.dto.WebhookResponse.builder()
                    .success(true)
                    .event(event)
                    .message("Missing razorpayOrderId in webhook payload")
                    .build();
        }

        Order order = orderRepository.findByRazorpayOrderId(razorpayOrderId).orElse(null);
        if (order == null) {
            log.warn("Webhook payment.captured received for unknown razorpayOrderId: {}", razorpayOrderId);
            return com.smarteats.order.dto.WebhookResponse.builder()
                    .success(true)
                    .event(event)
                    .message("No order found matching razorpayOrderId: " + razorpayOrderId)
                    .build();
        }

        // 1. Idempotency check: Already PAID & CREATED
        if (order.getStatus() == OrderStatus.CREATED && order.getPaymentStatus() == PaymentStatus.PAID) {
            log.info("Webhook duplicate payment.captured for order {}. Already PAID/CREATED. Idempotent success.", order.getId());
            return com.smarteats.order.dto.WebhookResponse.builder()
                    .success(true)
                    .orderId(order.getId())
                    .event(event)
                    .message("Order already paid and confirmed")
                    .build();
        }

        // 2. State protection: If terminal cancelled, protect terminal state
        if (order.getStatus() == OrderStatus.CANCELLED) {
            log.warn("Webhook payment.captured for CANCELLED order {}. Protecting terminal state.", order.getId());
            return com.smarteats.order.dto.WebhookResponse.builder()
                    .success(true)
                    .orderId(order.getId())
                    .event(event)
                    .message("Order in terminal CANCELLED state")
                    .build();
        }

        // 3. Transition from PENDING_PAYMENT to CREATED / PAID
        order.setStatus(OrderStatus.CREATED);
        order.setPaymentStatus(PaymentStatus.PAID);
        if (razorpayPaymentId != null && !razorpayPaymentId.isBlank()) {
            order.setRazorpayPaymentId(razorpayPaymentId);
        }
        if (method != null && !method.isBlank()) {
            order.setPaymentMethod(method.toUpperCase());
        }
        order.setPaymentTime(java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata")));

        Order savedOrder = orderRepository.save(order);
        log.info("Webhook payment.captured processed: Order {} updated to CREATED / PAID via {}",
                savedOrder.getId(), savedOrder.getPaymentMethod());

        // Clear cart in Redis
        try {
            clearCart(savedOrder.getCustomerEmail());
        } catch (Exception cartEx) {
            log.warn("Non-fatal note: Failed to clear cart for user {} after webhook payment: {}",
                    savedOrder.getCustomerEmail(), cartEx.getMessage());
        }

        // Publish OrderCreatedEvent to Kafka smarteats.order.created (only once)
        try {
            OrderCreatedEvent kafkaEvent = OrderCreatedEvent.builder()
                    .orderId(savedOrder.getId())
                    .customerEmail(savedOrder.getCustomerEmail())
                    .restaurantId(savedOrder.getRestaurantId())
                    .totalAmount(savedOrder.getTotalAmount())
                    .items(savedOrder.getItems())
                    .build();
            kafkaTemplate.send(orderCreatedTopic, savedOrder.getId(), kafkaEvent);
            log.info("Published OrderCreated event to Kafka topic '{}' for webhook-confirmed order ID: {}",
                    orderCreatedTopic, savedOrder.getId());
        } catch (Exception kafkaEx) {
            log.error("CRITICAL/Non-fatal: Failed to publish Kafka OrderCreatedEvent for webhook order {}: {}. Order remains PAID in DB.",
                    savedOrder.getId(), kafkaEx.getMessage());
        }

        return com.smarteats.order.dto.WebhookResponse.builder()
                .success(true)
                .orderId(savedOrder.getId())
                .event(event)
                .message("Order confirmed and marked PAID successfully via webhook")
                .build();
    }

    private com.smarteats.order.dto.WebhookResponse handlePaymentFailedWebhook(com.fasterxml.jackson.databind.JsonNode root, String event) {
        com.fasterxml.jackson.databind.JsonNode paymentEntity = root.path("payload").path("payment").path("entity");
        String razorpayOrderId = paymentEntity.path("order_id").asText(null);
        String razorpayPaymentId = paymentEntity.path("id").asText(null);

        if (razorpayOrderId == null || razorpayOrderId.isBlank()) {
            log.warn("Webhook payment.failed received without razorpayOrderId in payload");
            return com.smarteats.order.dto.WebhookResponse.builder()
                    .success(true)
                    .event(event)
                    .message("Missing razorpayOrderId in webhook payload")
                    .build();
        }

        Order order = orderRepository.findByRazorpayOrderId(razorpayOrderId).orElse(null);
        if (order == null) {
            log.warn("Webhook payment.failed received for unknown razorpayOrderId: {}", razorpayOrderId);
            return com.smarteats.order.dto.WebhookResponse.builder()
                    .success(true)
                    .event(event)
                    .message("No order found matching razorpayOrderId: " + razorpayOrderId)
                    .build();
        }

        // 1. If already PAID / CREATED, NEVER downgrade to FAILED
        if (order.getPaymentStatus() == PaymentStatus.PAID || order.getStatus() == OrderStatus.CREATED) {
            log.info("payment.failed webhook ignored for order {} because order is already PAID/CREATED", order.getId());
            return com.smarteats.order.dto.WebhookResponse.builder()
                    .success(true)
                    .orderId(order.getId())
                    .event(event)
                    .message("Ignored payment.failed: Order is already PAID")
                    .build();
        }

        // 2. If already CANCELLED & FAILED, idempotent duplicate
        if (order.getStatus() == OrderStatus.CANCELLED && order.getPaymentStatus() == PaymentStatus.FAILED) {
            log.info("Duplicate payment.failed webhook for order {}. Already CANCELLED/FAILED.", order.getId());
            return com.smarteats.order.dto.WebhookResponse.builder()
                    .success(true)
                    .orderId(order.getId())
                    .event(event)
                    .message("Duplicate payment.failed ignored: already cancelled")
                    .build();
        }

        // 3. Transition PENDING_PAYMENT to CANCELLED / FAILED
        order.setStatus(OrderStatus.CANCELLED);
        order.setPaymentStatus(PaymentStatus.FAILED);
        if (razorpayPaymentId != null && !razorpayPaymentId.isBlank()) {
            order.setRazorpayPaymentId(razorpayPaymentId);
        }

        Order savedOrder = orderRepository.save(order);
        log.info("Webhook payment.failed processed: Order {} set to CANCELLED / FAILED", savedOrder.getId());

        // 4. Release reserved inventory exactly once
        if (savedOrder.getItems() != null && !savedOrder.getItems().isEmpty()) {
            List<com.smarteats.order.dto.InventoryItemRequest> itemsToRestore = savedOrder.getItems().stream()
                    .map(i -> new com.smarteats.order.dto.InventoryItemRequest(i.getMenuItemId(), i.getQuantity()))
                    .collect(Collectors.toList());
            try {
                restaurantServiceClient.releaseInventory(savedOrder.getRestaurantId(), itemsToRestore);
                log.info("Released reserved inventory compensation for failed payment via webhook on order {}", savedOrder.getId());
            } catch (Exception releaseEx) {
                log.error("CRITICAL: Failed to release inventory during payment.failed webhook for order {}: {}",
                        savedOrder.getId(), releaseEx.getMessage());
            }
        }

        // NOTE: Customer's Redis cart is preserved for retry. No Kafka OrderCreated event emitted.
        return com.smarteats.order.dto.WebhookResponse.builder()
                .success(true)
                .orderId(savedOrder.getId())
                .event(event)
                .message("Payment failure recorded and inventory released")
                .build();
    }

    @Override
    public int expireStalePendingPaymentOrders() {
        java.time.LocalDateTime threshold = java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata"))
                .minusMinutes(pendingExpiryMinutes > 0 ? pendingExpiryMinutes : 15);

        List<Order> staleOrders = orderRepository.findByStatusAndPaymentStatusAndCreatedAtBefore(
                OrderStatus.PENDING_PAYMENT,
                PaymentStatus.PENDING,
                threshold
        );

        if (staleOrders == null || staleOrders.isEmpty()) {
            return 0;
        }

        log.info("Found {} stale PENDING_PAYMENT orders older than {} minutes. Reconciling with Razorpay...",
                staleOrders.size(), pendingExpiryMinutes);

        int processedCount = 0;
        for (Order order : staleOrders) {
            try {
                // Reconcile status with Razorpay
                com.smarteats.order.dto.PaymentReconciliationResult recon =
                        razorpayClientWrapper.reconcileOrderPayment(order.getRazorpayOrderId());

                log.info("Reconciliation for stale order {} (Razorpay: {}): Status={}",
                        order.getId(), order.getRazorpayOrderId(), recon.getStatus());

                if (recon.getStatus() == com.smarteats.order.dto.PaymentReconciliationResult.PaymentReconciliationStatus.PAID) {
                    // Payment was captured on Razorpay -> finalize to CREATED / PAID
                    order.setStatus(OrderStatus.CREATED);
                    order.setPaymentStatus(PaymentStatus.PAID);
                    if (recon.getPaymentId() != null) {
                        order.setRazorpayPaymentId(recon.getPaymentId());
                    }
                    if (recon.getPaymentMethod() != null) {
                        order.setPaymentMethod(recon.getPaymentMethod());
                    }
                    order.setPaymentTime(java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata")));

                    Order savedOrder = orderRepository.save(order);
                    clearCart(savedOrder.getCustomerEmail());

                    // Publish Kafka event
                    try {
                        OrderCreatedEvent event = OrderCreatedEvent.builder()
                                .orderId(savedOrder.getId())
                                .customerEmail(savedOrder.getCustomerEmail())
                                .restaurantId(savedOrder.getRestaurantId())
                                .totalAmount(savedOrder.getTotalAmount())
                                .items(savedOrder.getItems())
                                .build();
                        kafkaTemplate.send(orderCreatedTopic, savedOrder.getId(), event);
                        log.info("Published OrderCreated event for reconciled PAID order {}", savedOrder.getId());
                    } catch (Exception kEx) {
                        log.error("Failed to publish Kafka event for reconciled order {}: {}", savedOrder.getId(), kEx.getMessage());
                    }
                    processedCount++;

                } else if (recon.getStatus() == com.smarteats.order.dto.PaymentReconciliationResult.PaymentReconciliationStatus.FAILED
                        || recon.getStatus() == com.smarteats.order.dto.PaymentReconciliationResult.PaymentReconciliationStatus.PENDING) {
                    // Confirmed expired / not paid -> Cancel and release inventory
                    order.setStatus(OrderStatus.CANCELLED);
                    order.setPaymentStatus(PaymentStatus.FAILED);
                    Order savedOrder = orderRepository.save(order);

                    if (savedOrder.getItems() != null && !savedOrder.getItems().isEmpty()) {
                        List<com.smarteats.order.dto.InventoryItemRequest> itemsToRestore = savedOrder.getItems().stream()
                                .map(i -> new com.smarteats.order.dto.InventoryItemRequest(i.getMenuItemId(), i.getQuantity()))
                                .collect(Collectors.toList());
                        try {
                            restaurantServiceClient.releaseInventory(savedOrder.getRestaurantId(), itemsToRestore);
                            log.info("Released reserved inventory for expired stale order {}", savedOrder.getId());
                        } catch (Exception releaseEx) {
                            log.error("Failed to release inventory during expiration for order {}: {}",
                                    savedOrder.getId(), releaseEx.getMessage());
                        }
                    }
                    processedCount++;

                } else if (recon.getStatus() == com.smarteats.order.dto.PaymentReconciliationResult.PaymentReconciliationStatus.GATEWAY_UNAVAILABLE) {
                    // Gateway unavailable / network error -> DO NOT cancel. Retry in next run.
                    log.warn("Razorpay gateway unavailable during reconciliation of order {}. Order remains PENDING_PAYMENT.",
                            order.getId());
                }

            } catch (Exception e) {
                log.error("Error processing stale order expiration for order {}: {}", order.getId(), e.getMessage(), e);
            }
        }

        return processedCount;
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
        } else if (targetStatus == OrderStatus.REJECTED || targetStatus == OrderStatus.CANCELLED) {
            // Restore inventory portions for rejected / cancelled orders
            if (savedOrder.getItems() != null && !savedOrder.getItems().isEmpty()) {
                List<com.smarteats.order.dto.InventoryItemRequest> itemsToRestore = savedOrder.getItems().stream()
                        .map(i -> new com.smarteats.order.dto.InventoryItemRequest(i.getMenuItemId(), i.getQuantity()))
                        .collect(Collectors.toList());
                try {
                    restaurantServiceClient.releaseInventory(savedOrder.getRestaurantId(), itemsToRestore);
                    log.info("Successfully restored inventory for {} order {}", targetStatus, orderId);
                } catch (Exception e) {
                    log.error("Failed to restore inventory for {} order {}: {}", targetStatus, orderId, e.getMessage());
                }
            }
        }

        return mapToResponse(savedOrder);
    }

    private void validateStateTransition(OrderStatus current, OrderStatus next) {
        if (current == OrderStatus.PENDING_PAYMENT) {
            if (next != OrderStatus.CREATED && next != OrderStatus.CANCELLED && next != OrderStatus.REJECTED) {
                throw new BadRequestException("Invalid state transition: Cannot change status from " + current + " to " + next + ". Expected CREATED, CANCELLED, or REJECTED.");
            }
        } else if (current == OrderStatus.CREATED || current == OrderStatus.NEW) {
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
        OrderStatus newStatus;
        try {
            newStatus = OrderStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid Order Status: " + status);
        }

        return transitionOrderStatus(orderId, newStatus, userEmail);
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
                .paymentStatus(order.getPaymentStatus())
                .razorpayOrderId(order.getRazorpayOrderId())
                .paymentMethod(order.getPaymentMethod())
                .idempotencyKey(order.getIdempotencyKey())
                .createdAt(order.getCreatedAt())
                .build();
    }
}
