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
import org.springframework.amqp.rabbit.core.RabbitTemplate;
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
    private final RabbitTemplate rabbitTemplate;

    @Value("${rabbitmq.exchange}")
    private String exchange;

    @Value("${rabbitmq.routing-key.delivery-assigned}")
    private String deliveryAssignedKey;

    @Value("${rabbitmq.routing-key.order-delivered}")
    private String orderDeliveredKey;

    // Constructor injection
    public DeliveryServiceImpl(DeliveryRepository deliveryRepository,
                               DeliveryPartnerRepository partnerRepository,
                               DeliveryAssignmentStrategy assignmentStrategy,
                               RabbitTemplate rabbitTemplate) {
        this.deliveryRepository = deliveryRepository;
        this.partnerRepository = partnerRepository;
        this.assignmentStrategy = assignmentStrategy;
        this.rabbitTemplate = rabbitTemplate;
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

        // Publish event to RabbitMQ
        rabbitTemplate.convertAndSend(exchange, deliveryAssignedKey, savedDelivery.getOrderId());
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
            rabbitTemplate.convertAndSend(exchange, orderDeliveredKey, delivery.getOrderId());
            log.info("Published OrderDelivered event for order: {}", delivery.getOrderId());
        }

        return mapToResponse(saved);
    }

    @Override
    public DeliveryResponse createPendingDelivery(String orderId, String restaurantId, String customerEmail) {
        log.info("Creating pending delivery record for order ID: {}", orderId);
        
        // Mocking coordinates for simulation (e.g. Bangalore center coordinates)
        Delivery delivery = Delivery.builder()
                .orderId(orderId)
                .restaurantId(restaurantId)
                .customerEmail(customerEmail)
                .status(DeliveryStatus.PENDING)
                .restaurantLatitude(12.9716)
                .restaurantLongitude(77.5946)
                .deliveryLatitude(12.9725)
                .deliveryLongitude(77.5937)
                .build();

        Delivery saved = deliveryRepository.save(delivery);
        
        // Asynchronously trigger rider matching
        triggerRiderAssignment(saved.getId());
        
        return mapToResponse(saved);
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

            // Publish event
            rabbitTemplate.convertAndSend(exchange, deliveryAssignedKey, delivery.getOrderId());
            log.info("Rider auto-assigned. Sent DeliveryAssigned event for order: {}", delivery.getOrderId());
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
