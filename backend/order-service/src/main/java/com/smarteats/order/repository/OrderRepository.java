package com.smarteats.order.repository;

import com.smarteats.common.enums.PaymentStatus;
import com.smarteats.order.entity.Order;
import com.smarteats.order.entity.OrderStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends MongoRepository<Order, String> {
    List<Order> findByCustomerEmail(String customerEmail);
    List<Order> findByRestaurantId(String restaurantId);
    Optional<Order> findByRazorpayOrderId(String razorpayOrderId);
    Optional<Order> findByIdempotencyKey(String idempotencyKey);
    Optional<Order> findFirstByIdempotencyKey(String idempotencyKey);
    boolean existsByIdempotencyKey(String idempotencyKey);
    List<Order> findByStatusAndPaymentStatus(OrderStatus status, PaymentStatus paymentStatus);
    List<Order> findByStatusAndPaymentStatusAndCreatedAtBefore(OrderStatus status, PaymentStatus paymentStatus, LocalDateTime threshold);
}
