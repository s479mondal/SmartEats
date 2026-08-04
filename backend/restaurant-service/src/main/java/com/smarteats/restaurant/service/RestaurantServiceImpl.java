package com.smarteats.restaurant.service;

import com.smarteats.common.exception.ResourceNotFoundException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.restaurant.dto.MenuItemRequest;
import com.smarteats.restaurant.dto.MenuItemResponse;
import com.smarteats.restaurant.dto.RestaurantRequest;
import com.smarteats.restaurant.dto.RestaurantResponse;
import com.smarteats.restaurant.entity.MenuItem;
import com.smarteats.restaurant.entity.Restaurant;
import com.smarteats.restaurant.repository.MenuItemRepository;
import com.smarteats.restaurant.repository.RestaurantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class RestaurantServiceImpl implements RestaurantService {

    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;

    // Constructor injection
    public RestaurantServiceImpl(RestaurantRepository restaurantRepository, MenuItemRepository menuItemRepository) {
        this.restaurantRepository = restaurantRepository;
        this.menuItemRepository = menuItemRepository;
    }

    @Override
    @CacheEvict(value = "approved_restaurants", allEntries = true)
    public RestaurantResponse registerRestaurant(RestaurantRequest request, String ownerEmail) {
        log.info("Registering new restaurant '{}' by owner '{}'", request.getName(), ownerEmail);
        Restaurant restaurant = Restaurant.builder()
                .name(request.getName())
                .ownerEmail(ownerEmail)
                .address(request.getAddress())
                .phone(request.getPhone())
                .cuisineType(request.getCuisineType())
                .approved(false) // Needs admin approval
                .build();

        Restaurant saved = restaurantRepository.save(restaurant);
        return mapToResponse(saved);
    }

    @Override
    @Caching(evict = {
        @CacheEvict(value = "approved_restaurants", allEntries = true),
        @CacheEvict(value = "restaurants", key = "#id")
    })
    public RestaurantResponse approveRestaurant(String id) {
        log.info("Approving restaurant with ID: {}", id);
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + id));

        restaurant.setApproved(true);
        Restaurant saved = restaurantRepository.save(restaurant);
        return mapToResponse(saved);
    }

    @Override
    @Cacheable(value = "restaurants", key = "#id")
    public RestaurantResponse getRestaurantById(String id) {
        log.info("Fetching restaurant from DB for ID: {}", id);
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + id));
        return mapToResponse(restaurant);
    }

    @Override
    @Caching(evict = {
        @CacheEvict(value = "approved_restaurants", allEntries = true),
        @CacheEvict(value = "restaurants", key = "#id")
    })
    public RestaurantResponse updateRestaurant(String id, RestaurantRequest request, String ownerEmail) {
        log.info("Updating restaurant with ID: {}", id);
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + id));

        validateOwnership(restaurant, ownerEmail);

        restaurant.setName(request.getName());
        restaurant.setAddress(request.getAddress());
        restaurant.setPhone(request.getPhone());
        restaurant.setCuisineType(request.getCuisineType());

        Restaurant saved = restaurantRepository.save(restaurant);
        return mapToResponse(saved);
    }

    @Override
    @Caching(evict = {
        @CacheEvict(value = "approved_restaurants", allEntries = true),
        @CacheEvict(value = "restaurants", key = "#id")
    })
    public void deleteRestaurant(String id, String ownerEmail) {
        log.info("Deleting restaurant with ID: {}", id);
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + id));

        validateOwnership(restaurant, ownerEmail);
        restaurantRepository.delete(restaurant);
    }

    @Override
    @Cacheable(value = "approved_restaurants")
    public List<RestaurantResponse> getAllApprovedRestaurants() {
        log.info("Fetching all approved restaurants from DB");
        return restaurantRepository.findByApproved(true).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public List<RestaurantResponse> getRestaurantsByOwner(String ownerEmail) {
        log.info("Fetching restaurants for owner: {}", ownerEmail);
        return restaurantRepository.findByOwnerEmail(ownerEmail).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // --- MENU ITEMS MANAGEMENT ---

    @Override
    @CacheEvict(value = "menus", key = "#restaurantId")
    public MenuItemResponse addMenuItem(String restaurantId, MenuItemRequest request, String ownerEmail) {
        log.info("Adding menu item to restaurant: {}", restaurantId);
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + restaurantId));

        validateOwnership(restaurant, ownerEmail);

        MenuItem item = MenuItem.builder()
                .restaurantId(restaurantId)
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .available(request.isAvailable())
                .category(request.getCategory())
                .build();

        MenuItem saved = menuItemRepository.save(item);
        return mapToMenuItemResponse(saved);
    }

    @Override
    @Cacheable(value = "menus", key = "#restaurantId")
    public List<MenuItemResponse> getMenuItems(String restaurantId) {
        log.info("Fetching menu items from DB for restaurant: {}", restaurantId);
        return menuItemRepository.findByRestaurantId(restaurantId).stream()
                .map(this::mapToMenuItemResponse)
                .collect(Collectors.toList());
    }

    @Override
    @CacheEvict(value = "menus", key = "#restaurantId")
    public MenuItemResponse updateMenuItem(String restaurantId, String itemId, MenuItemRequest request, String ownerEmail) {
        log.info("Updating menu item {} for restaurant {}", itemId, restaurantId);
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + restaurantId));

        validateOwnership(restaurant, ownerEmail);

        MenuItem item = menuItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Menu item not found with ID: " + itemId));

        if (!item.getRestaurantId().equals(restaurantId)) {
            throw new IllegalArgumentException("Menu item does not belong to the specified restaurant");
        }

        item.setName(request.getName());
        item.setDescription(request.getDescription());
        item.setPrice(request.getPrice());
        item.setAvailable(request.isAvailable());
        item.setCategory(request.getCategory());

        MenuItem saved = menuItemRepository.save(item);
        return mapToMenuItemResponse(saved);
    }

    @Override
    @CacheEvict(value = "menus", key = "#restaurantId")
    public void deleteMenuItem(String restaurantId, String itemId, String ownerEmail) {
        log.info("Deleting menu item {} for restaurant {}", itemId, restaurantId);
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + restaurantId));

        validateOwnership(restaurant, ownerEmail);

        MenuItem item = menuItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Menu item not found with ID: " + itemId));

        if (!item.getRestaurantId().equals(restaurantId)) {
            throw new IllegalArgumentException("Menu item does not belong to the specified restaurant");
        }

        menuItemRepository.delete(item);
    }

    private void validateOwnership(Restaurant restaurant, String ownerEmail) {
        if (!restaurant.getOwnerEmail().equalsIgnoreCase(ownerEmail)) {
            throw new UnauthorizedException("You are not authorized to perform operations on this restaurant!");
        }
    }

    private RestaurantResponse mapToResponse(Restaurant r) {
        return RestaurantResponse.builder()
                .id(r.getId())
                .name(r.getName())
                .ownerEmail(r.getOwnerEmail())
                .address(r.getAddress())
                .phone(r.getPhone())
                .cuisineType(r.getCuisineType())
                .approved(r.isApproved())
                .build();
    }

    private MenuItemResponse mapToMenuItemResponse(MenuItem m) {
        return MenuItemResponse.builder()
                .id(m.getId())
                .restaurantId(m.getRestaurantId())
                .name(m.getName())
                .description(m.getDescription())
                .price(m.getPrice())
                .available(m.isAvailable())
                .category(m.getCategory())
                .build();
    }
}
