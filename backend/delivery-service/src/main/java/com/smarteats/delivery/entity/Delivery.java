package com.smarteats.delivery.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "deliveries")
public class Delivery {

    @Id
    private String id;
    private String orderId;
    private String restaurantId;
    private String customerEmail;
    private String deliveryPartnerEmail;
    private DeliveryStatus status;

    private double restaurantLatitude;
    private double restaurantLongitude;
    private double deliveryLatitude;
    private double deliveryLongitude;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
