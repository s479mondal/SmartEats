package com.smarteats.delivery.dto;

import com.smarteats.delivery.entity.DeliveryStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    private DeliveryStatus status;
    private double restaurantLatitude;
    private double restaurantLongitude;
    private double deliveryLatitude;
    private double deliveryLongitude;
}
