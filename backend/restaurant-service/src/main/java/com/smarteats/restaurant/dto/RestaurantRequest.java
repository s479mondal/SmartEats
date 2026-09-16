package com.smarteats.restaurant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantRequest {
    private String name;
    private String description;
    private String address;
    private String city;
    private String pincode;
    private String phone;
    private String email;
    private String cuisineType;
    private String openingTime;
    private String closingTime;
    private String logoUrl;
    private Boolean open;
    private Double latitude;
    private Double longitude;
}
