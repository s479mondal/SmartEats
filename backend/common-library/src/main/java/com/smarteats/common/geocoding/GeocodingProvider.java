package com.smarteats.common.geocoding;

import java.util.List;

public interface GeocodingProvider {
    GeocodingResult geocode(String address);
    List<LocationSearchResult> search(String address);
    ReverseGeocodingResult reverseGeocode(Double latitude, Double longitude);
    PincodeResult lookupPincode(String pincode);
    String getProviderName();
}
