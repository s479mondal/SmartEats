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
@Document(collection = "delivery_offers")
public class DeliveryOffer {

    @Id
    private String id;
    private String deliveryId;
    private String orderId;
    private String driverEmail;
    private String driverName;
    private String restaurantId;
    private String restaurantName;
    private String restaurantAddress;
    private double restaurantLatitude;
    private double restaurantLongitude;
    private double deliveryLatitude;
    private double deliveryLongitude;
    private double distanceKm;
    private Double orderTotalAmount;
    private int batchNumber;

    private DeliveryOfferStatus status;

    @CreatedDate
    private LocalDateTime createdAt;

    private LocalDateTime expiresAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
