package com.smarteats.notification.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    @Value("${rabbitmq.exchange}")
    private String exchange;

    @Value("${rabbitmq.queue.order-created}")
    private String orderCreatedQueue;

    @Value("${rabbitmq.routing-key.order-created}")
    private String orderCreatedRoutingKey;

    @Value("${rabbitmq.queue.restaurant-accepted}")
    private String restaurantAcceptedQueue;

    @Value("${rabbitmq.routing-key.restaurant-accepted}")
    private String restaurantAcceptedRoutingKey;

    @Value("${rabbitmq.queue.delivery-assigned}")
    private String deliveryAssignedQueue;

    @Value("${rabbitmq.routing-key.delivery-assigned}")
    private String deliveryAssignedRoutingKey;

    @Value("${rabbitmq.queue.order-delivered}")
    private String orderDeliveredQueue;

    @Value("${rabbitmq.routing-key.order-delivered}")
    private String orderDeliveredRoutingKey;

    @Bean
    public TopicExchange orderExchange() {
        return new TopicExchange(exchange);
    }

    @Bean
    public Queue orderCreatedNotificationQueue() {
        return new Queue(orderCreatedQueue, true);
    }

    @Bean
    public Binding orderCreatedNotificationBinding() {
        return BindingBuilder
                .bind(orderCreatedNotificationQueue())
                .to(orderExchange())
                .with(orderCreatedRoutingKey);
    }

    @Bean
    public Queue restaurantAcceptedNotificationQueue() {
        return new Queue(restaurantAcceptedQueue, true);
    }

    @Bean
    public Binding restaurantAcceptedNotificationBinding() {
        return BindingBuilder
                .bind(restaurantAcceptedNotificationQueue())
                .to(orderExchange())
                .with(restaurantAcceptedRoutingKey);
    }

    @Bean
    public Queue deliveryAssignedNotificationQueue() {
        return new Queue(deliveryAssignedQueue, true);
    }

    @Bean
    public Binding deliveryAssignedNotificationBinding() {
        return BindingBuilder
                .bind(deliveryAssignedNotificationQueue())
                .to(orderExchange())
                .with(deliveryAssignedRoutingKey);
    }

    @Bean
    public Queue orderDeliveredNotificationQueue() {
        return new Queue(orderDeliveredQueue, true);
    }

    @Bean
    public Binding orderDeliveredNotificationBinding() {
        return BindingBuilder
                .bind(orderDeliveredNotificationQueue())
                .to(orderExchange())
                .with(orderDeliveredRoutingKey);
    }

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
