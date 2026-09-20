package com.smarteats.delivery.listener;

import com.smarteats.common.event.DeliveryPartnerRegisteredEvent;
import com.smarteats.common.event.UserStatusChangedEvent;
import com.smarteats.delivery.entity.DeliveryPartner;
import com.smarteats.delivery.repository.DeliveryPartnerRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Slf4j
@Component
public class AuthEventListener {

    private final DeliveryPartnerRepository deliveryPartnerRepository;

    public AuthEventListener(DeliveryPartnerRepository deliveryPartnerRepository) {
        this.deliveryPartnerRepository = deliveryPartnerRepository;
    }

    @KafkaListener(topics = "${kafka.topic.driver-registered:smarteats.auth.driver-registered}", groupId = "delivery-group")
    public void handleDeliveryPartnerRegistered(DeliveryPartnerRegisteredEvent event) {
        log.info("Received DeliveryPartnerRegisteredEvent for driverId '{}': {}", event.getUserId(), event);
        try {
            Optional<DeliveryPartner> existing = deliveryPartnerRepository.findFirstByUserId(event.getUserId());
            if (existing.isEmpty()) {
                double baseLat = event.getBaseLatitude() != null ? event.getBaseLatitude() : 12.9716;
                double baseLng = event.getBaseLongitude() != null ? event.getBaseLongitude() : 77.5946;
                String baseAddr = event.getBaseAddress() != null ? event.getBaseAddress() : event.getAddress();

                DeliveryPartner partner = DeliveryPartner.builder()
                        .userId(event.getUserId())
                        .name(event.getName())
                        .email(event.getEmail())
                        .phone(event.getPhone())
                        .address(event.getAddress())
                        .baseAddress(baseAddr)
                        .city(event.getCity())
                        .state(event.getState())
                        .pincode(event.getPincode())
                        .baseLatitude(baseLat)
                        .baseLongitude(baseLng)
                        .latitude(baseLat)   // Backward compatibility sync
                        .longitude(baseLng)
                        .vehicleType(event.getVehicleType() != null ? event.getVehicleType() : "BIKE")
                        .vehicleNumber(event.getVehicleNumber())
                        .verificationInfo(event.getVerificationInfo())
                        .active(false)
                        .available(false)
                        .status("PENDING")
                        .build();

                DeliveryPartner saved = deliveryPartnerRepository.save(partner);
                log.info("Created delivery partner profile with ID '{}', baseLocation=[{}, {}] for userId '{}'", 
                        saved.getId(), baseLat, baseLng, event.getUserId());
            }
        } catch (Exception e) {
            log.error("Failed to handle DeliveryPartnerRegisteredEvent: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "${kafka.topic.status-updated:smarteats.auth.status-updated}", groupId = "delivery-group")
    public void handleUserStatusChanged(UserStatusChangedEvent event) {
        log.info("Received UserStatusChangedEvent in Delivery Service: {}", event);
        try {
            if ("DELIVERY_PARTNER".equalsIgnoreCase(event.getRole())) {
                Optional<DeliveryPartner> partnerOpt = deliveryPartnerRepository.findFirstByUserId(event.getUserId());
                if (partnerOpt.isEmpty()) {
                    partnerOpt = deliveryPartnerRepository.findFirstByEmail(event.getEmail());
                }

                if (partnerOpt.isPresent()) {
                    DeliveryPartner partner = partnerOpt.get();
                    boolean isApproved = "ACTIVE".equalsIgnoreCase(event.getStatus());
                    partner.setStatus(event.getStatus());
                    partner.setActive(isApproved);
                    partner.setAvailable(isApproved);
                    deliveryPartnerRepository.save(partner);
                    log.info("Updated delivery partner '{}' status to '{}'", partner.getName(), event.getStatus());
                }
            }
        } catch (Exception e) {
            log.error("Failed to handle UserStatusChangedEvent in Delivery Service: {}", e.getMessage(), e);
        }
    }
}
