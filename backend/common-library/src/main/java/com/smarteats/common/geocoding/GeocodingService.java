package com.smarteats.common.geocoding;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

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

    public List<LocationSearchResult> searchAddress(String address) {
        log.info("GeocodingService searching location candidates for address: '{}'", address);
        return geocodingProvider.search(address);
    }

    public ReverseGeocodingResult reverseGeocode(Double latitude, Double longitude) {
        log.info("GeocodingService reverse geocoding coordinates: lat={}, lon={}", latitude, longitude);
        return geocodingProvider.reverseGeocode(latitude, longitude);
    }

    public PincodeResult lookupPincode(String pincode) {
        log.info("GeocodingService looking up details for PIN code: '{}'", pincode);
        return geocodingProvider.lookupPincode(pincode);
    }

    public String getActiveProviderName() {
        return geocodingProvider.getProviderName();
    }
}
