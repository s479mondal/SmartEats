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
@Document(collection = "profile_change_requests")
public class ProfileChangeRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    private String id;
    private String restaurantId;
    private String ownerId;
    private String ownerEmail;

    // Requested Major Identity Fields
    private String requestedRestaurantName;
    private String requestedAddress;
    private String requestedCity;
    private String requestedPincode;
    private Double requestedLatitude;
    private Double requestedLongitude;
    private String requestedBusinessRegistrationNumber;
    private String requestedFoodLicenseNumber;
    private String requestedVerificationDocumentUrl;
    private String reason;

    @Builder.Default
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED
    private String adminFeedback;
    private String reviewedBy;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime reviewedAt;
}
