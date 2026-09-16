package com.smarteats.restaurant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.springframework.data.mongodb.core.geo.GeoJsonPoint;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantResponse implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;
    private String ownerId;
    private String name;
    private String description;
    private String ownerEmail;
    private String email;
    private String address;
    private String city;
    private String pincode;
    private Double latitude;
    private Double longitude;
    private GeoJsonPoint geoLocation;
    private String location;
    private String phone;
    private String cuisineType;
    private String openingTime;
    private String closingTime;
    private String logoUrl;
    private String businessRegistrationNumber;
    private String foodLicenseNumber;
    private String verificationDocumentUrl;
    private boolean approved;
    private String status;
    private boolean open;
    private String approvedBy;
    private LocalDateTime approvalDate;
    private LocalDateTime createdAt;
    private Double distanceKm;
}
