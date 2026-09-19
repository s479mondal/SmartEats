package com.smarteats.order.dto;

import com.smarteats.common.enums.PaymentStatus;
import com.smarteats.order.entity.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentVerifyResponse {
    private boolean success;
    private String orderId;
    private PaymentStatus paymentStatus;
    private OrderStatus orderStatus;
    private String message;
}
