package com.smarteats.order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentReconciliationResult {

    public enum PaymentReconciliationStatus {
        PAID,
        FAILED,
        PENDING,
        GATEWAY_UNAVAILABLE
    }

    private PaymentReconciliationStatus status;
    private String paymentId;
    private String paymentMethod;
    private String message;
}
