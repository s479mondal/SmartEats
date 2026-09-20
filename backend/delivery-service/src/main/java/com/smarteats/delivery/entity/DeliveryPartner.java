package com.smarteats.delivery.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "delivery_partners")
public class DeliveryPartner {

    @Id
    private String id;
    private String userId; // Logical mapping to users._id
    private String name;
    private String email;
    private String phone;
    private String address;
    private String vehicleType;
    private String vehicleNumber;
    private String verificationInfo;

    // Base / Service Location (Permanent registration reference)
    private String baseAddress;
    private String city;
    private String state;
    private String pincode;
    private double baseLatitude;
    private double baseLongitude;

    // Backward-Compatible Location Fields (Mirrors base location until live GPS is activated in future steps)
    private double latitude;
    private double longitude;

    // Placeholders for future Live Operational Location (Step 8.3A/8.3B - NOT used by assignment yet)
    private Double currentLatitude;
    private Double currentLongitude;
    private LocalDateTime lastLocationUpdate;
    private Double locationAccuracyMeters;

    private boolean active;
    private boolean available;
    private String status; // PENDING, ACTIVE, REJECTED, SUSPENDED
}
