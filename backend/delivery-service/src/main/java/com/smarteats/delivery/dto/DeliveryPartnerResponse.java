package com.smarteats.delivery.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryPartnerResponse {
    private String id;
    private String name;
    private String email;
    private double latitude;
    private double longitude;
    private boolean active;
    private boolean available;
}
