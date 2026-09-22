package com.smarteats.delivery.dto;

import com.smarteats.delivery.entity.DeliveryStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryResponse {
    private String id;
    private String orderId;
    private String restaurantId;
    private String customerEmail;
    private String deliveryPartnerEmail;
    private String driverName;
    private String driverPhone;
    private Boolean driverAvailable;
    private Boolean driverActive;
    private DeliveryStatus status;
    private double restaurantLatitude;
    private double restaurantLongitude;
    private double deliveryLatitude;
    private double deliveryLongitude;

    // Driver Live Operational GPS (Step 8.3C)
    private Double driverCurrentLatitude;
    private Double driverCurrentLongitude;
    private LocalDateTime driverLastLocationUpdate;
    private Double driverLocationAccuracyMeters;

    // Restaurant Contact & Info (Step 8.4B)
    private String restaurantName;
    private String restaurantPhone;
    private String restaurantAddress;
}
