package com.smarteats.order.listener;

import com.smarteats.order.entity.Order;
import com.smarteats.order.entity.OrderStatus;
import com.smarteats.order.repository.OrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Slf4j
@Component
public class OrderEventListener {

    private final OrderRepository orderRepository;

    public OrderEventListener(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @KafkaListener(
            topics = "${kafka.topic.order-delivered:smarteats.order.delivered}",
            groupId = "order-service-group"
    )
    public void handleOrderDeliveredEvent(Object payload) {
        log.info("Received OrderDelivered event from Kafka in order-service: {}", payload);
        try {
            if (payload == null) {
                log.warn("Received null payload for OrderDelivered event in order-service");
                return;
            }

            Object actualPayload = payload;
            if (payload instanceof ConsumerRecord<?, ?> record) {
                actualPayload = record.value() != null ? record.value() : record.key();
            }

            // Extract and sanitize order ID (strip any quotation marks added by JSON serialization)
            String orderId = String.valueOf(actualPayload).replaceAll("^\"|\"$", "").trim();
            if (orderId.isBlank()) {
                log.warn("Received blank orderId for OrderDelivered event in order-service");
                return;
            }

            Optional<Order> orderOpt = orderRepository.findById(orderId);
            if (orderOpt.isPresent()) {
                Order order = orderOpt.get();

                // Idempotency check: if already DELIVERED, do nothing
                if (order.getStatus() == OrderStatus.DELIVERED) {
                    log.info("Order {} is already marked as DELIVERED in order-service. Skipping duplicate event.", orderId);
                    return;
                }

                OrderStatus previousStatus = order.getStatus();
                order.setStatus(OrderStatus.DELIVERED);
                orderRepository.save(order);
                log.info("Successfully synchronized Order {} status from {} to DELIVERED in MongoDB Atlas", orderId, previousStatus);
            } else {
                log.warn("Order not found with ID: {} when processing OrderDelivered event in order-service", orderId);
            }
        } catch (Exception e) {
            log.error("Failed to process OrderDelivered event for payload: {}", payload, e);
        }
    }
}
