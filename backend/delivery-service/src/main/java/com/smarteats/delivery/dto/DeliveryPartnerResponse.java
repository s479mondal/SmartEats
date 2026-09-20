package com.smarteats.delivery.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryPartnerResponse {
    private String id;
    private String name;
    private String email;
    private String baseAddress;
    private String city;
    private String state;
    private String pincode;
    private double baseLatitude;
    private double baseLongitude;
    private double latitude;
    private double longitude;
    private Double currentLatitude;
    private Double currentLongitude;
    private java.time.LocalDateTime lastLocationUpdate;
    private Double locationAccuracyMeters;
    private boolean active;
    private boolean available;
}
