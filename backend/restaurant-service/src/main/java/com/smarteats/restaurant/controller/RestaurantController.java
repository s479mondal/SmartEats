package com.smarteats.restaurant.controller;

import com.smarteats.common.dto.ApiResponse;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.restaurant.dto.MenuItemRequest;
import com.smarteats.restaurant.dto.MenuItemResponse;
import com.smarteats.restaurant.dto.RestaurantRequest;
import com.smarteats.restaurant.dto.RestaurantResponse;
import com.smarteats.restaurant.service.RestaurantService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/restaurants")
public class RestaurantController {

    private final RestaurantService restaurantService;

    // Constructor injection
    public RestaurantController(RestaurantService restaurantService) {
        this.restaurantService = restaurantService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RestaurantResponse>> register(
            @Valid @RequestBody RestaurantRequest request,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        log.info("Request to register restaurant from user email: {}, roles: {}", email, roles);
        checkRole(roles, "RESTAURANT_OWNER");
        
        RestaurantResponse response = restaurantService.registerRestaurant(request, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Restaurant registered and awaiting approval"));
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<RestaurantResponse>> approve(
            @PathVariable String id,
            @RequestHeader("X-User-Roles") String roles) {
        
        log.info("Request to approve restaurant ID: {} from roles: {}", id, roles);
        checkRole(roles, "ADMIN");
        
        RestaurantResponse response = restaurantService.approveRestaurant(id);
        return ResponseEntity.ok(ApiResponse.success(response, "Restaurant approved successfully"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RestaurantResponse>> getById(@PathVariable String id) {
        RestaurantResponse response = restaurantService.getRestaurantById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<RestaurantResponse>> update(
            @PathVariable String id,
            @Valid @RequestBody RestaurantRequest request,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "RESTAURANT_OWNER");
        RestaurantResponse response = restaurantService.updateRestaurant(id, request, email);
        return ResponseEntity.ok(ApiResponse.success(response, "Restaurant details updated"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable String id,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "RESTAURANT_OWNER");
        restaurantService.deleteRestaurant(id, email);
        return ResponseEntity.ok(ApiResponse.success(null, "Restaurant deleted successfully"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<RestaurantResponse>>> getAllApproved() {
        List<RestaurantResponse> list = restaurantService.getAllApprovedRestaurants();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/nearby")
    public ResponseEntity<ApiResponse<List<RestaurantResponse>>> getNearby(
            @RequestParam(name = "lat", required = false) Double lat,
            @RequestParam(name = "lng", required = false) Double lng,
            @RequestParam(name = "radius", required = false, defaultValue = "5.0") Double radius) {
        log.info("Request for nearby restaurants: lat={}, lng={}, radius={}km", lat, lng, radius);
        List<RestaurantResponse> list = restaurantService.findNearbyRestaurants(lat, lng, radius);
        return ResponseEntity.ok(ApiResponse.success(list, "Nearby restaurants retrieved successfully"));
    }

    @GetMapping("/my-restaurants")
    public ResponseEntity<ApiResponse<List<RestaurantResponse>>> getMyRestaurants(
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "RESTAURANT_OWNER");
        List<RestaurantResponse> list = restaurantService.getRestaurantsByOwner(email);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    // --- MENU MANAGEMENT ENDPOINTS ---

    @PostMapping("/{restaurantId}/menu")
    public ResponseEntity<ApiResponse<MenuItemResponse>> addMenuItem(
            @PathVariable String restaurantId,
            @Valid @RequestBody MenuItemRequest request,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "RESTAURANT_OWNER");
        MenuItemResponse response = restaurantService.addMenuItem(restaurantId, request, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Menu item added successfully"));
    }

    @GetMapping("/{restaurantId}/menu")
    public ResponseEntity<ApiResponse<List<MenuItemResponse>>> getMenuItems(@PathVariable String restaurantId) {
        List<MenuItemResponse> list = restaurantService.getMenuItems(restaurantId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PutMapping("/{restaurantId}/menu/{itemId}")
    public ResponseEntity<ApiResponse<MenuItemResponse>> updateMenuItem(
            @PathVariable String restaurantId,
            @PathVariable String itemId,
            @Valid @RequestBody MenuItemRequest request,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "RESTAURANT_OWNER");
        MenuItemResponse response = restaurantService.updateMenuItem(restaurantId, itemId, request, email);
        return ResponseEntity.ok(ApiResponse.success(response, "Menu item updated successfully"));
    }

    @DeleteMapping("/{restaurantId}/menu/{itemId}")
    public ResponseEntity<ApiResponse<Void>> deleteMenuItem(
            @PathVariable String restaurantId,
            @PathVariable String itemId,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "RESTAURANT_OWNER");
        restaurantService.deleteMenuItem(restaurantId, itemId, email);
        return ResponseEntity.ok(ApiResponse.success(null, "Menu item deleted successfully"));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<RestaurantResponse>> getMyRestaurant(
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        RestaurantResponse response = restaurantService.getMyRestaurant(email);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/my")
    public ResponseEntity<ApiResponse<RestaurantResponse>> updateMyRestaurant(
            @Valid @RequestBody RestaurantRequest request,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        RestaurantResponse response = restaurantService.updateMyRestaurant(request, email);
        return ResponseEntity.ok(ApiResponse.success(response, "Restaurant profile updated successfully"));
    }

    @GetMapping("/my/menu")
    public ResponseEntity<ApiResponse<List<MenuItemResponse>>> getMyMenu(
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        RestaurantResponse rest = restaurantService.getMyRestaurant(email);
        List<MenuItemResponse> list = restaurantService.getMenuItems(rest.getId());
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PostMapping("/my/menu")
    public ResponseEntity<ApiResponse<MenuItemResponse>> addMyMenuItem(
            @Valid @RequestBody MenuItemRequest request,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        RestaurantResponse rest = restaurantService.getMyRestaurant(email);
        MenuItemResponse response = restaurantService.addMenuItem(rest.getId(), request, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Menu item added successfully"));
    }

    @PutMapping("/my/menu/{itemId}")
    public ResponseEntity<ApiResponse<MenuItemResponse>> updateMyMenuItem(
            @PathVariable String itemId,
            @Valid @RequestBody MenuItemRequest request,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        RestaurantResponse rest = restaurantService.getMyRestaurant(email);
        MenuItemResponse response = restaurantService.updateMenuItem(rest.getId(), itemId, request, email);
        return ResponseEntity.ok(ApiResponse.success(response, "Menu item updated successfully"));
    }

    @DeleteMapping("/my/menu/{itemId}")
    public ResponseEntity<ApiResponse<Void>> deleteMyMenuItem(
            @PathVariable String itemId,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        RestaurantResponse rest = restaurantService.getMyRestaurant(email);
        restaurantService.deleteMenuItem(rest.getId(), itemId, email);
        return ResponseEntity.ok(ApiResponse.success(null, "Menu item deleted successfully"));
    }

    @PatchMapping("/my/menu/{itemId}/availability")
    public ResponseEntity<ApiResponse<MenuItemResponse>> toggleMyMenuItemAvailability(
            @PathVariable String itemId,
            @RequestParam boolean available,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        RestaurantResponse rest = restaurantService.getMyRestaurant(email);
        MenuItemResponse response = restaurantService.toggleMenuItemAvailability(rest.getId(), itemId, available, email);
        return ResponseEntity.ok(ApiResponse.success(response, "Menu item availability updated"));
    }

    // --- PROFILE CHANGE REQUESTS (Major Identity Fields) ---

    @PostMapping("/my/change-requests")
    public ResponseEntity<ApiResponse<com.smarteats.restaurant.entity.ProfileChangeRequest>> submitChangeRequest(
            @RequestBody com.smarteats.restaurant.entity.ProfileChangeRequest request,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        com.smarteats.restaurant.entity.ProfileChangeRequest created = restaurantService.submitChangeRequest(request, email);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(created, "Profile change request submitted for Admin review"));
    }

    @GetMapping("/my/change-requests")
    public ResponseEntity<ApiResponse<List<com.smarteats.restaurant.entity.ProfileChangeRequest>>> getMyChangeRequests(
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "RESTAURANT_OWNER");
        List<com.smarteats.restaurant.entity.ProfileChangeRequest> list = restaurantService.getMyChangeRequests(email);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/admin/change-requests")
    public ResponseEntity<ApiResponse<List<com.smarteats.restaurant.entity.ProfileChangeRequest>>> getAllPendingChangeRequests(
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "ADMIN");
        List<com.smarteats.restaurant.entity.ProfileChangeRequest> list = restaurantService.getAllPendingChangeRequests();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PutMapping("/admin/change-requests/{id}/approve")
    public ResponseEntity<ApiResponse<com.smarteats.restaurant.entity.ProfileChangeRequest>> approveChangeRequest(
            @PathVariable String id,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "ADMIN");
        com.smarteats.restaurant.entity.ProfileChangeRequest approved = restaurantService.approveChangeRequest(id, email);
        return ResponseEntity.ok(ApiResponse.success(approved, "Profile change request approved and applied"));
    }

    @PutMapping("/admin/change-requests/{id}/reject")
    public ResponseEntity<ApiResponse<com.smarteats.restaurant.entity.ProfileChangeRequest>> rejectChangeRequest(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        checkRole(roles, "ADMIN");
        String reason = body != null ? body.getOrDefault("reason", "Rejected by administrator") : "Rejected by administrator";
        com.smarteats.restaurant.entity.ProfileChangeRequest rejected = restaurantService.rejectChangeRequest(id, reason, email);
        return ResponseEntity.ok(ApiResponse.success(rejected, "Profile change request rejected"));
    }

    // Role verification helper
    private void checkRole(String rolesHeader, String requiredRole) {
        if (rolesHeader == null || (!rolesHeader.contains(requiredRole) && !rolesHeader.contains("ADMIN"))) {
            throw new ForbiddenException("Access Denied: You do not possess the required privilege " + requiredRole);
        }
    }
}
