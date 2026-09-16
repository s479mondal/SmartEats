package com.smarteats.restaurant.controller;

import com.smarteats.common.dto.ApiResponse;
import com.smarteats.restaurant.dto.RestaurantResponse;
import com.smarteats.restaurant.service.RestaurantService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RestaurantControllerNearbyTest {

    @Mock
    private RestaurantService restaurantService;

    private RestaurantController restaurantController;

    @BeforeEach
    void setUp() {
        restaurantController = new RestaurantController(restaurantService);
    }

    @Test
    void testGetNearbySuccess() {
        RestaurantResponse response = RestaurantResponse.builder()
                .id("rest_1")
                .name("Pizza Corner")
                .latitude(12.9716)
                .longitude(77.5946)
                .distanceKm(1.5)
                .build();

        when(restaurantService.findNearbyRestaurants(12.9716, 77.5946, 5.0))
                .thenReturn(List.of(response));

        ResponseEntity<ApiResponse<List<RestaurantResponse>>> result =
                restaurantController.getNearby(12.9716, 77.5946, 5.0);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertNotNull(result.getBody());
        assertTrue(result.getBody().isSuccess());
        assertEquals(1, result.getBody().getData().size());
        assertEquals("Pizza Corner", result.getBody().getData().get(0).getName());
        assertEquals(1.5, result.getBody().getData().get(0).getDistanceKm());
    }
}
