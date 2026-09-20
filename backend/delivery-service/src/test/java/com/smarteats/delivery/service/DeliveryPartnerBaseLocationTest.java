package com.smarteats.delivery.service;

import com.smarteats.common.event.DeliveryPartnerRegisteredEvent;
import com.smarteats.delivery.dto.DeliveryPartnerRegisterRequest;
import com.smarteats.delivery.dto.DeliveryPartnerResponse;
import com.smarteats.delivery.entity.Delivery;
import com.smarteats.delivery.entity.DeliveryPartner;
import com.smarteats.delivery.listener.AuthEventListener;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class DeliveryPartnerBaseLocationTest {

    @Mock
    private DeliveryRepository deliveryRepository;

    @Mock
    private DeliveryPartnerRepository partnerRepository;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Captor
    private ArgumentCaptor<DeliveryPartner> partnerCaptor;

    private HaversineAssignmentStrategy assignmentStrategy;
    private DeliveryServiceImpl deliveryService;
    private AuthEventListener authEventListener;

    @BeforeEach
    void setUp() {
        assignmentStrategy = new HaversineAssignmentStrategy();
        deliveryService = new DeliveryServiceImpl(
                deliveryRepository,
                partnerRepository,
                assignmentStrategy,
                kafkaTemplate
        );
        authEventListener = new AuthEventListener(partnerRepository);
    }

    @Test
    @DisplayName("TEST 1: Direct Driver registration persists base location coordinates and address fields")
    void testDirectRegistrationPersistsBaseLocation() {
        when(partnerRepository.findFirstByEmail(anyString())).thenReturn(Optional.empty());
        when(partnerRepository.save(any(DeliveryPartner.class))).thenAnswer(invocation -> {
            DeliveryPartner p = invocation.getArgument(0);
            p.setId("dp_101");
            return p;
        });

        DeliveryPartnerRegisterRequest request = DeliveryPartnerRegisterRequest.builder()
                .name("Ramesh Driver")
                .email("ramesh@smarteats.com")
                .baseAddress("Koramangala 4th Block, 80ft Road")
                .city("Bengaluru")
                .state("Karnataka")
                .pincode("560034")
                .baseLatitude(12.9352)
                .baseLongitude(77.6245)
                .build();

        DeliveryPartnerResponse response = deliveryService.registerPartner(request);

        verify(partnerRepository).save(partnerCaptor.capture());
        DeliveryPartner saved = partnerCaptor.getValue();

        assertNotNull(saved);
        assertEquals("Ramesh Driver", saved.getName());
        assertEquals("ramesh@smarteats.com", saved.getEmail());
        assertEquals("Koramangala 4th Block, 80ft Road", saved.getBaseAddress());
        assertEquals("Bengaluru", saved.getCity());
        assertEquals("Karnataka", saved.getState());
        assertEquals("560034", saved.getPincode());
        assertEquals(12.9352, saved.getBaseLatitude(), 0.0001);
        assertEquals(77.6245, saved.getBaseLongitude(), 0.0001);
        // Verify backward compatibility sync
        assertEquals(12.9352, saved.getLatitude(), 0.0001);
        assertEquals(77.6245, saved.getLongitude(), 0.0001);
        // Verify live GPS placeholders remain null at registration
        assertNull(saved.getCurrentLatitude(), "Live GPS currentLatitude must not be set during registration");
        assertNull(saved.getCurrentLongitude(), "Live GPS currentLongitude must not be set during registration");
        assertNull(saved.getLastLocationUpdate(), "Live GPS lastLocationUpdate must not be set during registration");

        // Verify response DTO mapping
        assertEquals("Koramangala 4th Block, 80ft Road", response.getBaseAddress());
        assertEquals("Bengaluru", response.getCity());
        assertEquals(12.9352, response.getBaseLatitude(), 0.0001);
        assertEquals(77.6245, response.getBaseLongitude(), 0.0001);
    }

    @Test
    @DisplayName("TEST 2: AuthEventListener handles DeliveryPartnerRegisteredEvent and maps base location")
    void testAuthEventListenerMapsBaseLocation() {
        when(partnerRepository.findFirstByUserId("user_driver_99")).thenReturn(Optional.empty());
        when(partnerRepository.save(any(DeliveryPartner.class))).thenAnswer(invocation -> {
            DeliveryPartner p = invocation.getArgument(0);
            p.setId("dp_event_99");
            return p;
        });

        DeliveryPartnerRegisteredEvent event = DeliveryPartnerRegisteredEvent.builder()
                .userId("user_driver_99")
                .name("Kavitha Rider")
                .email("kavitha@smarteats.com")
                .phone("+91 98765 43210")
                .address("HSR Layout Sector 1")
                .baseAddress("HSR Layout Sector 1, 27th Main")
                .city("Bengaluru")
                .state("Karnataka")
                .pincode("560102")
                .baseLatitude(12.9121)
                .baseLongitude(77.6446)
                .vehicleType("SCOOTER")
                .vehicleNumber("KA-05-CD-5678")
                .verificationInfo("DL-2023-8899")
                .build();

        authEventListener.handleDeliveryPartnerRegistered(event);

        verify(partnerRepository).save(partnerCaptor.capture());
        DeliveryPartner saved = partnerCaptor.getValue();

        assertNotNull(saved);
        assertEquals("user_driver_99", saved.getUserId());
        assertEquals("Kavitha Rider", saved.getName());
        assertEquals("HSR Layout Sector 1, 27th Main", saved.getBaseAddress());
        assertEquals("Bengaluru", saved.getCity());
        assertEquals("Karnataka", saved.getState());
        assertEquals("560102", saved.getPincode());
        assertEquals(12.9121, saved.getBaseLatitude(), 0.0001);
        assertEquals(77.6446, saved.getBaseLongitude(), 0.0001);
        assertEquals(12.9121, saved.getLatitude(), 0.0001);
        assertEquals(77.6446, saved.getLongitude(), 0.0001);
        assertFalse(saved.isActive());
        assertFalse(saved.isAvailable());
        assertEquals("PENDING", saved.getStatus());
    }

    @Test
    @DisplayName("TEST 3: HaversineAssignmentStrategy correctly uses registered base location coordinates")
    void testHaversineStrategyMatchesWithBaseCoordinates() {
        Delivery delivery = Delivery.builder()
                .id("del_1")
                .orderId("ord_1")
                .restaurantLatitude(12.9350)
                .restaurantLongitude(77.6240)
                .build();

        DeliveryPartner nearDriver = DeliveryPartner.builder()
                .id("dp_near")
                .email("near@smarteats.com")
                .baseLatitude(12.9360)
                .baseLongitude(77.6250)
                .latitude(12.9360)
                .longitude(77.6250)
                .active(true)
                .available(true)
                .build();

        DeliveryPartner farDriver = DeliveryPartner.builder()
                .id("dp_far")
                .email("far@smarteats.com")
                .baseLatitude(12.9900)
                .baseLongitude(77.7000)
                .latitude(12.9900)
                .longitude(77.7000)
                .active(true)
                .available(true)
                .build();

        Optional<DeliveryPartner> matched = assignmentStrategy.assignRider(delivery, List.of(farDriver, nearDriver));

        assertTrue(matched.isPresent());
        assertEquals("dp_near", matched.get().getId());
        assertEquals("near@smarteats.com", matched.get().getEmail());
    }
}
