package com.smarteats.order.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentVerifyRequest {

    @NotBlank(message = "SmartEats orderId is required")
    private String orderId;

    @NotBlank(message = "Razorpay orderId is required")
    private String razorpayOrderId;

    @NotBlank(message = "Razorpay paymentId is required")
    private String razorpayPaymentId;

    @NotBlank(message = "Razorpay signature is required")
    private String razorpaySignature;
}
