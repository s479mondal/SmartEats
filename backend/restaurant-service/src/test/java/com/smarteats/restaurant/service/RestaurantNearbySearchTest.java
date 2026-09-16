package com.smarteats.restaurant.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.geocoding.GeocodingService;
import com.smarteats.restaurant.dto.RestaurantResponse;
import com.smarteats.restaurant.entity.Restaurant;
import com.smarteats.restaurant.repository.MenuItemRepository;
import com.smarteats.restaurant.repository.ProfileChangeRequestRepository;
import com.smarteats.restaurant.repository.RestaurantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.geo.*;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RestaurantNearbySearchTest {

    @Mock
    private RestaurantRepository restaurantRepository;

    @Mock
    private MenuItemRepository menuItemRepository;

    @Mock
    private ProfileChangeRequestRepository profileChangeRequestRepository;

    @Mock
    private GeocodingService geocodingService;

    private RestaurantServiceImpl restaurantService;

    @BeforeEach
    void setUp() {
        restaurantService = new RestaurantServiceImpl(
                restaurantRepository,
                menuItemRepository,
                profileChangeRequestRepository,
                geocodingService
        );
    }

    @Test
    void testValidCoordinatesAndRadiusReturnsNearbyRestaurantsSortedByDistance() {
        Double customerLat = 12.9716;
        Double customerLng = 77.5946;
        Double radiusKm = 10.0;

        Restaurant restNear = Restaurant.builder()
                .id("rest_1")
                .name("Near Bistro")
                .approved(true)
                .latitude(12.9720)
                .longitude(77.5950)
                .geoLocation(new GeoJsonPoint(77.5950, 12.9720))
                .build();

        Restaurant restFarther = Restaurant.builder()
                .id("rest_2")
                .name("Farther Cafe")
                .approved(true)
                .latitude(12.9800)
                .longitude(77.6000)
                .geoLocation(new GeoJsonPoint(77.6000, 12.9800))
                .build();

        // Intentionally deliver in reverse order to verify sorting logic
        when(restaurantRepository.findByApprovedTrueAndGeoLocationNear(any(Point.class), any(Distance.class)))
                .thenReturn(List.of(restFarther, restNear));

        List<RestaurantResponse> responses = restaurantService.findNearbyRestaurants(customerLat, customerLng, radiusKm);

        assertNotNull(responses);
        assertEquals(2, responses.size());

        // Nearest should be first
        assertEquals("Near Bistro", responses.get(0).getName());
        assertTrue(responses.get(0).getDistanceKm() < responses.get(1).getDistanceKm());

        // Farther should be second
        assertEquals("Farther Cafe", responses.get(1).getName());
    }

    @Test
    void testCoordinateOrderingStrictlyLongitudeThenLatitude() {
        Double customerLat = 12.9352;
        Double customerLng = 77.6245;

        when(restaurantRepository.findByApprovedTrueAndGeoLocationNear(any(Point.class), any(Distance.class)))
                .thenReturn(Collections.emptyList());

        restaurantService.findNearbyRestaurants(customerLat, customerLng, 5.0);

        ArgumentCaptor<Point> pointCaptor = ArgumentCaptor.forClass(Point.class);
        ArgumentCaptor<Distance> distanceCaptor = ArgumentCaptor.forClass(Distance.class);

        verify(restaurantRepository, times(1))
                .findByApprovedTrueAndGeoLocationNear(pointCaptor.capture(), distanceCaptor.capture());

        Point capturedPoint = pointCaptor.getValue();
        // Point(x, y) where x = longitude, y = latitude
        assertEquals(77.6245, capturedPoint.getX(), 0.0001, "X coordinate must be Longitude");
        assertEquals(12.9352, capturedPoint.getY(), 0.0001, "Y coordinate must be Latitude");

        Distance capturedDistance = distanceCaptor.getValue();
        assertEquals(5.0, capturedDistance.getValue(), 0.0001);
        assertEquals(Metrics.KILOMETERS, capturedDistance.getMetric());
    }

    @Test
    void testNoNearbyRestaurantsReturnsEmptyListSuccessfully() {
        when(restaurantRepository.findByApprovedTrueAndGeoLocationNear(any(Point.class), any(Distance.class)))
                .thenReturn(Collections.emptyList());

        List<RestaurantResponse> responses = restaurantService.findNearbyRestaurants(12.9716, 77.5946, 5.0);

        assertNotNull(responses);
        assertTrue(responses.isEmpty());
    }

    @Test
    void testInvalidLatitudeThrowsBadRequestException() {
        // Out of range > 90
        BadRequestException ex1 = assertThrows(BadRequestException.class,
                () -> restaurantService.findNearbyRestaurants(95.0, 77.5946, 5.0));
        assertTrue(ex1.getMessage().contains("Invalid latitude"));

        // Out of range < -90
        BadRequestException ex2 = assertThrows(BadRequestException.class,
                () -> restaurantService.findNearbyRestaurants(-91.0, 77.5946, 5.0));
        assertTrue(ex2.getMessage().contains("Invalid latitude"));

        // Missing latitude
        BadRequestException ex3 = assertThrows(BadRequestException.class,
                () -> restaurantService.findNearbyRestaurants(null, 77.5946, 5.0));
        assertTrue(ex3.getMessage().contains("Latitude is required"));
    }

    @Test
    void testInvalidLongitudeThrowsBadRequestException() {
        // Out of range > 180
        BadRequestException ex1 = assertThrows(BadRequestException.class,
                () -> restaurantService.findNearbyRestaurants(12.9716, 185.0, 5.0));
        assertTrue(ex1.getMessage().contains("Invalid longitude"));

        // Out of range < -180
        BadRequestException ex2 = assertThrows(BadRequestException.class,
                () -> restaurantService.findNearbyRestaurants(12.9716, -185.0, 5.0));
        assertTrue(ex2.getMessage().contains("Invalid longitude"));

        // Missing longitude
        BadRequestException ex3 = assertThrows(BadRequestException.class,
                () -> restaurantService.findNearbyRestaurants(12.9716, null, 5.0));
        assertTrue(ex3.getMessage().contains("Longitude is required"));
    }

    @Test
    void testInvalidRadiusThrowsBadRequestException() {
        // Zero radius
        BadRequestException ex1 = assertThrows(BadRequestException.class,
                () -> restaurantService.findNearbyRestaurants(12.9716, 77.5946, 0.0));
        assertTrue(ex1.getMessage().contains("Invalid radius"));

        // Negative radius
        BadRequestException ex2 = assertThrows(BadRequestException.class,
                () -> restaurantService.findNearbyRestaurants(12.9716, 77.5946, -2.5));
        assertTrue(ex2.getMessage().contains("Invalid radius"));

        // Exceeds max radius (50 km)
        BadRequestException ex3 = assertThrows(BadRequestException.class,
                () -> restaurantService.findNearbyRestaurants(12.9716, 77.5946, 75.0));
        assertTrue(ex3.getMessage().contains("Maximum allowable search radius"));
    }

    @Test
    void testDefaultRadiusAppliedWhenNull() {
        when(restaurantRepository.findByApprovedTrueAndGeoLocationNear(any(Point.class), any(Distance.class)))
                .thenReturn(Collections.emptyList());

        restaurantService.findNearbyRestaurants(12.9716, 77.5946, null);

        ArgumentCaptor<Distance> distanceCaptor = ArgumentCaptor.forClass(Distance.class);
        verify(restaurantRepository).findByApprovedTrueAndGeoLocationNear(any(Point.class), distanceCaptor.capture());

        assertEquals(RestaurantServiceImpl.DEFAULT_RADIUS_KM, distanceCaptor.getValue().getValue());
    }

    @Test
    void testNullCoordinatesHandledSafely() {
        Restaurant restWithNullCoords = Restaurant.builder()
                .id("rest_null")
                .name("Null Coords Diner")
                .approved(true)
                .latitude(null)
                .longitude(null)
                .geoLocation(null)
                .build();

        when(restaurantRepository.findByApprovedTrueAndGeoLocationNear(any(Point.class), any(Distance.class)))
                .thenReturn(List.of(restWithNullCoords));

        List<RestaurantResponse> responses = restaurantService.findNearbyRestaurants(12.9716, 77.5946, 5.0);

        assertNotNull(responses);
        assertEquals(1, responses.size());
        assertEquals("Null Coords Diner", responses.get(0).getName());
        assertEquals(0.0, responses.get(0).getDistanceKm());
    }
}
