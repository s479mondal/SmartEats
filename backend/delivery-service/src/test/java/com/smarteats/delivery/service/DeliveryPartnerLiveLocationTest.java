package com.smarteats.delivery.service;

import com.smarteats.common.dto.ApiResponse;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.delivery.controller.DeliveryController;
import com.smarteats.delivery.dto.DeliveryLocationUpdateRequest;
import com.smarteats.delivery.dto.DeliveryPartnerResponse;
import com.smarteats.delivery.entity.DeliveryPartner;
import com.smarteats.delivery.repository.DeliveryPartnerRepository;
import com.smarteats.delivery.repository.DeliveryRepository;
import com.smarteats.delivery.strategy.DeliveryAssignmentStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class DeliveryPartnerLiveLocationTest {

    @Mock
    private DeliveryRepository deliveryRepository;

    @Mock
    private DeliveryPartnerRepository partnerRepository;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Mock
    private DeliveryAssignmentStrategy assignmentStrategy;

    @InjectMocks
    private DeliveryServiceImpl deliveryService;

    private DeliveryController deliveryController;

    private final String DRIVER_EMAIL = "driver_live_test@smarteats.com";
    private final String ATTACKER_DRIVER_EMAIL = "driver_attacker@smarteats.com";

    private DeliveryPartner testPartner;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(deliveryService, "deliveryAssignedTopic", "smarteats.delivery.assigned");
        ReflectionTestUtils.setField(deliveryService, "orderDeliveredTopic", "smarteats.order.delivered");

        deliveryController = new DeliveryController(deliveryService);

        testPartner = DeliveryPartner.builder()
                .id("PARTNER-101")
                .name("Ramesh Driver")
                .email(DRIVER_EMAIL)
                .phone("9876543210")
                .baseAddress("Indiranagar 100ft Road, Bengaluru")
                .city("Bengaluru")
                .state("Karnataka")
                .pincode("560038")
                .baseLatitude(12.9784)
                .baseLongitude(77.6408)
                .latitude(12.9784)
                .longitude(77.6408)
                .currentLatitude(null)
                .currentLongitude(null)
                .lastLocationUpdate(null)
                .locationAccuracyMeters(null)
                .active(true)
                .available(true)
                .build();
    }

    @Test
    @DisplayName("TEST 1: Valid live GPS update -> HTTP 200, current coords and server timestamp persisted, base coords invariant")
    void test1_ValidLocationUpdate_Success() {
        when(partnerRepository.findFirstByEmail(DRIVER_EMAIL)).thenReturn(Optional.of(testPartner));
        when(partnerRepository.save(any(DeliveryPartner.class))).thenAnswer(inv -> inv.getArgument(0));

        DeliveryLocationUpdateRequest request = DeliveryLocationUpdateRequest.builder()
                .latitude(12.9352)
                .longitude(77.6245)
                .accuracy(5.5)
                .build();

        ResponseEntity<ApiResponse<DeliveryPartnerResponse>> responseEntity =
                deliveryController.updateLocation(request, DRIVER_EMAIL, "DELIVERY_PARTNER");

        assertEquals(HttpStatus.OK, responseEntity.getStatusCode());
        assertNotNull(responseEntity.getBody());
        DeliveryPartnerResponse resp = responseEntity.getBody().getData();

        // 1. Live coordinates updated
        assertEquals(12.9352, resp.getCurrentLatitude());
        assertEquals(77.6245, resp.getCurrentLongitude());
        assertEquals(5.5, resp.getLocationAccuracyMeters());
        assertNotNull(resp.getLastLocationUpdate());

        // 2. Base coordinates strictly preserved and invariant
        assertEquals(12.9784, resp.getBaseLatitude());
        assertEquals(77.6408, resp.getBaseLongitude());
        assertEquals("Indiranagar 100ft Road, Bengaluru", resp.getBaseAddress());

        // 3. Verify server-side timestamp generation
        assertTrue(resp.getLastLocationUpdate().isAfter(LocalDateTime.now().minusMinutes(1)));
        assertTrue(resp.getLastLocationUpdate().isBefore(LocalDateTime.now().plusSeconds(5)));

        verify(partnerRepository, times(1)).save(testPartner);
    }

    @Test
    @DisplayName("TEST 2: Null accuracy is allowed -> Defaults to null accuracy without failure")
    void test2_NullAccuracy_Allowed() {
        when(partnerRepository.findFirstByEmail(DRIVER_EMAIL)).thenReturn(Optional.of(testPartner));
        when(partnerRepository.save(any(DeliveryPartner.class))).thenAnswer(inv -> inv.getArgument(0));

        DeliveryLocationUpdateRequest request = DeliveryLocationUpdateRequest.builder()
                .latitude(12.9200)
                .longitude(77.6100)
                .accuracy(null)
                .build();

        ResponseEntity<ApiResponse<DeliveryPartnerResponse>> responseEntity =
                deliveryController.updateLocation(request, DRIVER_EMAIL, "DELIVERY_PARTNER");

        assertEquals(HttpStatus.OK, responseEntity.getStatusCode());
        DeliveryPartnerResponse resp = responseEntity.getBody().getData();
        assertEquals(12.9200, resp.getCurrentLatitude());
        assertEquals(77.6100, resp.getCurrentLongitude());
        assertNull(resp.getLocationAccuracyMeters());
        assertNotNull(resp.getLastLocationUpdate());
    }

    @Test
    @DisplayName("TEST 3: Latitude validation -> Out of range (-95 or +95) rejected with 400 Bad Request")
    void test3_InvalidLatitude_Rejected() {
        assertThrows(BadRequestException.class, () ->
                deliveryService.updatePartnerLocation(DRIVER_EMAIL, 95.0, 77.5946, 5.0));

        assertThrows(BadRequestException.class, () ->
                deliveryService.updatePartnerLocation(DRIVER_EMAIL, -95.0, 77.5946, 5.0));
    }

    @Test
    @DisplayName("TEST 4: Longitude validation -> Out of range (-185 or +185) rejected with 400 Bad Request")
    void test4_InvalidLongitude_Rejected() {
        assertThrows(BadRequestException.class, () ->
                deliveryService.updatePartnerLocation(DRIVER_EMAIL, 12.9716, 185.0, 5.0));

        assertThrows(BadRequestException.class, () ->
                deliveryService.updatePartnerLocation(DRIVER_EMAIL, 12.9716, -185.0, 5.0));
    }

    @Test
    @DisplayName("TEST 5: Negative accuracy rejected with 400 Bad Request")
    void test5_NegativeAccuracy_Rejected() {
        assertThrows(BadRequestException.class, () ->
                deliveryService.updatePartnerLocation(DRIVER_EMAIL, 12.9716, 77.5946, -1.0));
    }

    @Test
    @DisplayName("TEST 6: Null or NaN/Infinite coordinates rejected with 400 Bad Request")
    void test6_NullOrNaNCoordinates_Rejected() {
        assertThrows(BadRequestException.class, () ->
                deliveryService.updatePartnerLocation(DRIVER_EMAIL, null, 77.5946, 5.0));

        assertThrows(BadRequestException.class, () ->
                deliveryService.updatePartnerLocation(DRIVER_EMAIL, 12.9716, null, 5.0));

        assertThrows(BadRequestException.class, () ->
                deliveryService.updatePartnerLocation(DRIVER_EMAIL, Double.NaN, 77.5946, 5.0));

        assertThrows(BadRequestException.class, () ->
                deliveryService.updatePartnerLocation(DRIVER_EMAIL, 12.9716, Double.POSITIVE_INFINITY, 5.0));
    }

    @Test
    @DisplayName("TEST 7: Missing authentication identity -> 401 Unauthorized")
    void test7_MissingAuth_Unauthorized() {
        DeliveryLocationUpdateRequest request = DeliveryLocationUpdateRequest.builder()
                .latitude(12.9716)
                .longitude(77.5946)
                .accuracy(5.0)
                .build();

        assertThrows(UnauthorizedException.class, () ->
                deliveryController.updateLocation(request, null, "DELIVERY_PARTNER"));

        assertThrows(UnauthorizedException.class, () ->
                deliveryController.updateLocation(request, "", "DELIVERY_PARTNER"));
    }

    @Test
    @DisplayName("TEST 8: Non-delivery roles (CUSTOMER / RESTAURANT_OWNER) -> 403 Forbidden")
    void test8_NonDeliveryRoles_Forbidden() {
        DeliveryLocationUpdateRequest request = DeliveryLocationUpdateRequest.builder()
                .latitude(12.9716)
                .longitude(77.5946)
                .accuracy(5.0)
                .build();

        assertThrows(ForbiddenException.class, () ->
                deliveryController.updateLocation(request, "customer@smarteats.com", "CUSTOMER"));

        assertThrows(ForbiddenException.class, () ->
                deliveryController.updateLocation(request, "rest_owner@smarteats.com", "RESTAURANT_OWNER"));
    }

    @Test
    @DisplayName("TEST 9: Cross-driver identity spoofing prevention -> Location is strictly tied to authenticated X-User-Email")
    void test9_CrossDriverIsolation() {
        when(partnerRepository.findFirstByEmail(ATTACKER_DRIVER_EMAIL)).thenReturn(Optional.empty());

        DeliveryLocationUpdateRequest request = DeliveryLocationUpdateRequest.builder()
                .latitude(12.9716)
                .longitude(77.5946)
                .accuracy(5.0)
                .build();

        // If attacker requests with their own header, it only targets attacker's account
        assertThrows(com.smarteats.common.exception.ResourceNotFoundException.class, () ->
                deliveryController.updateLocation(request, ATTACKER_DRIVER_EMAIL, "DELIVERY_PARTNER"));

        // Partner record for DRIVER_EMAIL remains completely untouched
        assertNull(testPartner.getCurrentLatitude());
        assertNull(testPartner.getCurrentLongitude());
    }

    @Test
    @DisplayName("TEST 10: Online/offline state transitions preserve driver assignment eligibility semantics")
    void test10_OnlineOfflineStateTransitions() {
        when(partnerRepository.findFirstByEmail(DRIVER_EMAIL)).thenReturn(Optional.of(testPartner));
        when(partnerRepository.save(any(DeliveryPartner.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. Driver goes OFFLINE
        DeliveryPartnerResponse offlineResp = deliveryService.updatePartnerAvailability(DRIVER_EMAIL, false, false);
        assertFalse(offlineResp.isActive());
        assertFalse(offlineResp.isAvailable());

        // 2. Driver goes ONLINE
        DeliveryPartnerResponse onlineResp = deliveryService.updatePartnerAvailability(DRIVER_EMAIL, true, true);
        assertTrue(onlineResp.isActive());
        assertTrue(onlineResp.isAvailable());
    }
}
