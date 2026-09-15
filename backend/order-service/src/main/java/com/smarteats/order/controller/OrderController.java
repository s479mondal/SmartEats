package com.smarteats.order.controller;

import com.smarteats.common.dto.ApiResponse;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.order.dto.CartDto;
import com.smarteats.order.dto.CartItemRequest;
import com.smarteats.order.dto.OrderResponse;
import com.smarteats.order.service.OrderService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.beans.factory.annotation.Value;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;
    private final RedisTemplate<String, Object> redisTemplate;
    private final org.springframework.kafka.core.KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.topic.order-created:smarteats.order.created}")
    private String orderCreatedTopic;

    public OrderController(OrderService orderService,
                           RedisTemplate<String, Object> redisTemplate,
                           org.springframework.kafka.core.KafkaTemplate<String, Object> kafkaTemplate) {
        this.orderService = orderService;
        this.redisTemplate = redisTemplate;
        this.kafkaTemplate = kafkaTemplate;
    }

    @PostMapping("/cart")
    public ResponseEntity<ApiResponse<CartDto>> addToCart(
            @RequestParam String restaurantId,
            @Valid @RequestBody CartItemRequest request,
            @RequestHeader("X-User-Email") String email) {
        
        log.info("User {} adding item to cart from restaurant {}", email, restaurantId);
        CartDto cart = orderService.addItemToCart(email, restaurantId, request);
        return ResponseEntity.ok(ApiResponse.success(cart, "Item added to cart"));
    }

    @GetMapping("/cart")
    public ResponseEntity<ApiResponse<CartDto>> getCart(@RequestHeader("X-User-Email") String email) {
        CartDto cart = orderService.getCart(email);
        return ResponseEntity.ok(ApiResponse.success(cart));
    }

    @DeleteMapping("/cart")
    public ResponseEntity<ApiResponse<Void>> clearCart(@RequestHeader("X-User-Email") String email) {
        orderService.clearCart(email);
        return ResponseEntity.ok(ApiResponse.success(null, "Cart cleared successfully"));
    }

    @PostMapping("/checkout")
    public ResponseEntity<ApiResponse<OrderResponse>> checkout(@RequestHeader("X-User-Email") String email) {
        log.info("User {} initiating order checkout", email);
        OrderResponse order = orderService.placeOrder(email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(order, "Order placed successfully"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderResponse>> getOrderById(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Email", required = false) String email,
            @RequestHeader(value = "X-User-Roles", required = false) String roles) {
        if (email == null || email.isBlank()) {
            throw new UnauthorizedException("Authentication required: Missing user identity");
        }
        OrderResponse order = orderService.getOrderById(id, email, roles);
        return ResponseEntity.ok(ApiResponse.success(order));
    }

    @GetMapping("/customer")
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getCustomerOrders(@RequestHeader("X-User-Email") String email) {
        List<OrderResponse> orders = orderService.getOrdersForCustomer(email);
        return ResponseEntity.ok(ApiResponse.success(orders));
    }

    @GetMapping("/restaurant/{restaurantId}")
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getRestaurantOrders(
            @PathVariable String restaurantId,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "RESTAURANT_OWNER");
        List<OrderResponse> orders = orderService.getOrdersForRestaurant(restaurantId, email);
        return ResponseEntity.ok(ApiResponse.success(orders));
    }

    @GetMapping("/my/orders")
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getMyRestaurantOrders(
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        List<OrderResponse> orders = orderService.getMyRestaurantOrders(email);
        return ResponseEntity.ok(ApiResponse.success(orders));
    }

    @GetMapping("/my/orders/{orderId}")
    public ResponseEntity<ApiResponse<OrderResponse>> getMyRestaurantOrderById(
            @PathVariable String orderId,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        OrderResponse order = orderService.getMyRestaurantOrderById(orderId, email);
        return ResponseEntity.ok(ApiResponse.success(order));
    }

    @PatchMapping("/my/orders/{orderId}/accept")
    public ResponseEntity<ApiResponse<OrderResponse>> acceptOrder(
            @PathVariable String orderId,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        OrderResponse order = orderService.acceptOrder(orderId, email);
        return ResponseEntity.ok(ApiResponse.success(order, "Order accepted successfully"));
    }

    @PatchMapping("/my/orders/{orderId}/reject")
    public ResponseEntity<ApiResponse<OrderResponse>> rejectOrder(
            @PathVariable String orderId,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        OrderResponse order = orderService.rejectOrder(orderId, email);
        return ResponseEntity.ok(ApiResponse.success(order, "Order rejected"));
    }

    @PatchMapping("/my/orders/{orderId}/preparing")
    public ResponseEntity<ApiResponse<OrderResponse>> preparingOrder(
            @PathVariable String orderId,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        OrderResponse order = orderService.preparingOrder(orderId, email);
        return ResponseEntity.ok(ApiResponse.success(order, "Order preparation started"));
    }

    @PatchMapping("/my/orders/{orderId}/ready")
    public ResponseEntity<ApiResponse<OrderResponse>> readyOrder(
            @PathVariable String orderId,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        OrderResponse order = orderService.readyOrder(orderId, email);
        return ResponseEntity.ok(ApiResponse.success(order, "Order marked ready for pickup"));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<OrderResponse>> updateStatus(
            @PathVariable String id,
            @RequestParam String status,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        log.info("Request to update order {} status to {} by {}", id, status, email);
        OrderResponse order = orderService.updateOrderStatus(id, status, email, roles);
        return ResponseEntity.ok(ApiResponse.success(order, "Order status updated successfully"));
    }

    // Role verification helper
    private void checkRole(String rolesHeader, String requiredRole) {
        if (rolesHeader == null || (!rolesHeader.contains(requiredRole) && !rolesHeader.contains("ADMIN"))) {
            throw new ForbiddenException("Access Denied: You do not possess the required privilege " + requiredRole);
        }
    }

    @GetMapping("/cache/test")
    public ResponseEntity<ApiResponse<String>> testCache() {
        String testKey = "test-cache-key";
        String testVal = "Hello Redis";
        redisTemplate.opsForValue().set(testKey, testVal);
        String retrieved = (String) redisTemplate.opsForValue().get(testKey);
        return ResponseEntity.ok(ApiResponse.success(retrieved, "Redis Connection Test Success!"));
    }

    @PostMapping("/kafka/test")
    public ResponseEntity<ApiResponse<String>> testKafka(@RequestParam String message) {
        Map<String, Object> testEvent = Map.of(
                "orderId", "test-order-id-12345",
                "customerEmail", "customer@smarteats.com",
                "totalAmount", 19.99,
                "message", message
        );
        kafkaTemplate.send(orderCreatedTopic, "test-order-id-12345", testEvent);
        return ResponseEntity.ok(ApiResponse.success("Sent message: '" + message + "' to topic: '" + orderCreatedTopic + "'"));
    }
}
