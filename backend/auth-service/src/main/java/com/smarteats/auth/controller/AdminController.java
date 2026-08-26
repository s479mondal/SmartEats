package com.smarteats.auth.controller;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.smarteats.auth.entity.Role;
import com.smarteats.auth.entity.User;
import com.smarteats.auth.repository.UserRepository;
import com.smarteats.common.dto.ApiResponse;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final MongoClient mongoClient;

    public AdminController(UserRepository userRepository, MongoClient mongoClient) {
        this.userRepository = userRepository;
        this.mongoClient = mongoClient;
    }

    @GetMapping("/approvals/pending")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPendingApprovals() {
        Map<String, Object> data = new HashMap<>();

        // 1. Fetch pending restaurants from smarteats_restaurant.restaurants
        List<Map<String, Object>> pendingRestaurants = new ArrayList<>();
        try {
            MongoDatabase restDb = mongoClient.getDatabase("smarteats_restaurant");
            MongoCollection<Document> restaurantsCol = restDb.getCollection("restaurants");
            for (Document doc : restaurantsCol.find()) {
                Map<String, Object> rest = new HashMap<>();
                
                // Get ID
                Object idObj = doc.get("_id");
                rest.put("id", idObj != null ? idObj.toString() : "");
                
                rest.put("name", doc.getOrDefault("name", ""));
                rest.put("ownerEmail", doc.getOrDefault("ownerEmail", ""));
                rest.put("address", doc.getOrDefault("address", ""));
                rest.put("phone", doc.getOrDefault("phone", ""));
                rest.put("cuisineType", doc.getOrDefault("cuisineType", ""));
                
                boolean approved = doc.getBoolean("approved", false);
                rest.put("status", approved ? "APPROVED" : "PENDING");
                
                pendingRestaurants.add(rest);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 2. Fetch pending drivers (DELIVERY_PARTNER) and NGOs from smarteats_auth.users
        List<Map<String, Object>> pendingDrivers = new ArrayList<>();
        List<Map<String, Object>> pendingNgos = new ArrayList<>();

        List<User> allUsers = userRepository.findAll();
        for (User user : allUsers) {
            String mappedStatus = "PENDING";
            if ("APPROVED".equalsIgnoreCase(user.getStatus())) {
                mappedStatus = "APPROVED";
            } else if ("REJECTED".equalsIgnoreCase(user.getStatus())) {
                mappedStatus = "REJECTED";
            }

            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", user.getId());
            userMap.put("name", user.getName());
            userMap.put("email", user.getEmail());
            userMap.put("phone", ""); // Set default since it is not in entity
            userMap.put("status", mappedStatus);

            if (user.getRoles().contains(Role.DELIVERY_PARTNER)) {
                userMap.put("vehicle", "BIKE");
                pendingDrivers.add(userMap);
            } else if (user.getRoles().contains(Role.NGO)) {
                pendingNgos.add(userMap);
            } else if (user.getRoles().contains(Role.RESTAURANT_OWNER)) {
                // If the Restaurant Owner User Account itself is not approved yet, list it in the restaurants queue so the admin can verify/approve it!
                if (!"APPROVED".equalsIgnoreCase(user.getStatus())) {
                    Map<String, Object> ownerItem = new HashMap<>();
                    ownerItem.put("id", user.getId());
                    ownerItem.put("name", user.getName() + " (Owner Account)");
                    ownerItem.put("ownerEmail", user.getEmail());
                    ownerItem.put("cuisineType", "Account Registration");
                    ownerItem.put("phone", "N/A");
                    ownerItem.put("status", mappedStatus);
                    pendingRestaurants.add(ownerItem);
                }
            }
        }

        data.put("restaurants", pendingRestaurants);
        data.put("deliveryPartners", pendingDrivers);
        data.put("ngos", pendingNgos);

        return ResponseEntity.ok(ApiResponse.success(data, "Pending approvals fetched successfully"));
    }

    @PutMapping("/approvals/{type}/{id}")
    public ResponseEntity<ApiResponse<Void>> updateApprovalStatus(
            @PathVariable String type,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        
        String action = body.getOrDefault("action", "APPROVED");
        boolean isApproved = "APPROVED".equalsIgnoreCase(action);
        String newStatus = isApproved ? "APPROVED" : "REJECTED";

        // Check if the target ID is a User account first
        Optional<User> userOpt = userRepository.findById(id);

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setStatus(newStatus);
            user.setApproved(isApproved);
            userRepository.save(user);

            // If it's a Delivery Partner, upsert the partner record in delivery database
            if (isApproved && user.getRoles().contains(Role.DELIVERY_PARTNER)) {
                try {
                    MongoDatabase deliveryDb = mongoClient.getDatabase("smarteats_delivery");
                    MongoCollection<Document> partnersCol = deliveryDb.getCollection("partners");
                    
                    Document partnerFilter = new Document("_id", id);
                    Document partnerDoc = new Document()
                            .append("_id", id)
                            .append("name", user.getName())
                            .append("phone", "+91 9988776655")
                            .append("vehicleType", "BIKE")
                            .append("status", "AVAILABLE")
                            .append("rating", 5.0);

                    partnersCol.replaceOne(partnerFilter, partnerDoc, new com.mongodb.client.model.ReplaceOptions().upsert(true));
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        } else if ("restaurants".equalsIgnoreCase(type)) {
            // If it's not a user ID, update the restaurant entity in the database
            try {
                MongoDatabase restDb = mongoClient.getDatabase("smarteats_restaurant");
                MongoCollection<Document> restaurantsCol = restDb.getCollection("restaurants");
                
                Document filter = new Document();
                if (id.length() == 24) {
                    try {
                        filter.put("_id", new ObjectId(id));
                    } catch (IllegalArgumentException e) {
                        filter.put("_id", id);
                    }
                } else {
                    filter.put("_id", id);
                }

                Document restaurant = restaurantsCol.find(filter).first();
                if (restaurant != null) {
                    restaurantsCol.updateOne(filter, new Document("$set", new Document("approved", isApproved)));
                    
                    // Also approve the owner user account matching this restaurant
                    String ownerEmail = restaurant.getString("ownerEmail");
                    if (ownerEmail != null) {
                        Optional<User> ownerOpt = userRepository.findByEmail(ownerEmail);
                        if (ownerOpt.isPresent()) {
                            User owner = ownerOpt.get();
                            owner.setStatus(newStatus);
                            owner.setApproved(isApproved);
                            userRepository.save(owner);
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                return ResponseEntity.internalServerError().body(ApiResponse.error("Error updating restaurant status: " + e.getMessage()));
            }
        }

        return ResponseEntity.ok(ApiResponse.success(null, "Status updated successfully"));
    }
}
