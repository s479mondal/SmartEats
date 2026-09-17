package com.smarteats.auth.controller;

import com.smarteats.common.dto.ApiResponse;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.geocoding.GeocodingService;
import com.smarteats.common.geocoding.LocationSearchResult;
import com.smarteats.common.geocoding.ReverseGeocodingResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LocationControllerTest {

    @Mock
    private GeocodingService geocodingService;

    @InjectMocks
    private LocationController locationController;

    private LocationSearchResult candidate1;
    private LocationSearchResult fallbackCandidate;

    @BeforeEach
    void setUp() {
        candidate1 = LocationSearchResult.builder()
                .displayName("Kaliganj, Nadia, West Bengal, India")
                .latitude(23.7149)
                .longitude(88.2899)
                .isParentArea(false)
                .matchedQuery("Kaliganj, Nadia")
                .addressDetails(Map.of("county", "Nadia", "state", "West Bengal"))
                .build();

        fallbackCandidate = LocationSearchResult.builder()
                .displayName("Kaliganj, Nadia, West Bengal, 741150, India")
                .latitude(23.7276)
                .longitude(88.2294)
                .isParentArea(true)
                .matchedQuery("Kaliganj, Nadia")
                .addressDetails(Map.of("postcode", "741150"))
                .build();
    }

    @Test
    @DisplayName("Valid search returns candidate list with HTTP 200")
    void testSearchLocationSuccess() {
        when(geocodingService.searchAddress("Kaliganj, Nadia")).thenReturn(List.of(candidate1));

        ResponseEntity<ApiResponse<List<LocationSearchResult>>> response = 
                locationController.searchLocation("Kaliganj, Nadia");

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().isSuccess());
        assertEquals(1, response.getBody().getData().size());
        assertEquals("Kaliganj, Nadia, West Bengal, India", response.getBody().getData().get(0).getDisplayName());
        assertFalse(response.getBody().getData().get(0).isParentArea());
        verify(geocodingService, times(1)).searchAddress("Kaliganj, Nadia");
    }

    @Test
    @DisplayName("Search for unindexed village returns fallback parent candidates")
    void testSearchLocationFallbackCandidates() {
        when(geocodingService.searchAddress("Harinathpur, Kaliganj, Nadia")).thenReturn(List.of(fallbackCandidate));

        ResponseEntity<ApiResponse<List<LocationSearchResult>>> response = 
                locationController.searchLocation("Harinathpur, Kaliganj, Nadia");

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().isSuccess());
        assertEquals(1, response.getBody().getData().size());
        assertTrue(response.getBody().getData().get(0).isParentArea());
        assertEquals("Kaliganj, Nadia", response.getBody().getData().get(0).getMatchedQuery());
        verify(geocodingService, times(1)).searchAddress("Harinathpur, Kaliganj, Nadia");
    }

    @Test
    @DisplayName("Blank query returns HTTP 400 Bad Request")
    void testSearchLocationBlankQueryBadRequest() {
        assertThrows(BadRequestException.class, () -> locationController.searchLocation(null));
        assertThrows(BadRequestException.class, () -> locationController.searchLocation("   "));
        verify(geocodingService, never()).searchAddress(anyString());
    }

    @Test
    @DisplayName("Extremely long query returns HTTP 400 Bad Request")
    void testSearchLocationLongQueryBadRequest() {
        String longQuery = "A".repeat(300);
        assertThrows(BadRequestException.class, () -> locationController.searchLocation(longQuery));
        verify(geocodingService, never()).searchAddress(anyString());
    }

    @Test
    @DisplayName("Search returning zero results gives HTTP 200 with empty list")
    void testSearchLocationZeroResults() {
        when(geocodingService.searchAddress("UnknownNonExistentXYZ999")).thenReturn(Collections.emptyList());

        ResponseEntity<ApiResponse<List<LocationSearchResult>>> response = 
                locationController.searchLocation("UnknownNonExistentXYZ999");

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().isSuccess());
        assertTrue(response.getBody().getData().isEmpty());
    }

    @Test
    @DisplayName("Valid reverse geocoding returns location details with HTTP 200")
    void testReverseGeocodeSuccess() {
        ReverseGeocodingResult reverseResult = ReverseGeocodingResult.success(
                23.7276,
                88.2294,
                "Plassey Kaliganj Road, Kaliganj, Nadia, West Bengal, 741150, India",
                Map.of("state", "West Bengal", "postcode", "741150")
        );

        when(geocodingService.reverseGeocode(23.7276, 88.2294)).thenReturn(reverseResult);

        ResponseEntity<ApiResponse<ReverseGeocodingResult>> response = 
                locationController.reverseGeocode(23.7276, 88.2294);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().isSuccess());
        assertEquals("Plassey Kaliganj Road, Kaliganj, Nadia, West Bengal, 741150, India", response.getBody().getData().getFormattedAddress());
        verify(geocodingService, times(1)).reverseGeocode(23.7276, 88.2294);
    }

    @Test
    @DisplayName("Reverse geocoding with null coordinates throws HTTP 400 Bad Request")
    void testReverseGeocodeNullCoordinatesBadRequest() {
        assertThrows(BadRequestException.class, () -> locationController.reverseGeocode(null, 88.2294));
        assertThrows(BadRequestException.class, () -> locationController.reverseGeocode(23.7276, null));
        verify(geocodingService, never()).reverseGeocode(anyDouble(), anyDouble());
    }

    @Test
    @DisplayName("Reverse geocoding with out-of-bounds coordinates throws HTTP 400 Bad Request")
    void testReverseGeocodeOutOfBoundsBadRequest() {
        assertThrows(BadRequestException.class, () -> locationController.reverseGeocode(100.0, 88.2294));
        assertThrows(BadRequestException.class, () -> locationController.reverseGeocode(23.7276, 200.0));
        verify(geocodingService, never()).reverseGeocode(anyDouble(), anyDouble());
    }
}
