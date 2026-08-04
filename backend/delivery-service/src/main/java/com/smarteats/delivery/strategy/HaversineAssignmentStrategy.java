package com.smarteats.delivery.strategy;

import com.smarteats.delivery.entity.Delivery;
import com.smarteats.delivery.entity.DeliveryPartner;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class HaversineAssignmentStrategy implements DeliveryAssignmentStrategy {

    private static final double EARTH_RADIUS_KM = 6371.0;

    @Override
    public Optional<DeliveryPartner> assignRider(Delivery delivery, List<DeliveryPartner> availableRiders) {
        if (availableRiders == null || availableRiders.isEmpty()) {
            return Optional.empty();
        }

        DeliveryPartner nearestRider = null;
        double minDistance = Double.MAX_VALUE;

        double restLat = delivery.getRestaurantLatitude();
        double restLon = delivery.getRestaurantLongitude();

        for (DeliveryPartner rider : availableRiders) {
            double distance = calculateDistance(restLat, restLon, rider.getLatitude(), rider.getLongitude());
            if (distance < minDistance) {
                minDistance = distance;
                nearestRider = rider;
            }
        }

        return Optional.ofNullable(nearestRider);
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
