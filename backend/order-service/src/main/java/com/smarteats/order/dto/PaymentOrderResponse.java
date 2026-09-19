package com.smarteats.order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentOrderResponse {
    private boolean success;
    private String orderId;
    private String razorpayOrderId;
    private double amount;
    private long amountInPaise;
    private String currency;
    private String keyId;
    private String customerEmail;
    private String restaurantId;
    private String idempotencyKey;
    private String message;
}
