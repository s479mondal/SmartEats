package com.smarteats.restaurant.repository;

import com.smarteats.restaurant.entity.MenuItem;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MenuItemRepository extends MongoRepository<MenuItem, String> {
    List<MenuItem> findByRestaurantId(String restaurantId);
    List<MenuItem> findByRestaurantIdAndAvailable(String restaurantId, boolean available);
}
