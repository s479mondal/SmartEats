package com.smarteats.restaurant.service;

import com.smarteats.restaurant.dto.MenuItemRequest;
import com.smarteats.restaurant.dto.MenuItemResponse;
import com.smarteats.restaurant.dto.RestaurantRequest;
import com.smarteats.restaurant.dto.RestaurantResponse;

import java.util.List;

public interface RestaurantService {
    RestaurantResponse registerRestaurant(RestaurantRequest request, String ownerEmail);
    RestaurantResponse approveRestaurant(String id);
    RestaurantResponse getRestaurantById(String id);
    RestaurantResponse updateRestaurant(String id, RestaurantRequest request, String ownerEmail);
    void deleteRestaurant(String id, String ownerEmail);
    List<RestaurantResponse> getAllApprovedRestaurants();
    List<RestaurantResponse> getRestaurantsByOwner(String ownerEmail);

    // Menu management
    MenuItemResponse addMenuItem(String restaurantId, MenuItemRequest request, String ownerEmail);
    List<MenuItemResponse> getMenuItems(String restaurantId);
    MenuItemResponse updateMenuItem(String restaurantId, String itemId, MenuItemRequest request, String ownerEmail);
    void deleteMenuItem(String restaurantId, String itemId, String ownerEmail);
}
