package com.smarteats.common.geocoding;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GeocodingResult implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean success;
    private Double latitude;
    private Double longitude;
    private String formattedAddress;
    private String errorMessage;
    private String providerName;

    public static GeocodingResult success(Double latitude, Double longitude, String formattedAddress, String providerName) {
        return GeocodingResult.builder()
                .success(true)
                .latitude(latitude)
                .longitude(longitude)
                .formattedAddress(formattedAddress)
                .providerName(providerName)
                .build();
    }

    public static GeocodingResult failure(String errorMessage, String providerName) {
        return GeocodingResult.builder()
                .success(false)
                .errorMessage(errorMessage)
                .providerName(providerName)
                .build();
    }
}
