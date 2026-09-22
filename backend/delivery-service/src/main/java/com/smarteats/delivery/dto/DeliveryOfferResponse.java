package com.smarteats.delivery.dto;

import com.smarteats.delivery.entity.DeliveryOfferStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryOfferResponse {
    private String id;
    private String deliveryId;
    private String orderId;
    private String restaurantId;
    private String restaurantName;
    private String restaurantAddress;
    private double restaurantLatitude;
    private double restaurantLongitude;
    private double deliveryLatitude;
    private double deliveryLongitude;
    private double distanceKm;
    private Double orderTotalAmount;
    private DeliveryOfferStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private long secondsRemaining;
}
