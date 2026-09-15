package com.smarteats.common.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderAcceptedEvent implements Serializable {
    private static final long serialVersionUID = 1L;

    private String orderId;
    private String restaurantId;
    private String customerEmail;
    private double totalAmount;
    private double restaurantLatitude;
    private double restaurantLongitude;
    private double deliveryLatitude;
    private double deliveryLongitude;
    private String createdAt;
}
