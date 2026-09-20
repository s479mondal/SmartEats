package com.smarteats.delivery.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.delivery.controller.DeliveryController;
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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class DeliverySecurityTest {

    @Mock
    private DeliveryRepository deliveryRepository;

    @Mock
    private DeliveryPartnerRepository partnerRepository;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Mock
    private HaversineAssignmentStrategy assignmentStrategy;

    @InjectMocks
    private DeliveryServiceImpl deliveryService;

    private DeliveryController deliveryController;

    private final String DRIVER_A_EMAIL = "driverA@smarteats.com";
    private final String DRIVER_B_EMAIL = "driverB@smarteats.com";
    private final String CUSTOMER_EMAIL = "customer@smarteats.com";
    private final String REST_ID = "rest_101";

    private Delivery deliveryA1;
    private Delivery deliveryB1;

    private DeliveryPartner partnerA;
    private DeliveryPartner partnerB;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(deliveryService, "deliveryAssignedTopic", "smarteats.delivery.assigned");
        ReflectionTestUtils.setField(deliveryService, "orderDeliveredTopic", "smarteats.order.delivered");

        deliveryController = new DeliveryController(deliveryService);

        partnerA = DeliveryPartner.builder()
                .id("PARTNER-A")
                .email(DRIVER_A_EMAIL)
                .name("Driver Alpha")
                .active(true)
                .available(true)
                .build();

        partnerB = DeliveryPartner.builder()
                .id("PARTNER-B")
                .email(DRIVER_B_EMAIL)
                .name("Driver Beta")
                .active(true)
                .available(true)
                .build();

        deliveryA1 = Delivery.builder()
                .id("DEL-A1")
                .orderId("ORD-A1")
                .restaurantId(REST_ID)
                .customerEmail(CUSTOMER_EMAIL)
                .deliveryPartnerEmail(DRIVER_A_EMAIL)
                .status(DeliveryStatus.ASSIGNED)
                .build();

        deliveryB1 = Delivery.builder()
                .id("DEL-B1")
                .orderId("ORD-B1")
                .restaurantId(REST_ID)
                .customerEmail(CUSTOMER_EMAIL)
                .deliveryPartnerEmail(DRIVER_B_EMAIL)
                .status(DeliveryStatus.ASSIGNED)
                .build();
    }

    @Test
    @DisplayName("TEST 1: Driver A requests my deliveries -> Only Driver A's deliveries returned")
    void test1_DriverA_Requests_MyDeliveries() {
        when(deliveryRepository.findByDeliveryPartnerEmail(DRIVER_A_EMAIL)).thenReturn(List.of(deliveryA1));

        List<DeliveryResponse> result = deliveryService.getPartnerDeliveries(DRIVER_A_EMAIL);

        assertEquals(1, result.size());
        assertEquals("DEL-A1", result.get(0).getId());
        assertEquals(DRIVER_A_EMAIL, result.get(0).getDeliveryPartnerEmail());
        verify(deliveryRepository, times(1)).findByDeliveryPartnerEmail(DRIVER_A_EMAIL);
    }

    @Test
    @DisplayName("TEST 2: Driver B requests my deliveries -> Only Driver B's deliveries returned")
    void test2_DriverB_Requests_MyDeliveries() {
        when(deliveryRepository.findByDeliveryPartnerEmail(DRIVER_B_EMAIL)).thenReturn(List.of(deliveryB1));

        List<DeliveryResponse> result = deliveryService.getPartnerDeliveries(DRIVER_B_EMAIL);

        assertEquals(1, result.size());
        assertEquals("DEL-B1", result.get(0).getId());
        assertEquals(DRIVER_B_EMAIL, result.get(0).getDeliveryPartnerEmail());
        verify(deliveryRepository, times(1)).findByDeliveryPartnerEmail(DRIVER_B_EMAIL);
    }

    @Test
    @DisplayName("TEST 3: Driver A accesses Driver B's delivery by ID -> 403 Forbidden")
    void test3_DriverA_Accesses_DriverB_Delivery_Forbidden() {
        when(deliveryRepository.findById("DEL-B1")).thenReturn(Optional.of(deliveryB1));

        assertThrows(ForbiddenException.class, () ->
                deliveryService.getDeliveryById("DEL-B1", DRIVER_A_EMAIL, "DELIVERY_PARTNER"));
    }

    @Test
    @DisplayName("TEST 4: Driver B accesses Driver A's delivery by ID -> 403 Forbidden")
    void test4_DriverB_Accesses_DriverA_Delivery_Forbidden() {
        when(deliveryRepository.findById("DEL-A1")).thenReturn(Optional.of(deliveryA1));

        assertThrows(ForbiddenException.class, () ->
                deliveryService.getDeliveryById("DEL-A1", DRIVER_B_EMAIL, "DELIVERY_PARTNER"));
    }

    @Test
    @DisplayName("TEST 5: Driver A attempts to modify Driver B's delivery -> 403 Forbidden & No DB save")
    void test5_DriverA_Modifies_DriverB_Delivery_Forbidden() {
        when(deliveryRepository.findById("DEL-B1")).thenReturn(Optional.of(deliveryB1));

        assertThrows(ForbiddenException.class, () ->
                deliveryService.updateDeliveryStatus("DEL-B1", "PICKED_UP", DRIVER_A_EMAIL));

        verify(deliveryRepository, never()).save(any(Delivery.class));
    }

    @Test
    @DisplayName("TEST 6: Driver accepts own valid delivery -> Success")
    void test6_Driver_Accepts_Own_Valid_Delivery_Success() {
        Delivery pendingDelivery = Delivery.builder()
                .id("DEL-PENDING")
                .orderId("ORD-P1")
                .restaurantId(REST_ID)
                .customerEmail(CUSTOMER_EMAIL)
                .deliveryPartnerEmail(DRIVER_A_EMAIL)
                .status(DeliveryStatus.PENDING)
                .build();

        when(deliveryRepository.findById("DEL-PENDING")).thenReturn(Optional.of(pendingDelivery));
        when(partnerRepository.findFirstByEmail(DRIVER_A_EMAIL)).thenReturn(Optional.of(partnerA));
        when(deliveryRepository.save(any(Delivery.class))).thenAnswer(inv -> inv.getArgument(0));

        DeliveryResponse response = deliveryService.acceptDelivery("DEL-PENDING", DRIVER_A_EMAIL);

        assertNotNull(response);
        assertEquals(DeliveryStatus.ASSIGNED, response.getStatus());
        assertEquals(DRIVER_A_EMAIL, response.getDeliveryPartnerEmail());
    }

    @Test
    @DisplayName("TEST 7: Driver attempts to accept another driver's delivery -> 403 Forbidden")
    void test7_Driver_Accepts_Another_Driver_Delivery_Forbidden() {
        when(deliveryRepository.findById("DEL-A1")).thenReturn(Optional.of(deliveryA1));

        assertThrows(ForbiddenException.class, () ->
                deliveryService.acceptDelivery("DEL-A1", DRIVER_B_EMAIL));
    }

    @Test
    @DisplayName("TEST 8: Driver attempts invalid status jump -> BadRequestException")
    void test8_Driver_Invalid_Status_Jump_Rejected() {
        when(deliveryRepository.findById("DEL-A1")).thenReturn(Optional.of(deliveryA1));

        // deliveryA1 is ASSIGNED, jumping directly to DELIVERED without PICKED_UP
        assertThrows(BadRequestException.class, () ->
                deliveryService.updateDeliveryStatus("DEL-A1", "DELIVERED", DRIVER_A_EMAIL));
    }

    @Test
    @DisplayName("TEST 9: Unauthenticated driver API request -> 401 Unauthorized")
    void test9_Unauthenticated_Driver_Request_Unauthorized() {
        assertThrows(UnauthorizedException.class, () ->
                deliveryController.getMyDeliveries(null, "DELIVERY_PARTNER"));

        assertThrows(UnauthorizedException.class, () ->
                deliveryController.getMyDeliveries("", "DELIVERY_PARTNER"));

        assertThrows(UnauthorizedException.class, () ->
                deliveryController.accept("DEL-A1", null, "DELIVERY_PARTNER"));
    }

    @Test
    @DisplayName("TEST 10: Customer attempts driver-only delivery endpoint -> 403 Forbidden")
    void test10_Customer_Attempts_Driver_Endpoint_Forbidden() {
        assertThrows(ForbiddenException.class, () ->
                deliveryController.getMyDeliveries(CUSTOMER_EMAIL, "CUSTOMER"));

        assertThrows(ForbiddenException.class, () ->
                deliveryController.accept("DEL-A1", CUSTOMER_EMAIL, "CUSTOMER"));
    }

    @Test
    @DisplayName("TEST 11: Restaurant attempts driver-only delivery endpoint -> 403 Forbidden")
    void test11_Restaurant_Attempts_Driver_Endpoint_Forbidden() {
        assertThrows(ForbiddenException.class, () ->
                deliveryController.getMyDeliveries("restaurant@smarteats.com", "RESTAURANT_OWNER"));

        assertThrows(ForbiddenException.class, () ->
                deliveryController.accept("DEL-A1", "restaurant@smarteats.com", "RESTAURANT_OWNER"));
    }

    @Test
    @DisplayName("TEST 12: Existing valid delivery lifecycle still works -> ASSIGNED -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED")
    void test12_Valid_Delivery_Lifecycle_Succeeds() {
        when(deliveryRepository.findById("DEL-A1")).thenReturn(Optional.of(deliveryA1));
        when(deliveryRepository.save(any(Delivery.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. ASSIGNED -> PICKED_UP
        DeliveryResponse r1 = deliveryService.updateDeliveryStatus("DEL-A1", "PICKED_UP", DRIVER_A_EMAIL);
        assertEquals(DeliveryStatus.PICKED_UP, r1.getStatus());

        // 2. PICKED_UP -> OUT_FOR_DELIVERY
        DeliveryResponse r2 = deliveryService.updateDeliveryStatus("DEL-A1", "OUT_FOR_DELIVERY", DRIVER_A_EMAIL);
        assertEquals(DeliveryStatus.OUT_FOR_DELIVERY, r2.getStatus());

        // 3. OUT_FOR_DELIVERY -> DELIVERED
        when(partnerRepository.findFirstByEmail(DRIVER_A_EMAIL)).thenReturn(Optional.of(partnerA));
        DeliveryResponse r3 = deliveryService.updateDeliveryStatus("DEL-A1", "DELIVERED", DRIVER_A_EMAIL);
        assertEquals(DeliveryStatus.DELIVERED, r3.getStatus());

        // Verify rider freed
        verify(partnerRepository, times(1)).save(partnerA);
        assertTrue(partnerA.isAvailable());

        // Verify Kafka event published
        verify(kafkaTemplate, times(1)).send(eq("smarteats.order.delivered"), eq("ORD-A1"), any());
    }
}
