package com.smarteats.restaurant.controller;

import com.smarteats.common.dto.ApiResponse;
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

    // Role verification helper
    private void checkRole(String rolesHeader, String requiredRole) {
        if (rolesHeader == null || (!rolesHeader.contains(requiredRole) && !rolesHeader.contains("ADMIN"))) {
            throw new UnauthorizedException("Access Denied: You do not possess the required privilege " + requiredRole);
        }
    }
}
