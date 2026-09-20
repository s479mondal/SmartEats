package com.smarteats.delivery.service;

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
    
    // Internal triggering
    DeliveryResponse createPendingDelivery(String orderId, String restaurantId, String customerEmail);
    DeliveryResponse createPendingDelivery(String orderId, String restaurantId, String customerEmail, double restLat, double restLng, double delLat, double delLng);
    void triggerRiderAssignment(String deliveryId);
}
