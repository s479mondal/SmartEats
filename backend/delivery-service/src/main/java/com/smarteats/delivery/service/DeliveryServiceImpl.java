package com.smarteats.delivery.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ResourceNotFoundException;
import com.smarteats.delivery.dto.DeliveryPartnerRegisterRequest;
import com.smarteats.delivery.dto.DeliveryPartnerResponse;
import com.smarteats.delivery.dto.DeliveryResponse;
import com.smarteats.delivery.entity.Delivery;
import com.smarteats.delivery.entity.DeliveryPartner;
import com.smarteats.delivery.entity.DeliveryStatus;
import com.smarteats.delivery.repository.DeliveryPartnerRepository;
import com.smarteats.delivery.repository.DeliveryRepository;
import com.smarteats.delivery.strategy.DeliveryAssignmentStrategy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DeliveryServiceImpl implements DeliveryService {

    private final DeliveryRepository deliveryRepository;
    private final DeliveryPartnerRepository partnerRepository;
    private final DeliveryAssignmentStrategy assignmentStrategy;
    private final org.springframework.kafka.core.KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.topic.delivery-assigned:smarteats.delivery.assigned}")
    private String deliveryAssignedTopic;

    @Value("${kafka.topic.order-delivered:smarteats.order.delivered}")
    private String orderDeliveredTopic;

    // Constructor injection
    public DeliveryServiceImpl(DeliveryRepository deliveryRepository,
                               DeliveryPartnerRepository partnerRepository,
                               DeliveryAssignmentStrategy assignmentStrategy,
                               org.springframework.kafka.core.KafkaTemplate<String, Object> kafkaTemplate) {
        this.deliveryRepository = deliveryRepository;
        this.partnerRepository = partnerRepository;
        this.assignmentStrategy = assignmentStrategy;
        this.kafkaTemplate = kafkaTemplate;
    }

    @Override
    public DeliveryPartnerResponse registerPartner(DeliveryPartnerRegisterRequest request) {
        if (partnerRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new BadRequestException("Rider with email already registered!");
        }

        DeliveryPartner partner = DeliveryPartner.builder()
                .name(request.getName())
                .email(request.getEmail())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .active(true)
                .available(true)
                .build();

        DeliveryPartner saved = partnerRepository.save(partner);
        return mapToPartnerResponse(saved);
    }

    @Override
    public DeliveryPartnerResponse updatePartnerAvailability(String email, boolean active, boolean available) {
        DeliveryPartner partner = partnerRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Rider not found with email: " + email));

        partner.setActive(active);
        partner.setAvailable(available);
        DeliveryPartner saved = partnerRepository.save(partner);
        log.info("Rider {} availability updated - Active: {}, Available: {}", email, active, available);
        return mapToPartnerResponse(saved);
    }

    @Override
    public DeliveryResponse getDeliveryById(String id) {
        Delivery delivery = deliveryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery details not found with ID: " + id));
        return mapToResponse(delivery);
    }

    @Override
    public List<DeliveryResponse> getPartnerDeliveries(String partnerEmail) {
        return deliveryRepository.findByDeliveryPartnerEmail(partnerEmail).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public DeliveryResponse acceptDelivery(String deliveryId, String partnerEmail) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery details not found with ID: " + deliveryId));

        if (delivery.getStatus() != DeliveryStatus.PENDING) {
            throw new BadRequestException("Delivery is already assigned or completed!");
        }

        DeliveryPartner partner = partnerRepository.findByEmail(partnerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Rider not found with email: " + partnerEmail));

        delivery.setDeliveryPartnerEmail(partnerEmail);
        delivery.setStatus(DeliveryStatus.ASSIGNED);
        Delivery savedDelivery = deliveryRepository.save(delivery);

        partner.setAvailable(false);
        partnerRepository.save(partner);

        // Publish event to Kafka
        kafkaTemplate.send(deliveryAssignedTopic, savedDelivery.getOrderId(), savedDelivery.getOrderId());
        log.info("Delivery for order {} accepted by rider {}", savedDelivery.getOrderId(), partnerEmail);

        return mapToResponse(savedDelivery);
    }

    @Override
    public DeliveryResponse updateDeliveryStatus(String deliveryId, String status, String partnerEmail) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery details not found with ID: " + deliveryId));

        if (!delivery.getDeliveryPartnerEmail().equalsIgnoreCase(partnerEmail)) {
            throw new BadRequestException("You are not authorized to update this delivery!");
        }

        DeliveryStatus newStatus;
        try {
            newStatus = DeliveryStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid delivery status: " + status);
        }

        delivery.setStatus(newStatus);
        Delivery saved = deliveryRepository.save(delivery);
        log.info("Delivery {} status updated to {}", deliveryId, newStatus);

        if (newStatus == DeliveryStatus.DELIVERED) {
            // Free the rider
            partnerRepository.findByEmail(partnerEmail).ifPresent(p -> {
                p.setAvailable(true);
                partnerRepository.save(p);
            });

            // Publish OrderDelivered event
            kafkaTemplate.send(orderDeliveredTopic, delivery.getOrderId(), delivery.getOrderId());
            log.info("Published OrderDelivered event to Kafka for order: {}", delivery.getOrderId());
        }

        return mapToResponse(saved);
    }

    @Override
    public DeliveryResponse createPendingDelivery(String orderId, String restaurantId, String customerEmail) {
        throw new BadRequestException("createPendingDelivery requires explicit restaurant and delivery coordinates.");
    }

    @Override
    public DeliveryResponse createPendingDelivery(String orderId, String restaurantId, String customerEmail,
                                                 double restLat, double restLng, double delLat, double delLng) {
        log.info("Creating pending delivery record for order ID: {} with rest=[{}, {}], del=[{}, {}]",
                orderId, restLat, restLng, delLat, delLng);

        // Idempotency check to prevent duplicate delivery creation
        Optional<Delivery> existing = deliveryRepository.findByOrderId(orderId);
        if (existing.isPresent()) {
            log.warn("Delivery record already exists for order ID: {}. Skipping duplicate creation.", orderId);
            return mapToResponse(existing.get());
        }

        if (!isValidCoordinate(restLat, restLng)) {
            log.error("Invalid restaurant coordinates for order {}: lat={}, lng={}", orderId, restLat, restLng);
            throw new BadRequestException("Invalid restaurant coordinates for delivery creation: [" + restLat + ", " + restLng + "]");
        }
        if (!isValidCoordinate(delLat, delLng)) {
            log.error("Invalid delivery coordinates for order {}: lat={}, lng={}", orderId, delLat, delLng);
            throw new BadRequestException("Invalid delivery coordinates for delivery creation: [" + delLat + ", " + delLng + "]");
        }

        Delivery delivery = Delivery.builder()
                .orderId(orderId)
                .restaurantId(restaurantId)
                .customerEmail(customerEmail)
                .status(DeliveryStatus.PENDING)
                .restaurantLatitude(restLat)
                .restaurantLongitude(restLng)
                .deliveryLatitude(delLat)
                .deliveryLongitude(delLng)
                .build();

        Delivery saved = deliveryRepository.save(delivery);

        // Asynchronously trigger rider matching via Haversine strategy
        triggerRiderAssignment(saved.getId());

        return mapToResponse(saved);
    }

    private boolean isValidCoordinate(double lat, double lon) {
        return lat >= -90.0 && lat <= 90.0 && lon >= -180.0 && lon <= 180.0 && !(lat == 0.0 && lon == 0.0);
    }

    @Override
    public void triggerRiderAssignment(String deliveryId) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery details not found with ID: " + deliveryId));

        if (delivery.getStatus() != DeliveryStatus.PENDING) {
            return;
        }

        log.info("Searching for available riders for delivery: {}", deliveryId);
        List<DeliveryPartner> availableRiders = partnerRepository.findByActiveAndAvailable(true, true);
        
        Optional<DeliveryPartner> assignedRiderOpt = assignmentStrategy.assignRider(delivery, availableRiders);
        
        if (assignedRiderOpt.isPresent()) {
            DeliveryPartner rider = assignedRiderOpt.get();
            log.info("Rider {} matched for delivery ID {}", rider.getEmail(), deliveryId);

            delivery.setDeliveryPartnerEmail(rider.getEmail());
            delivery.setStatus(DeliveryStatus.ASSIGNED);
            deliveryRepository.save(delivery);

            rider.setAvailable(false);
            partnerRepository.save(rider);

            // Publish event to Kafka
            kafkaTemplate.send(deliveryAssignedTopic, delivery.getOrderId(), delivery.getOrderId());
            log.info("Rider auto-assigned. Sent DeliveryAssigned event to Kafka for order: {}", delivery.getOrderId());
        } else {
            log.warn("No active/available riders found for delivery ID {}. Awaiting manual assignment.", deliveryId);
        }
    }

    private DeliveryResponse mapToResponse(Delivery d) {
        return DeliveryResponse.builder()
                .id(d.getId())
                .orderId(d.getOrderId())
                .restaurantId(d.getRestaurantId())
                .customerEmail(d.getCustomerEmail())
                .deliveryPartnerEmail(d.getDeliveryPartnerEmail())
                .status(d.getStatus())
                .restaurantLatitude(d.getRestaurantLatitude())
                .restaurantLongitude(d.getRestaurantLongitude())
                .deliveryLatitude(d.getDeliveryLatitude())
                .deliveryLongitude(d.getDeliveryLongitude())
                .build();
    }

    private DeliveryPartnerResponse mapToPartnerResponse(DeliveryPartner p) {
        return DeliveryPartnerResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .email(p.getEmail())
                .latitude(p.getLatitude())
                .longitude(p.getLongitude())
                .active(p.isActive())
                .available(p.isAvailable())
                .build();
    }
}
