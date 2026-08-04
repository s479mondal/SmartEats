package com.smarteats.delivery.config;

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

    @Value("${rabbitmq.queue.restaurant-accepted}")
    private String restaurantAcceptedQueueName;

    @Value("${rabbitmq.routing-key.restaurant-accepted}")
    private String restaurantAcceptedRoutingKey;

    @Value("${rabbitmq.queue.delivery-assigned}")
    private String deliveryAssignedQueueName;

    @Value("${rabbitmq.routing-key.delivery-assigned}")
    private String deliveryAssignedRoutingKey;

    @Value("${rabbitmq.queue.order-delivered}")
    private String orderDeliveredQueueName;

    @Value("${rabbitmq.routing-key.order-delivered}")
    private String orderDeliveredRoutingKey;

    @Bean
    public TopicExchange orderExchange() {
        return new TopicExchange(exchange);
    }

    @Bean
    public Queue restaurantAcceptedQueue() {
        return new Queue(restaurantAcceptedQueueName, true);
    }

    @Bean
    public Binding restaurantAcceptedBinding() {
        return BindingBuilder
                .bind(restaurantAcceptedQueue())
                .to(orderExchange())
                .with(restaurantAcceptedRoutingKey);
    }

    @Bean
    public Queue deliveryAssignedQueue() {
        return new Queue(deliveryAssignedQueueName, true);
    }

    @Bean
    public Binding deliveryAssignedBinding() {
        return BindingBuilder
                .bind(deliveryAssignedQueue())
                .to(orderExchange())
                .with(deliveryAssignedRoutingKey);
    }

    @Bean
    public Queue orderDeliveredQueue() {
        return new Queue(orderDeliveredQueueName, true);
    }

    @Bean
    public Binding orderDeliveredBinding() {
        return BindingBuilder
                .bind(orderDeliveredQueue())
                .to(orderExchange())
                .with(orderDeliveredRoutingKey);
    }

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
