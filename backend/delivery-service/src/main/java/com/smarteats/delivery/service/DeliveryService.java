package com.smarteats.delivery.service;

import com.smarteats.delivery.dto.DeliveryOfferResponse;
import com.smarteats.delivery.dto.DeliveryPartnerRegisterRequest;
import com.smarteats.delivery.dto.DeliveryPartnerResponse;
import com.smarteats.delivery.dto.DeliveryResponse;

import java.util.List;

public interface DeliveryService {
    DeliveryPartnerResponse registerPartner(DeliveryPartnerRegisterRequest request);
    DeliveryPartnerResponse updatePartnerAvailability(String email, boolean active, boolean available);
    DeliveryPartnerResponse updatePartnerLocation(String email, Double latitude, Double longitude, Double accuracy);
    DeliveryResponse getDeliveryById(String id);
    DeliveryResponse getDeliveryById(String id, String userEmail, String roles);
    DeliveryResponse getDeliveryByOrderId(String orderId, String userEmail, String roles);
    List<DeliveryResponse> getPartnerDeliveries(String partnerEmail);
    DeliveryResponse acceptDelivery(String deliveryId, String partnerEmail);
    DeliveryResponse updateDeliveryStatus(String deliveryId, String status, String partnerEmail);

    // Controlled Broadcast Driver Offer lifecycle
    List<DeliveryOfferResponse> getDriverOffers(String driverEmail);
    DeliveryResponse acceptOffer(String offerId, String driverEmail);
    void rejectOffer(String offerId, String driverEmail);
    void triggerOfferBroadcast(String deliveryId);
    void checkAndHandleExpiredOffers();

    // Internal triggering
    DeliveryResponse createPendingDelivery(String orderId, String restaurantId, String customerEmail);
    DeliveryResponse createPendingDelivery(String orderId, String restaurantId, String customerEmail, double restLat, double restLng, double delLat, double delLng);
    void triggerRiderAssignment(String deliveryId);
}
