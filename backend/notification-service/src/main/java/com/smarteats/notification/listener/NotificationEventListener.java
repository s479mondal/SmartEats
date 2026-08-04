package com.smarteats.notification.listener;

import com.smarteats.notification.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
public class NotificationEventListener {

    private final NotificationService notificationService;

    public NotificationEventListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = "${rabbitmq.queue.order-created}")
    public void handleOrderCreatedEvent(Map<String, Object> event) {
        log.info("Received OrderCreated event in notification-service: {}", event);
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

    @RabbitListener(queues = "${rabbitmq.queue.restaurant-accepted}")
    public void handleRestaurantAcceptedEvent(String orderId) {
        log.info("Received RestaurantAccepted event in notification-service for order: {}", orderId);
        try {
            // In a production system, we'd fetch the order details to get customer email.
            // For foundation purposes, we notify a simulated customer or use orderId to represent recipient email for demonstration.
            String customerEmail = "customer@smarteats.com"; 
            String msg = String.format("Good news! The restaurant has accepted your order #%s and is preparing it.", orderId);
            notificationService.sendNotification(customerEmail, msg, orderId, "RESTAURANT_ACCEPTED");
        } catch (Exception e) {
            log.error("Error processing RestaurantAccepted event", e);
        }
    }

    @RabbitListener(queues = "${rabbitmq.queue.delivery-assigned}")
    public void handleDeliveryAssignedEvent(String orderId) {
        log.info("Received DeliveryAssigned event in notification-service for order: {}", orderId);
        try {
            String customerEmail = "customer@smarteats.com";
            String msg = String.format("A delivery partner has been assigned to pick up your order #%s.", orderId);
            notificationService.sendNotification(customerEmail, msg, orderId, "DELIVERY_ASSIGNED");
        } catch (Exception e) {
            log.error("Error processing DeliveryAssigned event", e);
        }
    }

    @RabbitListener(queues = "${rabbitmq.queue.order-delivered}")
    public void handleOrderDeliveredEvent(String orderId) {
        log.info("Received OrderDelivered event in notification-service for order: {}", orderId);
        try {
            String customerEmail = "customer@smarteats.com";
            String msg = String.format("Yum! Your order #%s has been successfully delivered. Enjoy your meal!", orderId);
            notificationService.sendNotification(customerEmail, msg, orderId, "ORDER_DELIVERED");
        } catch (Exception e) {
            log.error("Error processing OrderDelivered event", e);
        }
    }
}
