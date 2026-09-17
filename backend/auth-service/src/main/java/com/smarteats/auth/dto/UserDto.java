package com.smarteats.auth.dto;

import com.smarteats.auth.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDto {
    private String id;
    private String name;
    private String email;
    private String phone;
    private String address;
    private String location;
    private Set<Role> roles;
    private boolean approved;
    private String status; // PENDING, ACTIVE, REJECTED, SUSPENDED
    private String rejectionReason;

    // Role-specific fields
    private List<String> foodPreferences;
    private Double customerLatitude;
    private Double customerLongitude;
    private String locationSource;
    private String restaurantName;
    private String restaurantDescription;
    private String restaurantAddress;
    private String restaurantLocation;
    private String restaurantCity;
    private String restaurantPincode;
    private Double restaurantLatitude;
    private Double restaurantLongitude;
    private String cuisineType;
    private String restaurantContact;
    private String restaurantEmail;
    private String openingTime;
    private String closingTime;
    private Integer openingTimeMinutes;
    private Integer closingTimeMinutes;
    private String logoUrl;
    private String businessRegistrationNumber;
    private String foodLicenseNumber;
    private String verificationDocumentUrl;
    private String vehicleType;
    private String vehicleNumber;
    private String verificationInfo;
    private String ngoName;
    private String contactPerson;
    private String ngoAddress;
    private String ngoCity;
    private String ngoPincode;
    private Double ngoLatitude;
    private Double ngoLongitude;
    private String organizationInfo;
    private String foodRescueInfo;
}
