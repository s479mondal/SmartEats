package com.smarteats.order.service;

import com.smarteats.order.dto.CartDto;
import com.smarteats.order.dto.CartItemRequest;
import com.smarteats.order.dto.OrderResponse;
import com.smarteats.order.dto.PaymentOrderResponse;
import com.smarteats.order.dto.PaymentVerifyRequest;
import com.smarteats.order.dto.PaymentVerifyResponse;

import java.util.List;

public interface OrderService {
    CartDto addItemToCart(String userEmail, String restaurantId, CartItemRequest request);
    CartDto getCart(String userEmail);
    void clearCart(String userEmail);
    OrderResponse placeOrder(String userEmail);
    OrderResponse placeOrder(String userEmail, String idempotencyKey);
    OrderResponse placeOrder(String userEmail, String idempotencyKey, com.smarteats.order.dto.CartSyncRequest cartRequest);
    OrderResponse placeCodOrder(String userEmail);
    OrderResponse placeCodOrder(String userEmail, String idempotencyKey);
    OrderResponse placeCodOrder(String userEmail, String idempotencyKey, com.smarteats.order.dto.CartSyncRequest cartRequest);
    OrderResponse getOrderById(String orderId);
    OrderResponse getOrderById(String orderId, String userEmail, String roles);
    List<OrderResponse> getOrdersForCustomer(String userEmail);
    List<OrderResponse> getOrdersForRestaurant(String restaurantId, String ownerEmail);
    OrderResponse updateOrderStatus(String orderId, String status, String userEmail, String roles);

    PaymentOrderResponse createPaymentOrder(String userEmail);
    PaymentOrderResponse createPaymentOrder(String userEmail, String idempotencyKey);
    PaymentOrderResponse createPaymentOrder(String userEmail, String idempotencyKey, com.smarteats.order.dto.CartSyncRequest cartRequest);
    PaymentVerifyResponse verifyPayment(String userEmail, PaymentVerifyRequest request);
    com.smarteats.order.dto.WebhookResponse processWebhook(String rawPayload, String signature);
    int expireStalePendingPaymentOrders();

    List<OrderResponse> getMyRestaurantOrders(String ownerEmail);
    OrderResponse getMyRestaurantOrderById(String orderId, String ownerEmail);
    OrderResponse acceptOrder(String orderId, String ownerEmail);
    OrderResponse rejectOrder(String orderId, String ownerEmail);
    OrderResponse preparingOrder(String orderId, String ownerEmail);
    OrderResponse readyOrder(String orderId, String ownerEmail);
}


