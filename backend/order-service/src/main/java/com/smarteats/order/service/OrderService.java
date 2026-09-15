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
    OrderResponse getOrderById(String orderId, String userEmail, String roles);
    List<OrderResponse> getOrdersForCustomer(String userEmail);
    List<OrderResponse> getOrdersForRestaurant(String restaurantId, String ownerEmail);
    OrderResponse updateOrderStatus(String orderId, String status, String userEmail, String roles);

    List<OrderResponse> getMyRestaurantOrders(String ownerEmail);
    OrderResponse getMyRestaurantOrderById(String orderId, String ownerEmail);
    OrderResponse acceptOrder(String orderId, String ownerEmail);
    OrderResponse rejectOrder(String orderId, String ownerEmail);
    OrderResponse preparingOrder(String orderId, String ownerEmail);
    OrderResponse readyOrder(String orderId, String ownerEmail);
}
