package com.smarteats.delivery.service;

import com.smarteats.delivery.dto.DeliveryPartnerRegisterRequest;
import com.smarteats.delivery.dto.DeliveryPartnerResponse;
import com.smarteats.delivery.dto.DeliveryResponse;

import java.util.List;

public interface DeliveryService {
    DeliveryPartnerResponse registerPartner(DeliveryPartnerRegisterRequest request);
    DeliveryPartnerResponse updatePartnerAvailability(String email, boolean active, boolean available);
    DeliveryResponse getDeliveryById(String id);
    List<DeliveryResponse> getPartnerDeliveries(String partnerEmail);
    DeliveryResponse acceptDelivery(String deliveryId, String partnerEmail);
    DeliveryResponse updateDeliveryStatus(String deliveryId, String status, String partnerEmail);
    
    // Internal triggering
    DeliveryResponse createPendingDelivery(String orderId, String restaurantId, String customerEmail);
    void triggerRiderAssignment(String deliveryId);
}
