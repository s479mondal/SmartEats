package com.smarteats.restaurant.service;

import com.smarteats.restaurant.dto.RestaurantResponse;
import com.smarteats.restaurant.entity.Restaurant;
import com.smarteats.restaurant.repository.MenuItemRepository;
import com.smarteats.restaurant.repository.ProfileChangeRequestRepository;
import com.smarteats.restaurant.repository.RestaurantRepository;
import com.smarteats.restaurant.util.RestaurantOperatingHoursUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RestaurantOperatingHoursApiTest {

    @Mock
    private RestaurantRepository restaurantRepository;

    @Mock
    private MenuItemRepository menuItemRepository;

    @Mock
    private ProfileChangeRequestRepository profileChangeRequestRepository;

    private static final ZoneId IST = RestaurantOperatingHoursUtil.ZONE_ASIA_KOLKATA;

    @Test
    @DisplayName("API TEST: Restaurant open status dynamically evaluates to TRUE during open hours")
    void testRestaurantOpenDuringOperatingHours() {
        // 2026-09-18T14:30:00+05:30 (2:30 PM IST)
        Instant instant = Instant.parse("2026-09-18T09:00:00Z"); // 09:00 UTC = 14:30 IST
        Clock fixedClock = Clock.fixed(instant, IST);

        RestaurantServiceImpl service = new RestaurantServiceImpl(
                restaurantRepository,
                menuItemRepository,
                profileChangeRequestRepository,
                null,
                fixedClock
        );

        Restaurant restaurant = Restaurant.builder()
                .id("rest_test_1")
                .name("Kolkata Biryani Hub")
                .openingTime("10:00 AM")
                .closingTime("11:00 PM")
                .open(true)
                .approved(true)
                .status("ACTIVE")
                .build();

        when(restaurantRepository.findById("rest_test_1")).thenReturn(Optional.of(restaurant));

        RestaurantResponse response = service.getRestaurantById("rest_test_1");

        assertNotNull(response);
        assertTrue(response.isOpen(), "Restaurant must be dynamically calculated as open at 2:30 PM");
    }

    @Test
    @DisplayName("API TEST: Restaurant open status dynamically evaluates to FALSE outside open hours")
    void testRestaurantClosedOutsideOperatingHours() {
        // 2026-09-18T23:30:00+05:30 (11:30 PM IST)
        Instant instant = Instant.parse("2026-09-18T18:00:00Z"); // 18:00 UTC = 23:30 IST
        Clock fixedClock = Clock.fixed(instant, IST);

        RestaurantServiceImpl service = new RestaurantServiceImpl(
                restaurantRepository,
                menuItemRepository,
                profileChangeRequestRepository,
                null,
                fixedClock
        );

        Restaurant restaurant = Restaurant.builder()
                .id("rest_test_2")
                .name("Kolkata Biryani Hub")
                .openingTime("10:00 AM")
                .closingTime("11:00 PM")
                .open(true)
                .approved(true)
                .status("ACTIVE")
                .build();

        when(restaurantRepository.findById("rest_test_2")).thenReturn(Optional.of(restaurant));

        RestaurantResponse response = service.getRestaurantById("rest_test_2");

        assertNotNull(response);
        assertFalse(response.isOpen(), "Restaurant must be dynamically calculated as closed at 11:30 PM");
    }

    @Test
    @DisplayName("API TEST: Overnight operating hours evaluate accurately across midnight")
    void testOvernightRestaurantEvaluation() {
        // 2026-09-18T00:30:00+05:30 (12:30 AM IST) -> inside 10:00 PM to 2:00 AM
        Instant midnightSpan = Instant.parse("2026-09-17T19:00:00Z"); // 19:00 UTC = 00:30 IST next day
        Clock fixedClock = Clock.fixed(midnightSpan, IST);

        RestaurantServiceImpl service = new RestaurantServiceImpl(
                restaurantRepository,
                menuItemRepository,
                profileChangeRequestRepository,
                null,
                fixedClock
        );

        Restaurant restaurant = Restaurant.builder()
                .id("rest_overnight")
                .name("Midnight Diner")
                .openingTime("10:00 PM")
                .closingTime("2:00 AM")
                .open(true)
                .approved(true)
                .status("ACTIVE")
                .build();

        when(restaurantRepository.findById("rest_overnight")).thenReturn(Optional.of(restaurant));

        RestaurantResponse response = service.getRestaurantById("rest_overnight");

        assertNotNull(response);
        assertTrue(response.isOpen(), "Overnight restaurant must be open at 12:30 AM");
    }
}
