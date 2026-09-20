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
public class DeliveryPartnerRegisteredEvent implements Serializable {
    private static final long serialVersionUID = 1L;

    private String userId;
    private String name;
    private String email;
    private String phone;
    private String address;
    private String vehicleType;
    private String vehicleNumber;
    private String verificationInfo;

    // Base / Service Location fields
    private String baseAddress;
    private String city;
    private String state;
    private String pincode;
    private Double baseLatitude;
    private Double baseLongitude;
}
