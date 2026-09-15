package com.smarteats.delivery.listener;

import com.smarteats.common.event.OrderAcceptedEvent;
import com.smarteats.delivery.service.DeliveryService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class OrderEventListener {

    private final DeliveryService deliveryService;

    // Constructor injection
    public OrderEventListener(DeliveryService deliveryService) {
        this.deliveryService = deliveryService;
    }

    @KafkaListener(topics = "${kafka.topic.order-accepted:smarteats.order.accepted}", groupId = "delivery-group")
    public void handleRestaurantAcceptedEvent(OrderAcceptedEvent event) {
        log.info("Received OrderAcceptedEvent from Kafka: {}", event);
        try {
            if (event == null) {
                log.error("Received null OrderAcceptedEvent from Kafka");
                return;
            }
            if (event.getOrderId() == null || event.getOrderId().isBlank()) {
                log.error("Invalid OrderAcceptedEvent: missing orderId");
                return;
            }
            if (event.getRestaurantId() == null || event.getRestaurantId().isBlank()) {
                log.error("Invalid OrderAcceptedEvent: missing restaurantId for order ID: {}", event.getOrderId());
                return;
            }
            if (event.getCustomerEmail() == null || event.getCustomerEmail().isBlank()) {
                log.error("Invalid OrderAcceptedEvent: missing customerEmail for order ID: {}", event.getOrderId());
                return;
            }

            deliveryService.createPendingDelivery(
                    event.getOrderId(),
                    event.getRestaurantId(),
                    event.getCustomerEmail(),
                    event.getRestaurantLatitude(),
                    event.getRestaurantLongitude(),
                    event.getDeliveryLatitude(),
                    event.getDeliveryLongitude()
            );
        } catch (Exception e) {
            log.error("Failed to process OrderAcceptedEvent for event: {}", event, e);
        }
    }
}
