package com.smarteats.auth.controller;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.smarteats.auth.entity.Role;
import com.smarteats.auth.entity.User;
import com.smarteats.auth.event.AuthEventProducer;
import com.smarteats.auth.repository.UserRepository;
import com.smarteats.common.dto.ApiResponse;
import com.smarteats.common.event.UserStatusChangedEvent;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import com.smarteats.common.exception.ForbiddenException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final MongoClient mongoClient;
    private final AuthEventProducer authEventProducer;

    public AdminController(UserRepository userRepository, MongoClient mongoClient, AuthEventProducer authEventProducer) {
        this.userRepository = userRepository;
        this.mongoClient = mongoClient;
        this.authEventProducer = authEventProducer;
    }

    @GetMapping("/approvals/pending")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPendingApprovals(
            @RequestHeader(value = "X-User-Roles", required = false) String rolesHeader) {
        checkAdminRole(rolesHeader);
        Map<String, Object> data = new HashMap<>();

        List<Map<String, Object>> pendingRestaurants = new ArrayList<>();
        List<Map<String, Object>> pendingDrivers = new ArrayList<>();
        List<Map<String, Object>> pendingNgos = new ArrayList<>();

        List<User> allUsers = userRepository.findAll();
        for (User user : allUsers) {
            String status = user.getStatus() != null ? user.getStatus() : (user.isApproved() ? "ACTIVE" : "PENDING");
            
            // Map legacy PENDING_APPROVAL to PENDING
            if ("PENDING_APPROVAL".equalsIgnoreCase(status)) {
                status = "PENDING";
            }

            if (user.getRoles().contains(Role.RESTAURANT_OWNER)) {
                Map<String, Object> restMap = new HashMap<>();
                restMap.put("id", user.getId());
                restMap.put("name", user.getRestaurantName() != null && !user.getRestaurantName().isBlank() ? user.getRestaurantName() : user.getName() + " Kitchen");
                restMap.put("description", user.getRestaurantDescription() != null ? user.getRestaurantDescription() : "N/A");
                restMap.put("ownerName", user.getName());
                restMap.put("ownerEmail", user.getEmail());
                restMap.put("email", user.getEmail());
                restMap.put("restaurantEmail", user.getRestaurantEmail() != null ? user.getRestaurantEmail() : user.getEmail());
                restMap.put("phone", user.getPhone() != null ? user.getPhone() : (user.getRestaurantContact() != null ? user.getRestaurantContact() : "N/A"));
                restMap.put("address", user.getRestaurantAddress() != null ? user.getRestaurantAddress() : user.getAddress());
                restMap.put("city", user.getRestaurantCity() != null ? user.getRestaurantCity() : "N/A");
                restMap.put("pincode", user.getRestaurantPincode() != null ? user.getRestaurantPincode() : "N/A");
                restMap.put("location", user.getRestaurantLocation() != null ? user.getRestaurantLocation() : user.getLocation());
                restMap.put("latitude", user.getRestaurantLatitude());
                restMap.put("longitude", user.getRestaurantLongitude());
                restMap.put("cuisineType", user.getCuisineType() != null ? user.getCuisineType() : "Multi-Cuisine");
                restMap.put("openingTime", user.getOpeningTime() != null ? user.getOpeningTime() : "10:00 AM");
                restMap.put("closingTime", user.getClosingTime() != null ? user.getClosingTime() : "10:00 PM");
                restMap.put("logoUrl", user.getLogoUrl());
                restMap.put("businessRegistrationNumber", user.getBusinessRegistrationNumber() != null ? user.getBusinessRegistrationNumber() : "N/A");
                restMap.put("foodLicenseNumber", user.getFoodLicenseNumber() != null ? user.getFoodLicenseNumber() : "N/A");
                restMap.put("verificationDocumentUrl", user.getVerificationDocumentUrl());
                restMap.put("status", status);
                restMap.put("rejectionReason", user.getRejectionReason());
                restMap.put("createdAt", user.getCreatedAt());
                pendingRestaurants.add(restMap);
            } else if (user.getRoles().contains(Role.DELIVERY_PARTNER)) {
                Map<String, Object> driverMap = new HashMap<>();
                driverMap.put("id", user.getId());
                driverMap.put("name", user.getName());
                driverMap.put("email", user.getEmail());
                driverMap.put("phone", user.getPhone() != null ? user.getPhone() : "N/A");
                driverMap.put("address", user.getAddress() != null ? user.getAddress() : "N/A");
                driverMap.put("vehicleType", user.getVehicleType() != null ? user.getVehicleType() : "BIKE");
                driverMap.put("vehicleNumber", user.getVehicleNumber() != null ? user.getVehicleNumber() : "N/A");
                driverMap.put("verificationInfo", user.getVerificationInfo() != null ? user.getVerificationInfo() : "Verified ID");
                driverMap.put("status", status);
                driverMap.put("rejectionReason", user.getRejectionReason());
                driverMap.put("createdAt", user.getCreatedAt());
                pendingDrivers.add(driverMap);
            } else if (user.getRoles().contains(Role.NGO)) {
                Map<String, Object> ngoMap = new HashMap<>();
                ngoMap.put("id", user.getId());
                ngoMap.put("name", user.getNgoName() != null && !user.getNgoName().isBlank() ? user.getNgoName() : user.getName());
                ngoMap.put("contactPerson", user.getContactPerson() != null ? user.getContactPerson() : user.getName());
                ngoMap.put("email", user.getEmail());
                ngoMap.put("phone", user.getPhone() != null ? user.getPhone() : "N/A");
                ngoMap.put("address", user.getNgoAddress() != null ? user.getNgoAddress() : user.getAddress());
                ngoMap.put("location", user.getLocation() != null ? user.getLocation() : "N/A");
                ngoMap.put("organizationInfo", user.getOrganizationInfo() != null ? user.getOrganizationInfo() : "Food Rescue NGO");
                ngoMap.put("foodRescueInfo", user.getFoodRescueInfo() != null ? user.getFoodRescueInfo() : "Active Rescue Volunteer");
                ngoMap.put("status", status);
                ngoMap.put("rejectionReason", user.getRejectionReason());
                ngoMap.put("createdAt", user.getCreatedAt());
                pendingNgos.add(ngoMap);
            }
        }

        data.put("restaurants", pendingRestaurants);
        data.put("deliveryPartners", pendingDrivers);
        data.put("ngos", pendingNgos);

        return ResponseEntity.ok(ApiResponse.success(data, "Pending approvals and user applications fetched successfully"));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getAllUsers(
            @RequestParam(value = "status", required = false) String filterStatus,
            @RequestHeader(value = "X-User-Roles", required = false) String rolesHeader) {
        checkAdminRole(rolesHeader);
        
        List<Map<String, Object>> result = new ArrayList<>();
        List<User> users = userRepository.findAll();

        for (User user : users) {
            String status = user.getStatus() != null ? user.getStatus() : (user.isApproved() ? "ACTIVE" : "PENDING");
            if ("PENDING_APPROVAL".equalsIgnoreCase(status)) status = "PENDING";
            if ("APPROVED".equalsIgnoreCase(status)) status = "ACTIVE";

            if (filterStatus != null && !filterStatus.equalsIgnoreCase("ALL") && !filterStatus.equalsIgnoreCase(status)) {
                continue;
            }

            Map<String, Object> uMap = new HashMap<>();
            uMap.put("id", user.getId());
            uMap.put("name", user.getName());
            uMap.put("email", user.getEmail());
            uMap.put("phone", user.getPhone() != null ? user.getPhone() : "N/A");
            uMap.put("address", user.getAddress() != null ? user.getAddress() : "N/A");
            uMap.put("roles", user.getRoles());
            uMap.put("status", status);
            uMap.put("rejectionReason", user.getRejectionReason());
            uMap.put("createdAt", user.getCreatedAt());
            result.add(uMap);
        }

        return ResponseEntity.ok(ApiResponse.success(result, "Users fetched successfully"));
    }

    @PutMapping("/approvals/{type}/{id}")
    public ResponseEntity<ApiResponse<Void>> updateApprovalStatus(
            @PathVariable String type,
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-User-Roles", required = false) String rolesHeader) {
        checkAdminRole(rolesHeader);
        
        String action = body.getOrDefault("action", "ACTIVE");
        String rejectionReason = body.get("rejectionReason");

        String newStatus;
        boolean isApproved;

        if ("APPROVE".equalsIgnoreCase(action) || "APPROVED".equalsIgnoreCase(action) || "ACTIVE".equalsIgnoreCase(action)) {
            newStatus = "ACTIVE";
            isApproved = true;
            rejectionReason = null;
        } else if ("REJECT".equalsIgnoreCase(action) || "REJECTED".equalsIgnoreCase(action)) {
            newStatus = "REJECTED";
            isApproved = false;
        } else if ("SUSPEND".equalsIgnoreCase(action) || "SUSPENDED".equalsIgnoreCase(action)) {
            newStatus = "SUSPENDED";
            isApproved = false;
        } else {
            newStatus = action.toUpperCase();
            isApproved = "ACTIVE".equalsIgnoreCase(newStatus);
        }

        log.info("Admin updating status for type '{}', ID '{}' to '{}'", type, id, newStatus);

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setStatus(newStatus);
            user.setApproved(isApproved);
            user.setRejectionReason(rejectionReason);
            userRepository.save(user);

            // Publish Kafka event to notify all downstream microservices
            String primaryRole = user.getRoles() != null && !user.getRoles().isEmpty() ? user.getRoles().iterator().next().name() : "USER";
            authEventProducer.publishUserStatusChanged(
                    UserStatusChangedEvent.builder()
                            .userId(user.getId())
                            .email(user.getEmail())
                            .role(primaryRole)
                            .status(newStatus)
                            .rejectionReason(rejectionReason)
                            .build()
            );

            // Synchronize Delivery DB if driver
            if (user.getRoles().contains(Role.DELIVERY_PARTNER)) {
                try {
                    MongoDatabase deliveryDb = mongoClient.getDatabase("smarteats_delivery");
                    MongoCollection<Document> partnersCol = deliveryDb.getCollection("partners");
                    
                    Document partnerFilter = new Document("userId", user.getId());
                    Document partnerDoc = new Document()
                            .append("userId", user.getId())
                            .append("name", user.getName())
                            .append("phone", user.getPhone() != null ? user.getPhone() : "+91 9988776655")
                            .append("vehicleType", user.getVehicleType() != null ? user.getVehicleType() : "BIKE")
                            .append("vehicleNumber", user.getVehicleNumber() != null ? user.getVehicleNumber() : "N/A")
                            .append("status", isApproved ? "AVAILABLE" : newStatus)
                            .append("rating", 5.0);

                    partnersCol.replaceOne(partnerFilter, partnerDoc, new com.mongodb.client.model.ReplaceOptions().upsert(true));
                } catch (Exception e) {
                    log.error("Failed to sync delivery database: {}", e.getMessage());
                }
            }

            // Synchronize Restaurant DB if owner
            if (user.getRoles().contains(Role.RESTAURANT_OWNER)) {
                try {
                    MongoDatabase restDb = mongoClient.getDatabase("smarteats_restaurant");
                    MongoCollection<Document> restaurantsCol = restDb.getCollection("restaurants");
                    
                    Document restFilter = new Document("ownerId", user.getId());
                    Document existing = restaurantsCol.find(restFilter).first();
                    if (existing == null) {
                        existing = restaurantsCol.find(new Document("ownerEmail", user.getEmail())).first();
                    }

                    if (existing != null) {
                        restaurantsCol.updateOne(new Document("_id", existing.get("_id")), new Document("$set", new Document("approved", isApproved).append("status", newStatus)));
                    } else {
                        Document newRest = new Document()
                                .append("ownerId", user.getId())
                                .append("ownerEmail", user.getEmail())
                                .append("name", user.getRestaurantName() != null ? user.getRestaurantName() : user.getName() + " Kitchen")
                                .append("address", user.getRestaurantAddress() != null ? user.getRestaurantAddress() : user.getAddress())
                                .append("phone", user.getPhone() != null ? user.getPhone() : user.getRestaurantContact())
                                .append("cuisineType", user.getCuisineType() != null ? user.getCuisineType() : "Multi-Cuisine")
                                .append("approved", isApproved)
                                .append("status", newStatus)
                                .append("createdAt", new Date());
                        restaurantsCol.insertOne(newRest);
                    }
                } catch (Exception e) {
                    log.error("Failed to sync restaurant database: {}", e.getMessage());
                }
            }
        }

        return ResponseEntity.ok(ApiResponse.success(null, "Status updated to " + newStatus));
    }

    private void checkAdminRole(String rolesHeader) {
        boolean headerHasAdmin = rolesHeader != null && Arrays.stream(rolesHeader.split(","))
                .anyMatch(r -> "ADMIN".equalsIgnoreCase(r.trim()) || "ROLE_ADMIN".equalsIgnoreCase(r.trim()));

        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean contextHasAdmin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equalsIgnoreCase(a.getAuthority()) || "ADMIN".equalsIgnoreCase(a.getAuthority()));

        if (!headerHasAdmin && !contextHasAdmin) {
            log.warn("Access Denied: Non-admin attempted to invoke Admin API (rolesHeader: {}, auth: {})", rolesHeader, auth != null ? auth.getAuthorities() : "none");
            throw new ForbiddenException("Access Denied: Administrative privileges required");
        }
    }
}
