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
    private String location;
    private String organizationInfo;
    private String foodRescueInfo;
}
