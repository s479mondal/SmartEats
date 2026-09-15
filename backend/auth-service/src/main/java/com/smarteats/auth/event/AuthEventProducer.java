package com.smarteats.auth.event;

import com.smarteats.common.event.DeliveryPartnerRegisteredEvent;
import com.smarteats.common.event.NGORegisteredEvent;
import com.smarteats.common.event.RestaurantOwnerRegisteredEvent;
import com.smarteats.common.event.UserStatusChangedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class AuthEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.topic.restaurant-registered:smarteats.auth.restaurant-registered}")
    private String restaurantRegisteredTopic;

    @Value("${kafka.topic.driver-registered:smarteats.auth.driver-registered}")
    private String driverRegisteredTopic;

    @Value("${kafka.topic.ngo-registered:smarteats.auth.ngo-registered}")
    private String ngoRegisteredTopic;

    @Value("${kafka.topic.status-updated:smarteats.auth.status-updated}")
    private String statusUpdatedTopic;

    public AuthEventProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishRestaurantOwnerRegistered(RestaurantOwnerRegisteredEvent event) {
        log.info("Publishing RestaurantOwnerRegisteredEvent to topic '{}': {}", restaurantRegisteredTopic, event);
        try {
            kafkaTemplate.send(restaurantRegisteredTopic, event.getUserId(), event);
        } catch (Exception e) {
            log.error("Failed to publish RestaurantOwnerRegisteredEvent: {}", e.getMessage(), e);
        }
    }

    public void publishDeliveryPartnerRegistered(DeliveryPartnerRegisteredEvent event) {
        log.info("Publishing DeliveryPartnerRegisteredEvent to topic '{}': {}", driverRegisteredTopic, event);
        try {
            kafkaTemplate.send(driverRegisteredTopic, event.getUserId(), event);
        } catch (Exception e) {
            log.error("Failed to publish DeliveryPartnerRegisteredEvent: {}", e.getMessage(), e);
        }
    }

    public void publishNGORegistered(NGORegisteredEvent event) {
        log.info("Publishing NGORegisteredEvent to topic '{}': {}", ngoRegisteredTopic, event);
        try {
            kafkaTemplate.send(ngoRegisteredTopic, event.getUserId(), event);
        } catch (Exception e) {
            log.error("Failed to publish NGORegisteredEvent: {}", e.getMessage(), e);
        }
    }

    public void publishUserStatusChanged(UserStatusChangedEvent event) {
        log.info("Publishing UserStatusChangedEvent to topic '{}': {}", statusUpdatedTopic, event);
        try {
            kafkaTemplate.send(statusUpdatedTopic, event.getUserId(), event);
        } catch (Exception e) {
            log.error("Failed to publish UserStatusChangedEvent: {}", e.getMessage(), e);
        }
    }
}
