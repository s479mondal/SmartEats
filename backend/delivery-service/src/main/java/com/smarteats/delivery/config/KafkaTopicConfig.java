package com.smarteats.delivery.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {

    @Value("${kafka.topic.delivery-assigned:smarteats.delivery.assigned}")
    private String deliveryAssignedTopic;

    @Value("${kafka.topic.order-delivered:smarteats.order.delivered}")
    private String orderDeliveredTopic;

    @Bean
    public NewTopic deliveryAssignedTopic() {
        return TopicBuilder.name(deliveryAssignedTopic)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic orderDeliveredTopic() {
        return TopicBuilder.name(orderDeliveredTopic)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
