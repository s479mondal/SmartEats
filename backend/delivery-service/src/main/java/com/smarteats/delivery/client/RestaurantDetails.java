package com.smarteats.delivery.client;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantDetails implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;
    private String name;
    private String phone;
    private String address;
    private String city;
    private Double latitude;
    private Double longitude;
}
