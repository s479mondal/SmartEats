package com.smarteats.restaurant.repository;

import com.smarteats.restaurant.entity.Restaurant;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RestaurantRepository extends MongoRepository<Restaurant, String> {
    List<Restaurant> findByApproved(boolean approved);
    List<Restaurant> findByOwnerEmail(String ownerEmail);
}
