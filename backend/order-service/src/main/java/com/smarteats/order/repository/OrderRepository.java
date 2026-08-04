package com.smarteats.order.repository;

import com.smarteats.order.entity.Order;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends MongoRepository<Order, String> {
    List<Order> findByCustomerEmail(String customerEmail);
    List<Order> findByRestaurantId(String restaurantId);
}
