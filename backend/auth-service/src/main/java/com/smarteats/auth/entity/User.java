package com.smarteats.auth.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;

    private String name;

    @Indexed(unique = true)
    private String email;

    private String password;

    private String phone;

    private String address;

    private String location;

    @Builder.Default
    private Set<Role> roles = new HashSet<>();

    @Builder.Default
    private boolean approved = true; // true for CUSTOMER/ADMIN, false for PENDING

    @Builder.Default
    private String status = "PENDING"; // PENDING, ACTIVE, REJECTED, SUSPENDED

    private String rejectionReason;

    // Customer Specific Fields
    private List<String> foodPreferences;

    // Restaurant Owner Specific Fields (Section B & C)
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
    private String logoUrl;
    private String businessRegistrationNumber;
    private String foodLicenseNumber;
    private String verificationDocumentUrl;

    // Delivery Partner Specific Fields
    private String vehicleType;
    private String vehicleNumber;
    private String verificationInfo; // Driving license / Govt ID

    // NGO Specific Fields
    private String ngoName;
    private String contactPerson;
    private String ngoAddress;
    private String organizationInfo;
    private String foodRescueInfo;

    // OAuth2 configuration (optional provider fields)
    private String oauth2Provider;
    private String oauth2Id;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
