package com.smarteats.restaurant.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "restaurants")
public class Restaurant implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    private String id;
    private String ownerId; // Logical mapping to users._id
    private String name;
    private String description;
    private String ownerEmail;
    private String email;
    private String address;
    private String city;
    private String pincode;
    private Double latitude;
    private Double longitude;
    private String location;
    private String phone;
    private String cuisineType;
    private String openingTime;
    private String closingTime;
    private String logoUrl;
    private String businessRegistrationNumber;
    private String foodLicenseNumber;
    private String verificationDocumentUrl;
    
    @Builder.Default
    private boolean approved = false;
    
    @Builder.Default
    private String status = "PENDING"; // PENDING, ACTIVE, REJECTED, SUSPENDED

    @Builder.Default
    private boolean open = true; // Direct operational toggle

    private String approvedBy;
    private LocalDateTime approvalDate;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
