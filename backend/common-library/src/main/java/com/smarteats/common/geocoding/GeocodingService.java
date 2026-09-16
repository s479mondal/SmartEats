package com.smarteats.common.geocoding;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class GeocodingService {

    private final GeocodingProvider geocodingProvider;

    public GeocodingService(GeocodingProvider geocodingProvider) {
        this.geocodingProvider = geocodingProvider;
        log.info("Initialized GeocodingService with active provider: {}", geocodingProvider.getProviderName());
    }

    public GeocodingResult geocodeAddress(String address) {
        log.info("GeocodingService resolving address: '{}'", address);
        return geocodingProvider.geocode(address);
    }

    public String getActiveProviderName() {
        return geocodingProvider.getProviderName();
    }
}
