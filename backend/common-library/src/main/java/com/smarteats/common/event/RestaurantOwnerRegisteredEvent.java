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
public class RestaurantOwnerRegisteredEvent implements Serializable {
    private static final long serialVersionUID = 1L;

    // Section A: Owner Information
    private String userId;
    private String name;
    private String email;
    private String phone;

    // Section B: Restaurant Information
    private String restaurantName;
    private String description;
    private String cuisineType;
    private String restaurantContact;
    private String restaurantEmail;
    private String restaurantAddress;
    private String restaurantLocation;
    private String city;
    private String pincode;
    private Double latitude;
    private Double longitude;
    private String openingTime;
    private String closingTime;
    private Integer openingTimeMinutes;
    private Integer closingTimeMinutes;
    private String logoUrl;

    // Section C: Verification Information
    private String businessRegistrationNumber;
    private String foodLicenseNumber;
    private String verificationDocumentUrl;
}
