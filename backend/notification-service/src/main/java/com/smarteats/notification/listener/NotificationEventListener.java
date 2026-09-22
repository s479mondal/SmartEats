package com.smarteats.notification.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarteats.notification.client.DeliveryServiceClient;
import com.smarteats.notification.client.RestaurantServiceClient;
import com.smarteats.notification.repository.NotificationRepository;
import com.smarteats.notification.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class NotificationEventListener {

    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;
    private final DeliveryServiceClient deliveryServiceClient;
    private final RestaurantServiceClient restaurantServiceClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public NotificationEventListener(NotificationService notificationService,
                                     NotificationRepository notificationRepository,
                                     DeliveryServiceClient deliveryServiceClient,
                                     RestaurantServiceClient restaurantServiceClient) {
        this.notificationService = notificationService;
        this.notificationRepository = notificationRepository;
        this.deliveryServiceClient = deliveryServiceClient;
        this.restaurantServiceClient = restaurantServiceClient;
    }

    @KafkaListener(topics = "${kafka.topic.order-created:smarteats.order.created}", groupId = "notification-group")
    public void handleOrderCreatedEvent(String payload) {
        log.info("Received OrderCreated event from Kafka in notification-service: {}", payload);
        try {
            Map<String, Object> event = objectMapper.readValue(payload, Map.class);
            String orderId = String.valueOf(event.get("orderId"));
            String customerEmail = String.valueOf(event.get("customerEmail"));
            double amount = Double.parseDouble(String.valueOf(event.get("totalAmount")));

            String msg = String.format("Thank you! Your order #%s of $%.2f was placed successfully.", orderId, amount);
            notificationService.sendNotification(customerEmail, msg, orderId, "ORDER_CREATED");
        } catch (Exception e) {
            log.error("Error processing OrderCreated event", e);
        }
    }

    @KafkaListener(topics = "${kafka.topic.delivery-offer:smarteats.delivery.offer}", groupId = "notification-group")
    public void handleDeliveryOfferEvent(String payload) {
        log.info("Received DeliveryOffer event from Kafka in notification-service: {}", payload);
        try {
            Map<String, Object> event = objectMapper.readValue(payload, Map.class);
            String orderId = String.valueOf(event.get("orderId"));
            String driverEmail = String.valueOf(event.get("driverEmail"));
            String restaurantName = event.get("restaurantName") != null ? String.valueOf(event.get("restaurantName")) : "Restaurant";
            double distanceKm = event.get("distanceKm") != null ? Double.parseDouble(String.valueOf(event.get("distanceKm"))) : 0.0;

            if (driverEmail != null && !driverEmail.isBlank()) {
                String msg = String.format("New Delivery Offer: Order #%s from %s is available (%.1f km away).",
                        orderId, restaurantName, distanceKm);
                notificationService.sendNotification(driverEmail, msg, orderId, "DELIVERY_OFFER");
                log.info("Sent DELIVERY_OFFER notification to driver: {} for order: {}", driverEmail, orderId);
            }
        } catch (Exception e) {
            log.error("Error processing DeliveryOffer event", e);
        }
    }

    @KafkaListener(topics = "${kafka.topic.delivery-assigned:smarteats.delivery.assigned}", groupId = "notification-group")
    public void handleDeliveryAssignedEvent(String payload) {
        log.info("Received DeliveryAssigned event from Kafka in notification-service: {}", payload);
        try {
            String orderId = payload;
            String customerEmail = "customer@smarteats.com";
            String driverEmail = null;
            String driverName = null;
            String restaurantId = null;
            List<String> losingDriverEmails = null;

            if (payload != null && payload.trim().startsWith("{")) {
                Map<String, Object> event = objectMapper.readValue(payload, Map.class);
                orderId = String.valueOf(event.get("orderId"));
                if (event.get("customerEmail") != null && !String.valueOf(event.get("customerEmail")).isBlank()) {
                    customerEmail = String.valueOf(event.get("customerEmail"));
                }
                if (event.get("deliveryPartnerEmail") != null && !String.valueOf(event.get("deliveryPartnerEmail")).isBlank()) {
                    driverEmail = String.valueOf(event.get("deliveryPartnerEmail"));
                }
                if (event.get("driverName") != null) {
                    driverName = String.valueOf(event.get("driverName"));
                }
                if (event.get("restaurantId") != null) {
                    restaurantId = String.valueOf(event.get("restaurantId"));
                }
                if (event.get("losingDriverEmails") instanceof List) {
                    losingDriverEmails = (List<String>) event.get("losingDriverEmails");
                }
            }

            // 1. Customer notification
            if (customerEmail != null && !customerEmail.isBlank()) {
                String msg = String.format("A delivery partner has been assigned to pick up your order #%s.", orderId);
                notificationService.sendNotification(customerEmail, msg, orderId, "DELIVERY_ASSIGNED");
            }

            // 2. Winning driver notification
            if (driverEmail != null && !driverEmail.isBlank()) {
                String winMsg = String.format("Assignment Confirmed! You have been assigned to pick up and deliver order #%s.", orderId);
                if (!notificationRepository.existsByRecipientEmailAndOrderIdAndType(driverEmail, orderId, "OFFER_CONFIRMED")) {
                    notificationService.sendNotification(driverEmail, winMsg, orderId, "OFFER_CONFIRMED");
                    log.info("Sent OFFER_CONFIRMED notification to winning driver: {} for order: {}", driverEmail, orderId);
                }
            }

            // 3. Restaurant owner notification
            if (restaurantId != null && !restaurantId.isBlank() && restaurantServiceClient != null) {
                String ownerEmail = restaurantServiceClient.getRestaurantOwnerEmail(restaurantId);
                if (ownerEmail != null && !ownerEmail.isBlank()) {
                    String restMsg = String.format("Delivery partner %s has been assigned to pick up Order #%s.",
                            driverName != null ? driverName : driverEmail, orderId);
                    if (!notificationRepository.existsByRecipientEmailAndOrderIdAndType(ownerEmail, orderId, "DRIVER_ASSIGNED")) {
                        notificationService.sendNotification(ownerEmail, restMsg, orderId, "DRIVER_ASSIGNED");
                        log.info("Sent DRIVER_ASSIGNED notification to restaurant owner: {} for order: {}", ownerEmail, orderId);
                    }
                }
            }

            // 4. Losing candidate drivers notification
            if (losingDriverEmails != null && !losingDriverEmails.isEmpty()) {
                for (String losingEmail : losingDriverEmails) {
                    if (losingEmail != null && !losingEmail.isBlank() && !losingEmail.equalsIgnoreCase(driverEmail)) {
                        String loseMsg = String.format("Delivery offer for Order #%s is no longer available (assigned to another partner).", orderId);
                        if (!notificationRepository.existsByRecipientEmailAndOrderIdAndType(losingEmail, orderId, "OFFER_EXPIRED")) {
                            notificationService.sendNotification(losingEmail, loseMsg, orderId, "OFFER_EXPIRED");
                            log.info("Sent OFFER_EXPIRED notification to candidate driver: {} for order: {}", losingEmail, orderId);
                        }
                    }
                }
            }

        } catch (Exception e) {
            log.error("Error processing DeliveryAssigned event", e);
        }
    }

    @KafkaListener(topics = "${kafka.topic.order-delivered:smarteats.order.delivered}", groupId = "notification-group")
    public void handleOrderDeliveredEvent(String payload) {
        log.info("Received OrderDelivered event from Kafka in notification-service: {}", payload);
        try {
            String orderId = payload;
            String customerEmail = "customer@smarteats.com";
            if (payload != null && payload.trim().startsWith("{")) {
                Map<String, Object> event = objectMapper.readValue(payload, Map.class);
                orderId = String.valueOf(event.get("orderId"));
                if (event.get("customerEmail") != null && !String.valueOf(event.get("customerEmail")).isBlank()) {
                    customerEmail = String.valueOf(event.get("customerEmail"));
                }
            }
            String msg = String.format("Yum! Your order #%s has been successfully delivered. Enjoy your meal!", orderId);
            notificationService.sendNotification(customerEmail, msg, orderId, "ORDER_DELIVERED");
        } catch (Exception e) {
            log.error("Error processing OrderDelivered event", e);
        }
    }

    @KafkaListener(topics = "${kafka.topic.order-ready:smarteats.order.ready}", groupId = "notification-group")
    public void handleOrderReadyEvent(String payload) {
        log.info("Received OrderReady event from Kafka in notification-service: {}", payload);
        try {
            if (payload == null || payload.isBlank()) {
                log.warn("Received empty OrderReady payload from Kafka");
                return;
            }
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(payload);
            String orderId = null;
            if (root.has("orderId") && !root.get("orderId").isNull()) {
                orderId = root.get("orderId").asText();
            } else if (root.has("id") && !root.get("id").isNull()) {
                orderId = root.get("id").asText();
            }

            if (orderId == null || orderId.isBlank()) {
                log.error("OrderReady event missing orderId: {}", payload);
                return;
            }

            // 1. Find the already assigned delivery partner for that order from Delivery Service
            String driverEmail = deliveryServiceClient.getAssignedDriverEmail(orderId);

            // 2. If assigned, send notification to that driver: "Order #{orderId} is ready for pickup."
            if (driverEmail != null && !driverEmail.isBlank()) {
                String message = String.format("Order #%s is ready for pickup.", orderId);
                if (!notificationRepository.existsByRecipientEmailAndOrderIdAndType(driverEmail, orderId, "ORDER_READY")) {
                    notificationService.sendNotification(driverEmail, message, orderId, "ORDER_READY");
                    log.info("Sent ORDER_READY notification to assigned driver: {} for order: {}", driverEmail, orderId);
                } else {
                    log.info("Duplicate ORDER_READY notification suppressed for driver: {} and order: {}", driverEmail, orderId);
                }
            } else {
                // 3. If no driver is assigned, do not invent/fake a driver. Log the condition safely.
                log.warn("Order #{} is READY but no delivery partner is currently assigned. Skipping driver notification.", orderId);
            }
        } catch (Exception e) {
            log.error("Error processing OrderReady event", e);
        }
    }
}
