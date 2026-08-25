package com.smarteats.notification.listener;

import com.smarteats.notification.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
public class NotificationEventListener {

    private final NotificationService notificationService;

    public NotificationEventListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @KafkaListener(topics = "${kafka.topic.order-created:smarteats.order.created}", groupId = "notification-group")
    public void handleOrderCreatedEvent(Map<String, Object> event) {
        log.info("Received OrderCreated event from Kafka in notification-service: {}", event);
        try {
            String orderId = (String) event.get("orderId");
            String customerEmail = (String) event.get("customerEmail");
            double amount = (double) event.get("totalAmount");

            String msg = String.format("Thank you! Your order #%s of $%.2f was placed successfully.", orderId, amount);
            notificationService.sendNotification(customerEmail, msg, orderId, "ORDER_CREATED");
        } catch (Exception e) {
            log.error("Error processing OrderCreated event", e);
        }
    }

    @KafkaListener(topics = "${kafka.topic.delivery-assigned:smarteats.delivery.assigned}", groupId = "notification-group")
    public void handleDeliveryAssignedEvent(String orderId) {
        log.info("Received DeliveryAssigned event from Kafka in notification-service for order: {}", orderId);
        try {
            String customerEmail = "customer@smarteats.com";
            String msg = String.format("A delivery partner has been assigned to pick up your order #%s.", orderId);
            notificationService.sendNotification(customerEmail, msg, orderId, "DELIVERY_ASSIGNED");
        } catch (Exception e) {
            log.error("Error processing DeliveryAssigned event", e);
        }
    }

    @KafkaListener(topics = "${kafka.topic.order-delivered:smarteats.order.delivered}", groupId = "notification-group")
    public void handleOrderDeliveredEvent(String orderId) {
        log.info("Received OrderDelivered event from Kafka in notification-service for order: {}", orderId);
        try {
            String customerEmail = "customer@smarteats.com";
            String msg = String.format("Yum! Your order #%s has been successfully delivered. Enjoy your meal!", orderId);
            notificationService.sendNotification(customerEmail, msg, orderId, "ORDER_DELIVERED");
        } catch (Exception e) {
            log.error("Error processing OrderDelivered event", e);
        }
    }
}
