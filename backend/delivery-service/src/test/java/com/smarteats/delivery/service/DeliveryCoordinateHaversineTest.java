package com.smarteats.delivery.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.delivery.dto.DeliveryResponse;
import com.smarteats.delivery.entity.Delivery;
import com.smarteats.delivery.entity.DeliveryPartner;
import com.smarteats.delivery.entity.DeliveryStatus;
import com.smarteats.delivery.repository.DeliveryPartnerRepository;
import com.smarteats.delivery.repository.DeliveryRepository;
import com.smarteats.delivery.strategy.HaversineAssignmentStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class DeliveryCoordinateHaversineTest {

    @Mock
    private DeliveryRepository deliveryRepository;

    @Mock
    private DeliveryPartnerRepository partnerRepository;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Captor
    private ArgumentCaptor<Delivery> deliveryCaptor;

    private HaversineAssignmentStrategy assignmentStrategy;
    private DeliveryServiceImpl deliveryService;

    // Real test coordinates
    // Restaurant: Whitefield (12.9698, 77.7500)
    private final double whitefieldRestLat = 12.9698;
    private final double whitefieldRestLng = 77.7500;
    // Customer delivery location: ITPL (12.9860, 77.7340)
    private final double itplCustLat = 12.9860;
    private final double itplCustLng = 77.7340;

    @BeforeEach
    void setUp() {
        assignmentStrategy = new HaversineAssignmentStrategy();
        deliveryService = new DeliveryServiceImpl(
                deliveryRepository,
                partnerRepository,
                assignmentStrategy,
                kafkaTemplate
        );
    }

    @Test
    @DisplayName("TEST 7: Delivery Service creates pending delivery with real coordinates and Haversine matches nearest driver")
    void testRealCoordinatesStoredAndMatchedViaHaversine() {
        // Arrange 2 drivers:
        // Rider 1: in Whitefield near restaurant (12.9710, 77.7480) ~ 0.25 km from restaurant
        DeliveryPartner nearRider = DeliveryPartner.builder()
                .id("rider_near")
                .name("Near Rider")
                .email("near.rider@smarteats.com")
                .latitude(12.9710)
                .longitude(77.7480)
                .active(true)
                .available(true)
                .build();

        // Rider 2: in Indiranagar far from restaurant (12.9716, 77.5946) ~ 16 km from restaurant
        DeliveryPartner farRider = DeliveryPartner.builder()
                .id("rider_far")
                .name("Far Rider")
                .email("far.rider@smarteats.com")
                .latitude(12.9716)
                .longitude(77.5946)
                .active(true)
                .available(true)
                .build();

        when(deliveryRepository.findByOrderId("ord_step8_live")).thenReturn(Optional.empty());
        when(partnerRepository.findByActiveAndAvailable(true, true)).thenReturn(List.of(farRider, nearRider));

        when(deliveryRepository.save(any(Delivery.class))).thenAnswer(inv -> {
            Delivery d = inv.getArgument(0);
            if (d.getId() == null) d.setId("del_step8_001");
            return d;
        });
        when(deliveryRepository.findById("del_step8_001")).thenAnswer(inv -> {
            Delivery d = Delivery.builder()
                    .id("del_step8_001")
                    .orderId("ord_step8_live")
                    .restaurantId("rest_whitefield_1")
                    .customerEmail("customer@smarteats.com")
                    .status(DeliveryStatus.PENDING)
                    .restaurantLatitude(whitefieldRestLat)
                    .restaurantLongitude(whitefieldRestLng)
                    .deliveryLatitude(itplCustLat)
                    .deliveryLongitude(itplCustLng)
                    .build();
            return Optional.of(d);
        });

        // Act
        DeliveryResponse response = deliveryService.createPendingDelivery(
                "ord_step8_live",
                "rest_whitefield_1",
                "customer@smarteats.com",
                whitefieldRestLat,
                whitefieldRestLng,
                itplCustLat,
                itplCustLng
        );

        // Assert
        assertNotNull(response);
        assertEquals(whitefieldRestLat, response.getRestaurantLatitude());
        assertEquals(whitefieldRestLng, response.getRestaurantLongitude());
        assertEquals(itplCustLat, response.getDeliveryLatitude());
        assertEquals(itplCustLng, response.getDeliveryLongitude());

        // Verify Haversine selected the nearer driver (nearRider)
        verify(partnerRepository).findByActiveAndAvailable(true, true);
        verify(deliveryRepository, atLeastOnce()).save(deliveryCaptor.capture());

        Delivery finalSaved = deliveryCaptor.getValue();
        assertEquals(DeliveryStatus.ASSIGNED, finalSaved.getStatus());
        assertEquals("near.rider@smarteats.com", finalSaved.getDeliveryPartnerEmail(),
                "Haversine must select the closer driver based on real restaurant coordinates");
    }

    @Test
    @DisplayName("TEST 8: Invalid coordinates (0,0 or out of bounds) reject delivery creation without fallback")
    void testInvalidCoordinatesRejectDeliveryCreation() {
        when(deliveryRepository.findByOrderId("ord_invalid_coords")).thenReturn(Optional.empty());

        // Test 0,0 coordinates
        BadRequestException ex1 = assertThrows(BadRequestException.class, () -> {
            deliveryService.createPendingDelivery(
                    "ord_invalid_coords",
                    "rest_1",
                    "cust@smarteats.com",
                    0.0, 0.0, 12.98, 77.73
            );
        });
        assertTrue(ex1.getMessage().contains("Invalid restaurant coordinates"));

        // Test out-of-bounds coordinates (> 90.0)
        BadRequestException ex2 = assertThrows(BadRequestException.class, () -> {
            deliveryService.createPendingDelivery(
                    "ord_invalid_coords",
                    "rest_1",
                    "cust@smarteats.com",
                    12.96, 77.75, 95.0, 77.73
            );
        });
        assertTrue(ex2.getMessage().contains("Invalid delivery coordinates"));

        // Verify 3-arg overload without coordinates rejects
        BadRequestException ex3 = assertThrows(BadRequestException.class, () -> {
            deliveryService.createPendingDelivery("ord_no_coords", "rest_1", "cust@smarteats.com");
        });
        assertTrue(ex3.getMessage().contains("requires explicit restaurant and delivery coordinates"));

        verify(deliveryRepository, never()).save(any(Delivery.class));
    }
}
