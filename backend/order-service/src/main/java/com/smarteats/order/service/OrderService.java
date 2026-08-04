package com.smarteats.order.service;

import com.smarteats.order.dto.CartDto;
import com.smarteats.order.dto.CartItemRequest;
import com.smarteats.order.dto.OrderResponse;

import java.util.List;

public interface OrderService {
    CartDto addItemToCart(String userEmail, String restaurantId, CartItemRequest request);
    CartDto getCart(String userEmail);
    void clearCart(String userEmail);
    OrderResponse placeOrder(String userEmail);
    OrderResponse getOrderById(String orderId);
    List<OrderResponse> getOrdersForCustomer(String userEmail);
    List<OrderResponse> getOrdersForRestaurant(String restaurantId, String ownerEmail);
    OrderResponse updateOrderStatus(String orderId, String status, String userEmail, String roles);
}
