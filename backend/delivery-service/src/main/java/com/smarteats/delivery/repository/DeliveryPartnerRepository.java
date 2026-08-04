package com.smarteats.delivery.repository;

import com.smarteats.delivery.entity.DeliveryPartner;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryPartnerRepository extends MongoRepository<DeliveryPartner, String> {
    Optional<DeliveryPartner> findByEmail(String email);
    List<DeliveryPartner> findByActiveAndAvailable(boolean active, boolean available);
}
