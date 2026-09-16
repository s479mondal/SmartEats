package com.smarteats.common.geocoding;

public interface GeocodingProvider {
    GeocodingResult geocode(String address);
    String getProviderName();
}
