package com.smarteats.delivery.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

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
    private double latitude;
    private double longitude;
    private boolean active;
    private boolean available;
    private String status; // PENDING, ACTIVE, REJECTED, SUSPENDED
}
