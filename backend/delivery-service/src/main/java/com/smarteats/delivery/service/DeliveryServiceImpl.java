package com.smarteats.delivery.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ConflictException;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.ResourceNotFoundException;
import com.smarteats.delivery.dto.DeliveryLocationUpdateRequest;
import com.smarteats.delivery.dto.DeliveryOfferResponse;
import com.smarteats.delivery.dto.DeliveryPartnerRegisterRequest;
import com.smarteats.delivery.dto.DeliveryPartnerResponse;
import com.smarteats.delivery.dto.DeliveryResponse;
import com.smarteats.delivery.entity.Delivery;
import com.smarteats.delivery.entity.DeliveryOffer;
import com.smarteats.delivery.entity.DeliveryOfferStatus;
import com.smarteats.delivery.entity.DeliveryPartner;
import com.smarteats.delivery.entity.DeliveryStatus;
import com.smarteats.delivery.repository.DeliveryOfferRepository;
import com.smarteats.delivery.repository.DeliveryPartnerRepository;
import com.smarteats.delivery.repository.DeliveryRepository;
import com.smarteats.delivery.strategy.CandidateRider;
import com.smarteats.delivery.strategy.DeliveryAssignmentStrategy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DeliveryServiceImpl implements DeliveryService {

    private final DeliveryRepository deliveryRepository;
    private final DeliveryPartnerRepository partnerRepository;
    private final DeliveryOfferRepository deliveryOfferRepository;
    private final DeliveryAssignmentStrategy assignmentStrategy;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final com.smarteats.delivery.client.RestaurantServiceClient restaurantServiceClient;
    private final MongoTemplate mongoTemplate;

    @Value("${kafka.topic.delivery-assigned:smarteats.delivery.assigned}")
    private String deliveryAssignedTopic;

    @Value("${kafka.topic.order-delivered:smarteats.order.delivered}")
    private String orderDeliveredTopic;

    @Value("${kafka.topic.delivery-offer:smarteats.delivery.offer}")
    private String deliveryOfferTopic;

    @Value("${delivery.offer.expiration-seconds:60}")
    private int offerExpirationSeconds = 60;

    @Autowired
    public DeliveryServiceImpl(DeliveryRepository deliveryRepository,
                               DeliveryPartnerRepository partnerRepository,
                               DeliveryOfferRepository deliveryOfferRepository,
                               DeliveryAssignmentStrategy assignmentStrategy,
                               KafkaTemplate<String, Object> kafkaTemplate,
                               com.smarteats.delivery.client.RestaurantServiceClient restaurantServiceClient,
                               MongoTemplate mongoTemplate) {
        this.deliveryRepository = deliveryRepository;
        this.partnerRepository = partnerRepository;
        this.deliveryOfferRepository = deliveryOfferRepository;
        this.assignmentStrategy = assignmentStrategy;
        this.kafkaTemplate = kafkaTemplate;
        this.restaurantServiceClient = restaurantServiceClient;
        this.mongoTemplate = mongoTemplate;
    }

    public DeliveryServiceImpl(DeliveryRepository deliveryRepository,
                               DeliveryPartnerRepository partnerRepository,
                               DeliveryAssignmentStrategy assignmentStrategy,
                               KafkaTemplate<String, Object> kafkaTemplate) {
        this(deliveryRepository, partnerRepository, null, assignmentStrategy, kafkaTemplate, null, null);
    }

    @Override
    public DeliveryPartnerResponse registerPartner(DeliveryPartnerRegisterRequest request) {
        if (partnerRepository.findFirstByEmail(request.getEmail()).isPresent()) {
            throw new BadRequestException("Rider with email already registered!");
        }

        double baseLat = request.getBaseLatitude() != null ? request.getBaseLatitude() : request.getLatitude();
        double baseLng = request.getBaseLongitude() != null ? request.getBaseLongitude() : request.getLongitude();

        DeliveryPartner partner = DeliveryPartner.builder()
                .name(request.getName())
                .email(request.getEmail())
                .baseAddress(request.getBaseAddress())
                .city(request.getCity())
                .state(request.getState())
                .pincode(request.getPincode())
                .baseLatitude(baseLat)
                .baseLongitude(baseLng)
                .latitude(baseLat)
                .longitude(baseLng)
                .active(true)
                .available(true)
                .build();

        DeliveryPartner saved = partnerRepository.save(partner);
        return mapToPartnerResponse(saved);
    }

    @Override
    public DeliveryPartnerResponse updatePartnerAvailability(String email, boolean active, boolean available) {
        DeliveryPartner partner = partnerRepository.findFirstByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Rider not found with email: " + email));

        partner.setActive(active);
        partner.setAvailable(available);
        DeliveryPartner saved = partnerRepository.save(partner);
        log.info("Rider {} availability updated - Active: {}, Available: {}", email, active, available);
        return mapToPartnerResponse(saved);
    }

    @Override
    public DeliveryPartnerResponse updatePartnerLocation(String email, Double latitude, Double longitude, Double accuracy) {
        if (latitude == null || longitude == null || latitude.isNaN() || latitude.isInfinite() || longitude.isNaN() || longitude.isInfinite()) {
            throw new BadRequestException("Latitude and Longitude cannot be null, NaN, or infinite");
        }
        if (latitude < -90.0 || latitude > 90.0) {
            throw new BadRequestException("Latitude must be between -90.0 and +90.0. Provided: " + latitude);
        }
        if (longitude < -180.0 || longitude > 180.0) {
            throw new BadRequestException("Longitude must be between -180.0 and +180.0. Provided: " + longitude);
        }
        if (accuracy != null && (accuracy < 0.0 || accuracy.isNaN() || accuracy.isInfinite())) {
            throw new BadRequestException("Accuracy must be non-negative. Provided: " + accuracy);
        }

        DeliveryPartner partner = partnerRepository.findFirstByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Rider not found with email: " + email));

        partner.setCurrentLatitude(latitude);
        partner.setCurrentLongitude(longitude);
        partner.setLastLocationUpdate(LocalDateTime.now());
        partner.setLocationAccuracyMeters(accuracy);

        DeliveryPartner saved = partnerRepository.save(partner);
        log.info("Updated live GPS location for rider {}: lat={}, lng={}, acc={}m, timestamp={}",
                email, latitude, longitude, accuracy, saved.getLastLocationUpdate());
        return mapToPartnerResponse(saved);
    }

    @Override
    public DeliveryResponse getDeliveryById(String id) {
        Delivery delivery = deliveryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery details not found with ID: " + id));
        return mapToResponse(delivery);
    }

    @Override
    public DeliveryResponse getDeliveryById(String id, String userEmail, String roles) {
        Delivery delivery = deliveryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery details not found with ID: " + id));

        verifyDeliveryOwnershipOrAccess(delivery, userEmail, roles);
        return mapToResponse(delivery);
    }

    @Override
    public DeliveryResponse getDeliveryByOrderId(String orderId, String userEmail, String roles) {
        Delivery delivery = deliveryRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery details not found for order ID: " + orderId));

        verifyDeliveryOwnershipOrAccess(delivery, userEmail, roles);
        return mapToResponse(delivery);
    }

    private void verifyDeliveryOwnershipOrAccess(Delivery delivery, String userEmail, String roles) {
        boolean isAdmin = roles != null && (roles.contains("ADMIN") || roles.contains("ROLE_ADMIN"));
        if (isAdmin) {
            return;
        }

        boolean isDriverAssigned = roles != null && (roles.contains("DELIVERY_PARTNER") || roles.contains("DRIVER"))
                && delivery.getDeliveryPartnerEmail() != null
                && delivery.getDeliveryPartnerEmail().equalsIgnoreCase(userEmail);

        boolean isCustomerOwner = userEmail != null && delivery.getCustomerEmail() != null
                && delivery.getCustomerEmail().equalsIgnoreCase(userEmail);

        boolean isRestaurantOwner = roles != null && roles.contains("RESTAURANT_OWNER")
                && delivery.getRestaurantId() != null
                && (restaurantServiceClient == null || restaurantServiceClient.isOwnerOfRestaurant(userEmail, delivery.getRestaurantId()));

        if (!isDriverAssigned && !isCustomerOwner && !isRestaurantOwner) {
            log.warn("Access Denied (Delivery IDOR Prevention): User '{}' with roles '{}' attempted to access delivery '{}' (assigned driver: '{}', restaurant: '{}')",
                    userEmail, roles, delivery.getId(), delivery.getDeliveryPartnerEmail(), delivery.getRestaurantId());
            throw new ForbiddenException("Access Denied: You do not have permission to view this delivery");
        }
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

        if (delivery.getDeliveryPartnerEmail() != null
                && !delivery.getDeliveryPartnerEmail().isBlank()
                && !delivery.getDeliveryPartnerEmail().equalsIgnoreCase(partnerEmail)) {
            log.warn("Access Denied: Driver '{}' attempted to accept delivery '{}' assigned to '{}'",
                    partnerEmail, deliveryId, delivery.getDeliveryPartnerEmail());
            throw new ForbiddenException("Access Denied: This delivery is assigned to another driver");
        }

        if (delivery.getStatus() != DeliveryStatus.PENDING && delivery.getStatus() != DeliveryStatus.ASSIGNED) {
            throw new BadRequestException("Delivery is not in an acceptable state!");
        }

        DeliveryPartner partner = partnerRepository.findFirstByEmail(partnerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Rider not found with email: " + partnerEmail));

        delivery.setDeliveryPartnerEmail(partnerEmail);
        delivery.setStatus(DeliveryStatus.ASSIGNED);
        Delivery savedDelivery = deliveryRepository.save(delivery);

        partner.setAvailable(false);
        partnerRepository.save(partner);

        // Publish event to Kafka
        Map<String, Object> eventPayload = Map.of(
                "orderId", savedDelivery.getOrderId(),
                "customerEmail", savedDelivery.getCustomerEmail() != null ? savedDelivery.getCustomerEmail() : "",
                "deliveryPartnerEmail", partnerEmail
        );
        kafkaTemplate.send(deliveryAssignedTopic, savedDelivery.getOrderId(), eventPayload);
        log.info("Delivery for order {} accepted by rider {}", savedDelivery.getOrderId(), partnerEmail);

        return mapToResponse(savedDelivery);
    }

    @Override
    public DeliveryResponse updateDeliveryStatus(String deliveryId, String status, String partnerEmail) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery details not found with ID: " + deliveryId));

        if (delivery.getDeliveryPartnerEmail() == null || !delivery.getDeliveryPartnerEmail().equalsIgnoreCase(partnerEmail)) {
            log.warn("Access Denied (Cross-Driver IDOR Prevention): Driver '{}' attempted to update status of delivery '{}' assigned to '{}'",
                    partnerEmail, deliveryId, delivery.getDeliveryPartnerEmail());
            throw new ForbiddenException("Access Denied: You are not authorized to update this delivery");
        }

        DeliveryStatus newStatus;
        try {
            newStatus = DeliveryStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid delivery status: " + status);
        }

        validateDeliveryStateTransition(delivery.getStatus(), newStatus);

        delivery.setStatus(newStatus);
        Delivery saved = deliveryRepository.save(delivery);
        log.info("Delivery {} status updated from {} to {}", deliveryId, delivery.getStatus(), newStatus);

        if (newStatus == DeliveryStatus.DELIVERED) {
            // Free the rider
            partnerRepository.findFirstByEmail(partnerEmail).ifPresent(p -> {
                p.setAvailable(true);
                partnerRepository.save(p);
            });

            // Publish OrderDelivered event
            Map<String, Object> eventPayload = Map.of(
                    "orderId", delivery.getOrderId(),
                    "customerEmail", delivery.getCustomerEmail() != null ? delivery.getCustomerEmail() : "",
                    "deliveryPartnerEmail", partnerEmail
            );
            kafkaTemplate.send(orderDeliveredTopic, delivery.getOrderId(), eventPayload);
            log.info("Published OrderDelivered event to Kafka for order: {}", delivery.getOrderId());
        }

        return mapToResponse(saved);
    }

    private void validateDeliveryStateTransition(DeliveryStatus current, DeliveryStatus next) {
        if (current == next) {
            return;
        }
        if (current == DeliveryStatus.PENDING) {
            if (next != DeliveryStatus.ASSIGNED && next != DeliveryStatus.CANCELLED) {
                throw new BadRequestException("Invalid state transition: Cannot change status from PENDING to " + next + ". Driver must accept delivery first.");
            }
        } else if (current == DeliveryStatus.ASSIGNED) {
            if (next != DeliveryStatus.PICKED_UP && next != DeliveryStatus.CANCELLED) {
                throw new BadRequestException("Invalid state transition: Cannot change status from ASSIGNED to " + next + ". Expected PICKED_UP.");
            }
        } else if (current == DeliveryStatus.PICKED_UP) {
            if (next != DeliveryStatus.OUT_FOR_DELIVERY && next != DeliveryStatus.DELIVERED && next != DeliveryStatus.CANCELLED) {
                throw new BadRequestException("Invalid state transition: Cannot change status from PICKED_UP to " + next + ". Expected OUT_FOR_DELIVERY or DELIVERED.");
            }
        } else if (current == DeliveryStatus.OUT_FOR_DELIVERY) {
            if (next != DeliveryStatus.DELIVERED && next != DeliveryStatus.CANCELLED) {
                throw new BadRequestException("Invalid state transition: Cannot change status from OUT_FOR_DELIVERY to " + next + ". Expected DELIVERED.");
            }
        } else if (current == DeliveryStatus.DELIVERED || current == DeliveryStatus.CANCELLED) {
            throw new BadRequestException("Invalid state transition: Cannot modify delivery in terminal state " + current);
        }
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

        // Trigger Controlled Broadcast to nearest 3-5 drivers (or fallback if in unit test)
        triggerRiderAssignment(saved.getId());

        return mapToResponse(saved);
    }

    private boolean isValidCoordinate(double lat, double lon) {
        return lat >= -90.0 && lat <= 90.0 && lon >= -180.0 && lon <= 180.0 && !(lat == 0.0 && lon == 0.0);
    }

    @Override
    public void triggerRiderAssignment(String deliveryId) {
        if (deliveryOfferRepository != null) {
            triggerOfferBroadcast(deliveryId);
        } else {
            // Direct assignment fallback for legacy unit tests without offer repository
            Delivery delivery = deliveryRepository.findById(deliveryId).orElse(null);
            if (delivery != null && delivery.getStatus() == DeliveryStatus.PENDING) {
                List<DeliveryPartner> availableRiders = partnerRepository.findByActiveAndAvailable(true, true);
                Optional<DeliveryPartner> assignedRiderOpt = assignmentStrategy.assignRider(delivery, availableRiders);
                if (assignedRiderOpt.isPresent()) {
                    DeliveryPartner rider = assignedRiderOpt.get();
                    delivery.setDeliveryPartnerEmail(rider.getEmail());
                    delivery.setStatus(DeliveryStatus.ASSIGNED);
                    deliveryRepository.save(delivery);
                    rider.setAvailable(false);
                    partnerRepository.save(rider);
                }
            }
        }
    }

    @Override
    public void triggerOfferBroadcast(String deliveryId) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery details not found with ID: " + deliveryId));

        if (delivery.getStatus() != DeliveryStatus.PENDING) {
            log.info("Delivery {} is in status {} - skipping driver offer broadcast", deliveryId, delivery.getStatus());
            return;
        }

        // Find all previous offers for this delivery to compute batchNumber and excluded drivers
        List<DeliveryOffer> existingOffers = deliveryOfferRepository.findByDeliveryId(deliveryId);
        Set<String> alreadyOfferedEmails = existingOffers.stream()
                .map(o -> o.getDriverEmail().trim().toLowerCase())
                .collect(Collectors.toSet());

        int currentBatchNumber = existingOffers.stream()
                .mapToInt(DeliveryOffer::getBatchNumber)
                .max()
                .orElse(0) + 1;

        log.info("Initiating Controlled Broadcast Batch #{} for delivery {} (Order {}). Excluded drivers count: {}",
                currentBatchNumber, deliveryId, delivery.getOrderId(), alreadyOfferedEmails.size());

        List<DeliveryPartner> availableRiders = partnerRepository.findByActiveAndAvailable(true, true);

        // Match nearest 3 to 5 candidate riders
        List<CandidateRider> candidates = assignmentStrategy.findCandidateRiders(
                delivery, availableRiders, 5, alreadyOfferedEmails);

        if (candidates.isEmpty()) {
            log.warn("No eligible nearby drivers found for delivery ID {} (Order {}). Delivery remains PENDING awaiting candidates.",
                    deliveryId, delivery.getOrderId());
            return;
        }

        String restName = null;
        String restAddress = null;
        if (restaurantServiceClient != null && delivery.getRestaurantId() != null) {
            com.smarteats.delivery.client.RestaurantDetails rd = restaurantServiceClient.getRestaurantDetails(delivery.getRestaurantId());
            if (rd != null) {
                restName = rd.getName();
                restAddress = rd.getAddress();
            }
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusSeconds(offerExpirationSeconds);

        List<DeliveryOffer> createdOffers = new ArrayList<>();

        for (CandidateRider candidate : candidates) {
            DeliveryPartner partner = candidate.getPartner();
            DeliveryOffer offer = DeliveryOffer.builder()
                    .deliveryId(delivery.getId())
                    .orderId(delivery.getOrderId())
                    .driverEmail(partner.getEmail())
                    .driverName(partner.getName())
                    .restaurantId(delivery.getRestaurantId())
                    .restaurantName(restName != null ? restName : "Restaurant")
                    .restaurantAddress(restAddress != null ? restAddress : "")
                    .restaurantLatitude(delivery.getRestaurantLatitude())
                    .restaurantLongitude(delivery.getRestaurantLongitude())
                    .deliveryLatitude(delivery.getDeliveryLatitude())
                    .deliveryLongitude(delivery.getDeliveryLongitude())
                    .distanceKm(candidate.getDistanceKm())
                    .batchNumber(currentBatchNumber)
                    .status(DeliveryOfferStatus.PENDING)
                    .createdAt(now)
                    .expiresAt(expiresAt)
                    .build();

            DeliveryOffer savedOffer = deliveryOfferRepository.save(offer);
            createdOffers.add(savedOffer);

            // Publish delivery offer notification event to Kafka
            Map<String, Object> offerPayload = new HashMap<>();
            offerPayload.put("offerId", savedOffer.getId());
            offerPayload.put("orderId", delivery.getOrderId());
            offerPayload.put("deliveryId", delivery.getId());
            offerPayload.put("driverEmail", partner.getEmail());
            offerPayload.put("restaurantName", restName != null ? restName : "Restaurant");
            offerPayload.put("distanceKm", candidate.getDistanceKm());
            offerPayload.put("expiresAt", expiresAt.toString());
            offerPayload.put("type", "DELIVERY_OFFER");

            try {
                kafkaTemplate.send(deliveryOfferTopic, delivery.getOrderId(), offerPayload);
                log.info("Broadcasted delivery offer {} to driver {} (distance: {} km, expires in {}s)",
                        savedOffer.getId(), partner.getEmail(), candidate.getDistanceKm(), offerExpirationSeconds);
            } catch (Exception e) {
                log.error("Failed to publish delivery offer event for driver {}: {}", partner.getEmail(), e.getMessage());
            }
        }

        log.info("Successfully broadcasted {} delivery offers in batch #{} for order {}",
                createdOffers.size(), currentBatchNumber, delivery.getOrderId());
    }

    @Override
    public List<DeliveryOfferResponse> getDriverOffers(String driverEmail) {
        if (driverEmail == null || driverEmail.isBlank()) {
            return List.of();
        }

        List<DeliveryOffer> pendingOffers = deliveryOfferRepository.findByDriverEmailAndStatus(
                driverEmail.trim(), DeliveryOfferStatus.PENDING);

        LocalDateTime now = LocalDateTime.now();
        List<DeliveryOfferResponse> activeResponses = new ArrayList<>();

        for (DeliveryOffer offer : pendingOffers) {
            if (offer.getExpiresAt() != null && offer.getExpiresAt().isBefore(now)) {
                // Lazily mark expired
                offer.setStatus(DeliveryOfferStatus.EXPIRED);
                offer.setUpdatedAt(now);
                deliveryOfferRepository.save(offer);
                log.debug("Offer {} for driver {} marked EXPIRED on fetch", offer.getId(), driverEmail);
            } else {
                long secondsRemaining = offer.getExpiresAt() != null
                        ? Math.max(0, ChronoUnit.SECONDS.between(now, offer.getExpiresAt()))
                        : 0;

                activeResponses.add(DeliveryOfferResponse.builder()
                        .id(offer.getId())
                        .deliveryId(offer.getDeliveryId())
                        .orderId(offer.getOrderId())
                        .restaurantId(offer.getRestaurantId())
                        .restaurantName(offer.getRestaurantName())
                        .restaurantAddress(offer.getRestaurantAddress())
                        .restaurantLatitude(offer.getRestaurantLatitude())
                        .restaurantLongitude(offer.getRestaurantLongitude())
                        .deliveryLatitude(offer.getDeliveryLatitude())
                        .deliveryLongitude(offer.getDeliveryLongitude())
                        .distanceKm(offer.getDistanceKm())
                        .orderTotalAmount(offer.getOrderTotalAmount())
                        .status(offer.getStatus())
                        .createdAt(offer.getCreatedAt())
                        .expiresAt(offer.getExpiresAt())
                        .secondsRemaining(secondsRemaining)
                        .build());
            }
        }

        return activeResponses;
    }

    @Override
    public DeliveryResponse acceptOffer(String offerId, String driverEmail) {
        log.info("Driver '{}' attempting to accept offer '{}'", driverEmail, offerId);

        DeliveryOffer offer = deliveryOfferRepository.findByIdAndDriverEmail(offerId, driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery offer not found with ID: " + offerId));

        LocalDateTime now = LocalDateTime.now();

        // 1. Check offer state and expiration
        if (offer.getStatus() == DeliveryOfferStatus.EXPIRED || (offer.getExpiresAt() != null && offer.getExpiresAt().isBefore(now))) {
            offer.setStatus(DeliveryOfferStatus.EXPIRED);
            offer.setUpdatedAt(now);
            deliveryOfferRepository.save(offer);
            throw new BadRequestException("Offer has expired");
        }

        if (offer.getStatus() == DeliveryOfferStatus.CANCELLED) {
            throw new ConflictException("Order already assigned to another driver");
        }

        if (offer.getStatus() != DeliveryOfferStatus.PENDING) {
            throw new BadRequestException("Offer is not in a pending state: " + offer.getStatus());
        }

        // 2. Atomic Compare-And-Swap on Delivery document in MongoDB
        // Condition: _id == deliveryId AND status == PENDING
        Query query = new Query(Criteria.where("_id").is(offer.getDeliveryId())
                .and("status").is(DeliveryStatus.PENDING));

        Update update = new Update()
                .set("deliveryPartnerEmail", driverEmail)
                .set("status", DeliveryStatus.ASSIGNED)
                .set("updatedAt", now);

        Delivery assignedDelivery = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                Delivery.class
        );

        if (assignedDelivery == null) {
            // Concurrency race lost: Another driver already won this delivery
            log.warn("Concurrency collision: Offer {} accepted by driver '{}', but delivery '{}' was already assigned",
                    offerId, driverEmail, offer.getDeliveryId());
            offer.setStatus(DeliveryOfferStatus.CANCELLED);
            offer.setUpdatedAt(now);
            deliveryOfferRepository.save(offer);
            throw new ConflictException("Order already assigned to another driver");
        }

        // 3. Winning driver confirmed!
        offer.setStatus(DeliveryOfferStatus.ACCEPTED);
        offer.setUpdatedAt(now);
        deliveryOfferRepository.save(offer);

        // Mark driver unavailable
        partnerRepository.findFirstByEmail(driverEmail).ifPresent(p -> {
            p.setAvailable(false);
            partnerRepository.save(p);
        });

        // 4. Cancel all other pending offers for this delivery
        List<DeliveryOffer> otherPendingOffers = deliveryOfferRepository.findByDeliveryIdAndStatus(
                offer.getDeliveryId(), DeliveryOfferStatus.PENDING);

        List<String> losingDriverEmails = new ArrayList<>();
        for (DeliveryOffer other : otherPendingOffers) {
            if (!other.getId().equals(offer.getId())) {
                other.setStatus(DeliveryOfferStatus.CANCELLED);
                other.setUpdatedAt(now);
                deliveryOfferRepository.save(other);
                losingDriverEmails.add(other.getDriverEmail());
            }
        }

        log.info("Driver '{}' successfully won delivery {} (Order {}). Cancelled {} competitor offers",
                driverEmail, assignedDelivery.getId(), assignedDelivery.getOrderId(), losingDriverEmails.size());

        // 5. Publish DeliveryAssigned Kafka event with full details
        String restName = offer.getRestaurantName();
        if ((restName == null || restName.isBlank()) && restaurantServiceClient != null && assignedDelivery.getRestaurantId() != null) {
            com.smarteats.delivery.client.RestaurantDetails rd = restaurantServiceClient.getRestaurantDetails(assignedDelivery.getRestaurantId());
            if (rd != null) {
                restName = rd.getName();
            }
        }

        Map<String, Object> eventPayload = new HashMap<>();
        eventPayload.put("orderId", assignedDelivery.getOrderId());
        eventPayload.put("deliveryId", assignedDelivery.getId());
        eventPayload.put("customerEmail", assignedDelivery.getCustomerEmail() != null ? assignedDelivery.getCustomerEmail() : "");
        eventPayload.put("deliveryPartnerEmail", driverEmail);
        eventPayload.put("driverName", offer.getDriverName() != null ? offer.getDriverName() : driverEmail);
        eventPayload.put("restaurantId", assignedDelivery.getRestaurantId() != null ? assignedDelivery.getRestaurantId() : "");
        eventPayload.put("restaurantName", restName != null ? restName : "Restaurant");
        eventPayload.put("losingDriverEmails", losingDriverEmails);

        try {
            kafkaTemplate.send(deliveryAssignedTopic, assignedDelivery.getOrderId(), eventPayload);
            log.info("Published delivery-assigned event to Kafka for order {}", assignedDelivery.getOrderId());
        } catch (Exception e) {
            log.error("Failed to publish deliveryAssignedTopic event: {}", e.getMessage());
        }

        return mapToResponse(assignedDelivery);
    }

    @Override
    public void rejectOffer(String offerId, String driverEmail) {
        log.info("Driver '{}' rejecting offer '{}'", driverEmail, offerId);

        DeliveryOffer offer = deliveryOfferRepository.findByIdAndDriverEmail(offerId, driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery offer not found with ID: " + offerId));

        if (offer.getStatus() == DeliveryOfferStatus.PENDING) {
            offer.setStatus(DeliveryOfferStatus.REJECTED);
            offer.setUpdatedAt(LocalDateTime.now());
            deliveryOfferRepository.save(offer);
            log.info("Offer {} marked REJECTED by driver {}", offerId, driverEmail);
        }

        // Check if all offers for this delivery in current batch are closed
        checkAndRetryIfBatchExhausted(offer.getDeliveryId());
    }

    private void checkAndRetryIfBatchExhausted(String deliveryId) {
        Optional<Delivery> deliveryOpt = deliveryRepository.findById(deliveryId);
        if (deliveryOpt.isEmpty() || deliveryOpt.get().getStatus() != DeliveryStatus.PENDING) {
            return;
        }

        List<DeliveryOffer> allOffers = deliveryOfferRepository.findByDeliveryId(deliveryId);
        boolean hasAnyPending = allOffers.stream().anyMatch(o -> o.getStatus() == DeliveryOfferStatus.PENDING);

        if (!hasAnyPending) {
            log.info("All offers for delivery {} are closed (REJECTED/EXPIRED). Triggering next candidate batch.", deliveryId);
            triggerOfferBroadcast(deliveryId);
        }
    }

    @Scheduled(fixedDelay = 10000)
    @Override
    public void checkAndHandleExpiredOffers() {
        LocalDateTime now = LocalDateTime.now();
        List<DeliveryOffer> expiredPending = deliveryOfferRepository.findByStatusAndExpiresAtBefore(
                DeliveryOfferStatus.PENDING, now);

        if (expiredPending.isEmpty()) {
            return;
        }

        log.debug("Found {} expired delivery offers to clean up", expiredPending.size());
        Set<String> affectedDeliveryIds = new HashSet<>();

        for (DeliveryOffer offer : expiredPending) {
            offer.setStatus(DeliveryOfferStatus.EXPIRED);
            offer.setUpdatedAt(now);
            deliveryOfferRepository.save(offer);
            affectedDeliveryIds.add(offer.getDeliveryId());
        }

        // Check if any pending deliveries need a retry batch
        for (String delivId : affectedDeliveryIds) {
            checkAndRetryIfBatchExhausted(delivId);
        }
    }

    private DeliveryResponse mapToResponse(Delivery d) {
        Double driverLat = null;
        Double driverLng = null;
        LocalDateTime lastUpdate = null;
        Double accuracy = null;
        String driverName = null;
        String driverPhone = null;
        Boolean driverAvailable = null;
        Boolean driverActive = null;

        if (d.getDeliveryPartnerEmail() != null && !d.getDeliveryPartnerEmail().isBlank()) {
            Optional<DeliveryPartner> partnerOpt = partnerRepository.findFirstByEmail(d.getDeliveryPartnerEmail());
            if (partnerOpt.isPresent()) {
                DeliveryPartner p = partnerOpt.get();
                driverLat = p.getCurrentLatitude();
                driverLng = p.getCurrentLongitude();
                lastUpdate = p.getLastLocationUpdate();
                accuracy = p.getLocationAccuracyMeters();
                driverName = p.getName();
                driverPhone = p.getPhone();
                driverAvailable = p.isAvailable();
                driverActive = p.isActive();
            }
        }

        String restName = null;
        String restPhone = null;
        String restAddress = null;

        if (restaurantServiceClient != null && d.getRestaurantId() != null && !d.getRestaurantId().isBlank()) {
            com.smarteats.delivery.client.RestaurantDetails rd = restaurantServiceClient.getRestaurantDetails(d.getRestaurantId());
            if (rd != null) {
                restName = rd.getName();
                restPhone = rd.getPhone();
                restAddress = rd.getAddress();
            }
        }

        return DeliveryResponse.builder()
                .id(d.getId())
                .orderId(d.getOrderId())
                .restaurantId(d.getRestaurantId())
                .customerEmail(d.getCustomerEmail())
                .deliveryPartnerEmail(d.getDeliveryPartnerEmail())
                .driverName(driverName)
                .driverPhone(driverPhone)
                .driverAvailable(driverAvailable)
                .driverActive(driverActive)
                .status(d.getStatus())
                .restaurantLatitude(d.getRestaurantLatitude())
                .restaurantLongitude(d.getRestaurantLongitude())
                .deliveryLatitude(d.getDeliveryLatitude())
                .deliveryLongitude(d.getDeliveryLongitude())
                .driverCurrentLatitude(driverLat)
                .driverCurrentLongitude(driverLng)
                .driverLastLocationUpdate(lastUpdate)
                .driverLocationAccuracyMeters(accuracy)
                .restaurantName(restName)
                .restaurantPhone(restPhone)
                .restaurantAddress(restAddress)
                .build();
    }

    private DeliveryPartnerResponse mapToPartnerResponse(DeliveryPartner p) {
        return DeliveryPartnerResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .email(p.getEmail())
                .baseAddress(p.getBaseAddress())
                .city(p.getCity())
                .state(p.getState())
                .pincode(p.getPincode())
                .baseLatitude(p.getBaseLatitude() != 0.0 ? p.getBaseLatitude() : p.getLatitude())
                .baseLongitude(p.getBaseLongitude() != 0.0 ? p.getBaseLongitude() : p.getLongitude())
                .latitude(p.getLatitude())
                .longitude(p.getLongitude())
                .currentLatitude(p.getCurrentLatitude())
                .currentLongitude(p.getCurrentLongitude())
                .lastLocationUpdate(p.getLastLocationUpdate())
                .locationAccuracyMeters(p.getLocationAccuracyMeters())
                .active(p.isActive())
                .available(p.isAvailable())
                .build();
    }
}
