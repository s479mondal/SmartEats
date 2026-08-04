package com.smarteats.delivery.strategy;

import com.smarteats.delivery.entity.Delivery;
import com.smarteats.delivery.entity.DeliveryPartner;

import java.util.List;
import java.util.Optional;

public interface DeliveryAssignmentStrategy {
    Optional<DeliveryPartner> assignRider(Delivery delivery, List<DeliveryPartner> availableRiders);
}
