package com.smarteats.delivery.repository;

import com.smarteats.delivery.entity.Delivery;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryRepository extends MongoRepository<Delivery, String> {
    Optional<Delivery> findByOrderId(String orderId);
    List<Delivery> findByDeliveryPartnerEmail(String deliveryPartnerEmail);
}
