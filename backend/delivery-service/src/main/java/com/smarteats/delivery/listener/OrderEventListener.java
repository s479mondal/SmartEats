package com.smarteats.delivery.listener;

import com.smarteats.delivery.service.DeliveryService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class OrderEventListener {

    private final DeliveryService deliveryService;

    // Constructor injection
    public OrderEventListener(DeliveryService deliveryService) {
        this.deliveryService = deliveryService;
    }

    @RabbitListener(queues = "${rabbitmq.queue.restaurant-accepted}")
    public void handleRestaurantAcceptedEvent(String orderId) {
        log.info("Received RestaurantAccepted event for order ID: {}", orderId);
        try {
            // Simulated restaurant and customer emails for foundation setup
            deliveryService.createPendingDelivery(orderId, "mock-restaurant-id", "mock-customer-email");
        } catch (Exception e) {
            log.error("Failed to process RestaurantAccepted event for order ID: {}", orderId, e);
        }
    }
}
