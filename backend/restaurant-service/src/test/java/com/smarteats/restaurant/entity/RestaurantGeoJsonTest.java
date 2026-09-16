package com.smarteats.restaurant.entity;

import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;

import static org.junit.jupiter.api.Assertions.*;

class RestaurantGeoJsonTest {

    @Test
    void testGeoJsonPointGenerationValidCoordinates() {
        Restaurant restaurant = Restaurant.builder()
                .name("Koramangala Kitchen")
                .latitude(12.9352)
                .longitude(77.6245)
                .build();

        restaurant.syncGeoLocation();

        assertNotNull(restaurant.getGeoLocation());
        assertEquals("Point", restaurant.getGeoLocation().getType());
        // Verify coordinate order: [LONGITUDE, LATITUDE]
        assertEquals(77.6245, restaurant.getGeoLocation().getX(), 0.0001);
        assertEquals(12.9352, restaurant.getGeoLocation().getY(), 0.0001);
        assertEquals(77.6245, restaurant.getGeoLocation().getCoordinates().get(0), 0.0001);
        assertEquals(12.9352, restaurant.getGeoLocation().getCoordinates().get(1), 0.0001);
    }

    @Test
    void testGeoJsonPointNullWhenCoordinatesMissing() {
        Restaurant restaurantMissingLat = Restaurant.builder()
                .name("No Lat Kitchen")
                .longitude(77.6245)
                .build();
        restaurantMissingLat.syncGeoLocation();
        assertNull(restaurantMissingLat.getGeoLocation());

        Restaurant restaurantMissingLon = Restaurant.builder()
                .name("No Lon Kitchen")
                .latitude(12.9352)
                .build();
        restaurantMissingLon.syncGeoLocation();
        assertNull(restaurantMissingLon.getGeoLocation());
    }

    @Test
    void testGeoJsonPointNullWhenCoordinatesOutOfBounds() {
        Restaurant invalidLat = Restaurant.builder()
                .name("Invalid Lat")
                .latitude(95.0)
                .longitude(77.6245)
                .build();
        invalidLat.syncGeoLocation();
        assertNull(invalidLat.getGeoLocation());

        Restaurant invalidLon = Restaurant.builder()
                .name("Invalid Lon")
                .latitude(12.9352)
                .longitude(-190.0)
                .build();
        invalidLon.syncGeoLocation();
        assertNull(invalidLon.getGeoLocation());
    }

    @Test
    void testGeoJsonSynchronizationOnCoordinateUpdate() {
        Restaurant restaurant = Restaurant.builder()
                .name("Updating Kitchen")
                .latitude(12.9716)
                .longitude(77.5946)
                .build();
        restaurant.syncGeoLocation();

        assertEquals(77.5946, restaurant.getGeoLocation().getX(), 0.0001);

        // Update coordinates
        restaurant.setLatitude(13.0827);
        restaurant.setLongitude(80.2707);
        restaurant.syncGeoLocation();

        assertEquals(80.2707, restaurant.getGeoLocation().getX(), 0.0001);
        assertEquals(13.0827, restaurant.getGeoLocation().getY(), 0.0001);
    }
}
