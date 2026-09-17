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
public class NGORegisteredEvent implements Serializable {
    private String userId;
    private String name;
    private String email;
    private String phone;
    private String ngoName;
    private String contactPerson;
    private String ngoAddress;
    private String city;
    private String pincode;
    private Double latitude;
    private Double longitude;
    private String location;
    private String locationSource;
    private String organizationInfo;
    private String foodRescueInfo;
}
