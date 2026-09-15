package com.smarteats.auth.dto;

import com.smarteats.auth.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
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
public class RegisterRequest {

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 50, message = "Name must be between 2 and 50 characters")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    private String password;

    private String phone;

    private String address;

    private String location;

    @NotEmpty(message = "At least one role is required")
    private Set<Role> roles;

    // Customer Specific Fields
    private List<String> foodPreferences;

    // Restaurant Owner Specific Fields (Section B & C)
    private String restaurantName;
    private String description;
    private String restaurantAddress;
    private String restaurantLocation;
    private String city;
    private String pincode;
    private Double latitude;
    private Double longitude;
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
    private String verificationInfo; // License/ID

    // NGO Specific Fields
    private String ngoName;
    private String contactPerson;
    private String ngoAddress;
    private String organizationInfo;
    private String foodRescueInfo;

    // OAuth2 registration details (optional)
    private String oauth2Provider;
    private String oauth2Id;
}
