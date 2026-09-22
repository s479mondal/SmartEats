package com.smarteats.delivery.strategy;

import com.smarteats.delivery.entity.Delivery;
import com.smarteats.delivery.entity.DeliveryPartner;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface DeliveryAssignmentStrategy {
    Optional<DeliveryPartner> assignRider(Delivery delivery, List<DeliveryPartner> availableRiders);
    List<CandidateRider> findCandidateRiders(Delivery delivery, List<DeliveryPartner> availableRiders, int limit, Set<String> excludedEmails);
}
