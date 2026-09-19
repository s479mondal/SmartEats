package com.smarteats.order.entity;

import com.smarteats.common.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "orders")
public class Order {

    @Id
    private String id;
    private String customerEmail;
    private String restaurantId;
    private List<CartItem> items;
    private double totalAmount;
    private OrderStatus status;

    private Double deliveryLatitude;
    private Double deliveryLongitude;

    // Idempotency
    @org.springframework.data.mongodb.core.index.Indexed(unique = true, sparse = true)
    private String idempotencyKey;

    // Razorpay / Payment Fields
    private String razorpayOrderId;
    private String razorpayPaymentId;
    private String razorpaySignature;
    private PaymentStatus paymentStatus;
    private String paymentMethod;
    private LocalDateTime paymentTime;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}

