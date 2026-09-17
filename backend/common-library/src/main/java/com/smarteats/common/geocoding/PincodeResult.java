package com.smarteats.common.geocoding;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PincodeResult implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean success;
    private String pincode;
    private String city;
    private String district;
    private String state;
    private String country;
    private List<String> postOffices;
    private String message;

    public static PincodeResult success(String pincode, String city, String district, String state, String country, List<String> postOffices, String message) {
        return PincodeResult.builder()
                .success(true)
                .pincode(pincode)
                .city(city)
                .district(district)
                .state(state)
                .country(country != null ? country : "India")
                .postOffices(postOffices)
                .message(message)
                .build();
    }

    public static PincodeResult failure(String pincode, String message) {
        return PincodeResult.builder()
                .success(false)
                .pincode(pincode)
                .country("India")
                .message(message)
                .build();
    }
}
