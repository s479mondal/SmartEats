package com.smarteats.auth.controller;

import com.smarteats.common.dto.ApiResponse;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.geocoding.GeocodingService;
import com.smarteats.common.geocoding.LocationSearchResult;
import com.smarteats.common.geocoding.PincodeResult;
import com.smarteats.common.geocoding.ReverseGeocodingResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/auth/location")
public class LocationController {

    private final GeocodingService geocodingService;

    public LocationController(GeocodingService geocodingService) {
        this.geocodingService = geocodingService;
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<LocationSearchResult>>> searchLocation(
            @RequestParam(value = "query", required = false) String query) {
        if (query == null || query.trim().isBlank()) {
            throw new BadRequestException("Query parameter 'query' cannot be blank");
        }
        if (query.trim().length() > 255) {
            throw new BadRequestException("Query parameter 'query' exceeds maximum length of 255 characters");
        }

        String sanitizedQuery = query.trim();
        log.info("Received location search query: '{}'", sanitizedQuery);

        List<LocationSearchResult> results = geocodingService.searchAddress(sanitizedQuery);
        if (results == null) {
            results = Collections.emptyList();
        }

        String message = results.isEmpty() 
                ? "No location candidates found" 
                : "Location candidates retrieved successfully";

        return ResponseEntity.ok(ApiResponse.success(results, message));
    }

    @GetMapping("/reverse")
    public ResponseEntity<ApiResponse<ReverseGeocodingResult>> reverseGeocode(
            @RequestParam(value = "lat", required = false) Double lat,
            @RequestParam(value = "lng", required = false) Double lng) {
        if (lat == null || lng == null) {
            throw new BadRequestException("Parameters 'lat' and 'lng' are both required");
        }
        if (lat < -90.0 || lat > 90.0) {
            throw new BadRequestException("Latitude must be between -90 and 90 degrees");
        }
        if (lng < -180.0 || lng > 180.0) {
            throw new BadRequestException("Longitude must be between -180 and 180 degrees");
        }

        log.info("Received reverse geocoding request for coordinates: lat={}, lon={}", lat, lng);
        ReverseGeocodingResult result = geocodingService.reverseGeocode(lat, lng);

        return ResponseEntity.ok(ApiResponse.success(result, "Reverse geocoding completed successfully"));
    }

    @GetMapping("/pincode/{pincode}")
    public ResponseEntity<ApiResponse<PincodeResult>> getPincodeDetails(
            @PathVariable(value = "pincode", required = false) String pincode) {
        if (pincode == null || pincode.trim().isBlank()) {
            throw new BadRequestException("PIN code parameter cannot be blank");
        }
        String sanitizedPincode = pincode.trim();
        if (!sanitizedPincode.matches("^[0-9]{6}$")) {
            throw new BadRequestException("PIN code must be exactly 6 numeric digits");
        }

        log.info("Received PIN code lookup request for: '{}'", sanitizedPincode);
        PincodeResult result = geocodingService.lookupPincode(sanitizedPincode);

        if (result == null || !result.isSuccess()) {
            String message = result != null && result.getMessage() != null 
                    ? result.getMessage() 
                    : "No location found for this PIN code.";
            return ResponseEntity.ok(ApiResponse.success(
                    result != null ? result : PincodeResult.failure(sanitizedPincode, message),
                    message
            ));
        }

        return ResponseEntity.ok(ApiResponse.success(result, result.getMessage() != null ? result.getMessage() : "Location details retrieved for PIN " + sanitizedPincode));
    }
}
