package com.smarteats.delivery.strategy;

import com.smarteats.delivery.entity.Delivery;
import com.smarteats.delivery.entity.DeliveryPartner;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
public class HaversineAssignmentStrategy implements DeliveryAssignmentStrategy {

    private static final double EARTH_RADIUS_KM = 6371.0;

    @Override
    public Optional<DeliveryPartner> assignRider(Delivery delivery, List<DeliveryPartner> availableRiders) {
        List<CandidateRider> candidates = findCandidateRiders(delivery, availableRiders, 1, null);
        if (candidates.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(candidates.get(0).getPartner());
    }

    @Override
    public List<CandidateRider> findCandidateRiders(Delivery delivery, List<DeliveryPartner> availableRiders, int limit, Set<String> excludedEmails) {
        if (availableRiders == null || availableRiders.isEmpty()) {
            return List.of();
        }

        double restLat = delivery.getRestaurantLatitude();
        double restLon = delivery.getRestaurantLongitude();

        if (!isValidCoordinate(restLat, restLon)) {
            log.warn("Invalid restaurant coordinates [{}, {}] for delivery {}", restLat, restLon, delivery.getId());
            return List.of();
        }

        List<CandidateRider> candidates = new ArrayList<>();

        for (DeliveryPartner rider : availableRiders) {
            if (rider == null || rider.getEmail() == null || rider.getEmail().isBlank()) {
                continue;
            }

            // Exclude already offered / rejected drivers for this order
            if (excludedEmails != null && excludedEmails.contains(rider.getEmail().trim().toLowerCase())) {
                continue;
            }

            // Must be active and available
            if (!rider.isActive() || !rider.isAvailable()) {
                continue;
            }

            // Resolve coordinates: Prioritize Live GPS beacon, then registered operational coords
            double riderLat;
            double riderLon;

            if (rider.getCurrentLatitude() != null && rider.getCurrentLongitude() != null
                    && isValidCoordinate(rider.getCurrentLatitude(), rider.getCurrentLongitude())) {
                riderLat = rider.getCurrentLatitude();
                riderLon = rider.getCurrentLongitude();
            } else if (isValidCoordinate(rider.getLatitude(), rider.getLongitude())) {
                riderLat = rider.getLatitude();
                riderLon = rider.getLongitude();
            } else if (isValidCoordinate(rider.getBaseLatitude(), rider.getBaseLongitude())) {
                riderLat = rider.getBaseLatitude();
                riderLon = rider.getBaseLongitude();
            } else {
                log.debug("Skipping rider {} - no valid coordinates found", rider.getEmail());
                continue;
            }

            double distance = calculateDistance(restLat, restLon, riderLat, riderLon);

            candidates.add(CandidateRider.builder()
                    .partner(rider)
                    .distanceKm(Math.round(distance * 100.0) / 100.0)
                    .riderLatitude(riderLat)
                    .riderLongitude(riderLon)
                    .build());
        }

        // Sort ascending by distance (nearest drivers first)
        candidates.sort(Comparator.comparingDouble(CandidateRider::getDistanceKm));

        int effectiveLimit = limit > 0 ? limit : 5;
        return candidates.stream()
                .limit(effectiveLimit)
                .collect(Collectors.toList());
    }

    private boolean isValidCoordinate(double lat, double lon) {
        return lat >= -90.0 && lat <= 90.0 && lon >= -180.0 && lon <= 180.0 && !(lat == 0.0 && lon == 0.0);
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double rLat1 = Math.toRadians(lat1);
        double rLat2 = Math.toRadians(lat2);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);

        double c = 2 * Math.asin(Math.sqrt(a));

        return EARTH_RADIUS_KM * c;
    }
}
