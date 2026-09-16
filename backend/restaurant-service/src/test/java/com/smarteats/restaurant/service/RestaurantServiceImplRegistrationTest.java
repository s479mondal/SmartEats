package com.smarteats.restaurant.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.geocoding.GeocodingResult;
import com.smarteats.common.geocoding.GeocodingService;
import com.smarteats.restaurant.dto.RestaurantRequest;
import com.smarteats.restaurant.dto.RestaurantResponse;
import com.smarteats.restaurant.entity.Restaurant;
import com.smarteats.restaurant.repository.MenuItemRepository;
import com.smarteats.restaurant.repository.ProfileChangeRequestRepository;
import com.smarteats.restaurant.repository.RestaurantRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RestaurantServiceImplRegistrationTest {

    @Mock
    private RestaurantRepository restaurantRepository;

    @Mock
    private MenuItemRepository menuItemRepository;

    @Mock
    private ProfileChangeRequestRepository profileChangeRequestRepository;

    @Mock
    private GeocodingService geocodingService;

    @InjectMocks
    private RestaurantServiceImpl restaurantService;

    @Test
    void testRegisterRestaurantGeocodingSuccess() {
        RestaurantRequest request = RestaurantRequest.builder()
                .name("Artisan Pizza Hub")
                .address("Indiranagar 100ft Rd")
                .city("Bengaluru")
                .pincode("560038")
                .cuisineType("Italian")
                .build();

        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.success(12.9716, 77.5946, "Indiranagar 100ft Rd, Bengaluru 560038", "OpenStreetMap-Nominatim"));

        when(restaurantRepository.save(any(Restaurant.class))).thenAnswer(invocation -> {
            Restaurant r = invocation.getArgument(0);
            r.setId("rest_101");
            return r;
        });

        RestaurantResponse response = restaurantService.registerRestaurant(request, "owner@smarteats.com");

        assertNotNull(response);
        assertEquals("Artisan Pizza Hub", response.getName());
        assertEquals(12.9716, response.getLatitude());
        assertEquals(77.5946, response.getLongitude());
        verify(geocodingService, times(1)).geocodeAddress(contains("Indiranagar"));
    }

    @Test
    void testRegisterRestaurantGeocodingFailureRejection() {
        RestaurantRequest request = RestaurantRequest.builder()
                .name("Invalid Kitchen")
                .address("NonExistentAddressXYZ999")
                .city("Unknown")
                .build();

        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.failure("No geocoding result found for address", "OpenStreetMap-Nominatim"));

        BadRequestException ex = assertThrows(BadRequestException.class, () -> restaurantService.registerRestaurant(request, "owner@smarteats.com"));

        assertTrue(ex.getMessage().contains("Restaurant address verification failed"));
        verify(restaurantRepository, never()).save(any(Restaurant.class));
    }

    @Test
    void testRegisterRestaurantClientSuppliedCoordinatesDoesNotBypassGeocoding() {
        // Client sends spoofed coordinates (1.0, 2.0) along with a valid physical restaurant address
        RestaurantRequest request = RestaurantRequest.builder()
                .name("Artisan Pizza Hub")
                .address("Indiranagar 100ft Rd")
                .city("Bengaluru")
                .pincode("560038")
                .latitude(1.0)
                .longitude(2.0)
                .cuisineType("Italian")
                .build();

        // Geocoding resolves real coordinates (12.9716, 77.5946)
        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.success(12.9716, 77.5946, "Indiranagar 100ft Rd, Bengaluru 560038", "OpenStreetMap-Nominatim"));

        when(restaurantRepository.save(any(Restaurant.class))).thenAnswer(invocation -> {
            Restaurant r = invocation.getArgument(0);
            r.setId("rest_spoof_1");
            return r;
        });

        RestaurantResponse response = restaurantService.registerRestaurant(request, "owner@smarteats.com");

        assertNotNull(response);
        // Authoritative geocoding MUST overwrite client's spoofed coordinates
        assertEquals(12.9716, response.getLatitude());
        assertEquals(77.5946, response.getLongitude());
        assertNotEquals(1.0, response.getLatitude());
        assertNotEquals(2.0, response.getLongitude());
        verify(geocodingService, times(1)).geocodeAddress(contains("Indiranagar"));
    }
}
