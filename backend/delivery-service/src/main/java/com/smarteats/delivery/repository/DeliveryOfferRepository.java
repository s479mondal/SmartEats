package com.smarteats.delivery.repository;

import com.smarteats.delivery.entity.DeliveryOffer;
import com.smarteats.delivery.entity.DeliveryOfferStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryOfferRepository extends MongoRepository<DeliveryOffer, String> {
    List<DeliveryOffer> findByDriverEmailAndStatus(String driverEmail, DeliveryOfferStatus status);
    List<DeliveryOffer> findByDeliveryId(String deliveryId);
    List<DeliveryOffer> findByDeliveryIdAndStatus(String deliveryId, DeliveryOfferStatus status);
    Optional<DeliveryOffer> findByIdAndDriverEmail(String id, String driverEmail);
    List<DeliveryOffer> findByDeliveryIdAndBatchNumber(String deliveryId, int batchNumber);
    List<DeliveryOffer> findByDriverEmail(String driverEmail);
    List<DeliveryOffer> findByStatusAndExpiresAtBefore(DeliveryOfferStatus status, LocalDateTime threshold);
    List<DeliveryOffer> findByStatus(DeliveryOfferStatus status);
}
