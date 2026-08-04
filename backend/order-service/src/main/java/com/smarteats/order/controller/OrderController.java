package com.smarteats.order.controller;

import com.smarteats.common.dto.ApiResponse;
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

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
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
    public ResponseEntity<ApiResponse<OrderResponse>> getOrderById(@PathVariable String id) {
        OrderResponse order = orderService.getOrderById(id);
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
            throw new UnauthorizedException("Access Denied: You do not possess the required privilege " + requiredRole);
        }
    }
}
