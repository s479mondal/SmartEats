package com.smarteats.restaurant.repository;

import com.smarteats.restaurant.entity.ProfileChangeRequest;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProfileChangeRequestRepository extends MongoRepository<ProfileChangeRequest, String> {
    List<ProfileChangeRequest> findByRestaurantId(String restaurantId);
    List<ProfileChangeRequest> findByOwnerEmail(String ownerEmail);
    List<ProfileChangeRequest> findByStatus(String status);
}
