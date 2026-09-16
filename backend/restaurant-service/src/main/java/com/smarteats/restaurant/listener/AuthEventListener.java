package com.smarteats.restaurant.listener;

import com.smarteats.common.event.RestaurantOwnerRegisteredEvent;
import com.smarteats.common.event.UserStatusChangedEvent;
import com.smarteats.restaurant.entity.Restaurant;
import com.smarteats.restaurant.repository.RestaurantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
public class AuthEventListener {

    private final RestaurantRepository restaurantRepository;

    public AuthEventListener(RestaurantRepository restaurantRepository) {
        this.restaurantRepository = restaurantRepository;
    }

    @KafkaListener(topics = "${kafka.topic.restaurant-registered:smarteats.auth.restaurant-registered}", groupId = "restaurant-service-group")
    public void handleRestaurantOwnerRegistered(RestaurantOwnerRegisteredEvent event) {
        log.info("Received RestaurantOwnerRegisteredEvent for ownerId '{}': {}", event.getUserId(), event);
        try {
            List<Restaurant> existing = restaurantRepository.findByOwnerId(event.getUserId());
            if (existing.isEmpty()) {
                String restaurantName = event.getRestaurantName() != null && !event.getRestaurantName().isBlank()
                        ? event.getRestaurantName()
                        : event.getName() + " Kitchen";

                Restaurant restaurant = Restaurant.builder()
                        .ownerId(event.getUserId())
                        .ownerEmail(event.getEmail())
                        .name(restaurantName)
                        .description(event.getDescription())
                        .address(event.getRestaurantAddress())
                        .city(event.getCity())
                        .pincode(event.getPincode())
                        .latitude(event.getLatitude())
                        .longitude(event.getLongitude())
                        .location(event.getRestaurantLocation())
                        .phone(event.getPhone() != null ? event.getPhone() : event.getRestaurantContact())
                        .email(event.getRestaurantEmail() != null ? event.getRestaurantEmail() : event.getEmail())
                        .cuisineType(event.getCuisineType() != null ? event.getCuisineType() : "Multi-Cuisine")
                        .openingTime(event.getOpeningTime() != null ? event.getOpeningTime() : "10:00 AM")
                        .closingTime(event.getClosingTime() != null ? event.getClosingTime() : "10:00 PM")
                        .logoUrl(event.getLogoUrl())
                        .businessRegistrationNumber(event.getBusinessRegistrationNumber())
                        .foodLicenseNumber(event.getFoodLicenseNumber())
                        .verificationDocumentUrl(event.getVerificationDocumentUrl())
                        .approved(false)
                        .status("PENDING")
                        .open(true)
                        .build();

                restaurant.syncGeoLocation();
                Restaurant saved = restaurantRepository.save(restaurant);
                log.info("Created restaurant profile with ID '{}' for owner '{}'", saved.getId(), event.getEmail());
            }
        } catch (Exception e) {
            log.error("Failed to handle RestaurantOwnerRegisteredEvent: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "${kafka.topic.status-updated:smarteats.auth.status-updated}", groupId = "restaurant-service-group")
    public void handleUserStatusChanged(UserStatusChangedEvent event) {
        log.info("Received UserStatusChangedEvent in Restaurant Service: {}", event);
        try {
            if ("RESTAURANT_OWNER".equalsIgnoreCase(event.getRole()) || "RESTAURANT".equalsIgnoreCase(event.getRole())) {
                List<Restaurant> restaurants = restaurantRepository.findByOwnerId(event.getUserId());
                if (restaurants.isEmpty()) {
                    restaurants = restaurantRepository.findByOwnerEmail(event.getEmail());
                }

                boolean isApproved = "ACTIVE".equalsIgnoreCase(event.getStatus());
                for (Restaurant rest : restaurants) {
                    rest.setStatus(event.getStatus());
                    rest.setApproved(isApproved);
                    restaurantRepository.save(rest);
                    log.info("Updated restaurant '{}' status to '{}'", rest.getName(), event.getStatus());
                }
            }
        } catch (Exception e) {
            log.error("Failed to handle UserStatusChangedEvent in Restaurant Service: {}", e.getMessage(), e);
        }
    }
}
