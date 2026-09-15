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
    private String userId;
    private String name;
    private String email;
    private String phone;
    private String address;
    private String vehicleType;
    private String vehicleNumber;
    private String verificationInfo;
}
