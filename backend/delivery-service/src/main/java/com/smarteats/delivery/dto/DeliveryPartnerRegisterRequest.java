package com.smarteats.delivery.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryPartnerRegisterRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    private String baseAddress;
    private String city;
    private String state;
    private String pincode;
    private Double baseLatitude;
    private Double baseLongitude;

    // Backward-compatibility coordinate aliases
    private double latitude;
    private double longitude;
}
