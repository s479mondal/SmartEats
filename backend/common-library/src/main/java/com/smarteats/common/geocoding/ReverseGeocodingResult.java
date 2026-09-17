package com.smarteats.common.geocoding;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReverseGeocodingResult implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean success;
    private String formattedAddress;
    private Double latitude;
    private Double longitude;
    private String errorMessage;
    private Map<String, String> addressDetails;

    public static ReverseGeocodingResult success(Double latitude, Double longitude, String formattedAddress, Map<String, String> addressDetails) {
        return ReverseGeocodingResult.builder()
                .success(true)
                .latitude(latitude)
                .longitude(longitude)
                .formattedAddress(formattedAddress)
                .addressDetails(addressDetails)
                .build();
    }

    public static ReverseGeocodingResult failure(String errorMessage) {
        return ReverseGeocodingResult.builder()
                .success(false)
                .errorMessage(errorMessage)
                .build();
    }
}
