package com.smarteats.restaurant.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ResourceNotFoundException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.restaurant.dto.MenuItemRequest;
import com.smarteats.restaurant.dto.MenuItemResponse;
import com.smarteats.restaurant.dto.RestaurantRequest;
import com.smarteats.restaurant.dto.RestaurantResponse;
import com.smarteats.restaurant.entity.MenuItem;
import com.smarteats.restaurant.entity.ProfileChangeRequest;
import com.smarteats.restaurant.entity.Restaurant;
import com.smarteats.restaurant.repository.MenuItemRepository;
import com.smarteats.restaurant.repository.ProfileChangeRequestRepository;
import com.smarteats.restaurant.repository.RestaurantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class RestaurantServiceImpl implements RestaurantService {

    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;
    private final ProfileChangeRequestRepository profileChangeRequestRepository;

    public RestaurantServiceImpl(RestaurantRepository restaurantRepository,
                                 MenuItemRepository menuItemRepository,
                                 ProfileChangeRequestRepository profileChangeRequestRepository) {
        this.restaurantRepository = restaurantRepository;
        this.menuItemRepository = menuItemRepository;
        this.profileChangeRequestRepository = profileChangeRequestRepository;
    }

    @Override
    @CacheEvict(value = "approved_restaurants", allEntries = true)
    public RestaurantResponse registerRestaurant(RestaurantRequest request, String ownerEmail) {
        log.info("Registering new restaurant '{}' by owner '{}'", request.getName(), ownerEmail);
        Restaurant restaurant = Restaurant.builder()
                .name(request.getName())
                .description(request.getDescription())
                .ownerEmail(ownerEmail)
                .address(request.getAddress())
                .city(request.getCity())
                .pincode(request.getPincode())
                .phone(request.getPhone())
                .email(request.getEmail() != null ? request.getEmail() : ownerEmail)
                .cuisineType(request.getCuisineType())
                .openingTime(request.getOpeningTime() != null ? request.getOpeningTime() : "10:00 AM")
                .closingTime(request.getClosingTime() != null ? request.getClosingTime() : "10:00 PM")
                .logoUrl(request.getLogoUrl())
                .approved(false) // Needs admin approval
                .status("PENDING")
                .open(true)
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
        restaurant.setStatus("ACTIVE");
        restaurant.setApprovalDate(LocalDateTime.now());
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

        if (request.getDescription() != null) restaurant.setDescription(request.getDescription());
        if (request.getPhone() != null) restaurant.setPhone(request.getPhone());
        if (request.getEmail() != null) restaurant.setEmail(request.getEmail());
        if (request.getOpeningTime() != null) restaurant.setOpeningTime(request.getOpeningTime());
        if (request.getClosingTime() != null) restaurant.setClosingTime(request.getClosingTime());
        if (request.getLogoUrl() != null) restaurant.setLogoUrl(request.getLogoUrl());
        if (request.getOpen() != null) restaurant.setOpen(request.getOpen());
        if (request.getCuisineType() != null) restaurant.setCuisineType(request.getCuisineType());

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

    @Override
    public RestaurantResponse getMyRestaurant(String ownerEmail) {
        log.info("Fetching single my restaurant for owner: {}", ownerEmail);
        List<Restaurant> list = restaurantRepository.findByOwnerEmail(ownerEmail);
        if (list.isEmpty()) {
            throw new ResourceNotFoundException("No restaurant profile found for owner email: " + ownerEmail);
        }
        return mapToResponse(list.get(0));
    }

    @Override
    @Caching(evict = {
        @CacheEvict(value = "approved_restaurants", allEntries = true),
        @CacheEvict(value = "restaurants", allEntries = true)
    })
    public RestaurantResponse updateMyRestaurant(RestaurantRequest request, String ownerEmail) {
        log.info("Updating operational fields for owner: {}", ownerEmail);
        List<Restaurant> list = restaurantRepository.findByOwnerEmail(ownerEmail);
        if (list.isEmpty()) {
            throw new ResourceNotFoundException("No restaurant profile found for owner email: " + ownerEmail);
        }
        Restaurant restaurant = list.get(0);
        
        // Update directly editable operational fields
        if (request.getDescription() != null) restaurant.setDescription(request.getDescription());
        if (request.getPhone() != null) restaurant.setPhone(request.getPhone());
        if (request.getEmail() != null) restaurant.setEmail(request.getEmail());
        if (request.getOpeningTime() != null) restaurant.setOpeningTime(request.getOpeningTime());
        if (request.getClosingTime() != null) restaurant.setClosingTime(request.getClosingTime());
        if (request.getLogoUrl() != null) restaurant.setLogoUrl(request.getLogoUrl());
        if (request.getOpen() != null) restaurant.setOpen(request.getOpen());
        if (request.getCuisineType() != null) restaurant.setCuisineType(request.getCuisineType());

        Restaurant saved = restaurantRepository.save(restaurant);
        return mapToResponse(saved);
    }

    // --- PROFILE CHANGE REQUESTS (Major Identity Changes) ---

    @Override
    public ProfileChangeRequest submitChangeRequest(ProfileChangeRequest request, String ownerEmail) {
        log.info("Submitting ProfileChangeRequest for owner: {}", ownerEmail);
        List<Restaurant> list = restaurantRepository.findByOwnerEmail(ownerEmail);
        if (list.isEmpty()) {
            throw new ResourceNotFoundException("No restaurant profile found for owner email: " + ownerEmail);
        }
        Restaurant restaurant = list.get(0);

        request.setRestaurantId(restaurant.getId());
        request.setOwnerId(restaurant.getOwnerId());
        request.setOwnerEmail(ownerEmail);
        request.setStatus("PENDING");
        request.setCreatedAt(LocalDateTime.now());

        return profileChangeRequestRepository.save(request);
    }

    @Override
    public List<ProfileChangeRequest> getMyChangeRequests(String ownerEmail) {
        return profileChangeRequestRepository.findByOwnerEmail(ownerEmail);
    }

    @Override
    public List<ProfileChangeRequest> getAllPendingChangeRequests() {
        return profileChangeRequestRepository.findByStatus("PENDING");
    }

    @Override
    public ProfileChangeRequest approveChangeRequest(String requestId, String adminEmail) {
        ProfileChangeRequest changeReq = profileChangeRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Change request not found with ID: " + requestId));

        if (!"PENDING".equalsIgnoreCase(changeReq.getStatus())) {
            throw new BadRequestException("Change request is not in PENDING status!");
        }

        Restaurant restaurant = restaurantRepository.findById(changeReq.getRestaurantId())
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + changeReq.getRestaurantId()));

        // Apply requested major identity changes
        if (changeReq.getRequestedRestaurantName() != null && !changeReq.getRequestedRestaurantName().isBlank()) {
            restaurant.setName(changeReq.getRequestedRestaurantName());
        }
        if (changeReq.getRequestedAddress() != null && !changeReq.getRequestedAddress().isBlank()) {
            restaurant.setAddress(changeReq.getRequestedAddress());
        }
        if (changeReq.getRequestedCity() != null && !changeReq.getRequestedCity().isBlank()) {
            restaurant.setCity(changeReq.getRequestedCity());
        }
        if (changeReq.getRequestedPincode() != null && !changeReq.getRequestedPincode().isBlank()) {
            restaurant.setPincode(changeReq.getRequestedPincode());
        }
        if (changeReq.getRequestedLatitude() != null) {
            restaurant.setLatitude(changeReq.getRequestedLatitude());
        }
        if (changeReq.getRequestedLongitude() != null) {
            restaurant.setLongitude(changeReq.getRequestedLongitude());
        }
        if (changeReq.getRequestedBusinessRegistrationNumber() != null && !changeReq.getRequestedBusinessRegistrationNumber().isBlank()) {
            restaurant.setBusinessRegistrationNumber(changeReq.getRequestedBusinessRegistrationNumber());
        }
        if (changeReq.getRequestedFoodLicenseNumber() != null && !changeReq.getRequestedFoodLicenseNumber().isBlank()) {
            restaurant.setFoodLicenseNumber(changeReq.getRequestedFoodLicenseNumber());
        }
        if (changeReq.getRequestedVerificationDocumentUrl() != null && !changeReq.getRequestedVerificationDocumentUrl().isBlank()) {
            restaurant.setVerificationDocumentUrl(changeReq.getRequestedVerificationDocumentUrl());
        }

        restaurantRepository.save(restaurant);

        changeReq.setStatus("APPROVED");
        changeReq.setReviewedBy(adminEmail);
        changeReq.setReviewedAt(LocalDateTime.now());
        return profileChangeRequestRepository.save(changeReq);
    }

    @Override
    public ProfileChangeRequest rejectChangeRequest(String requestId, String reason, String adminEmail) {
        ProfileChangeRequest changeReq = profileChangeRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Change request not found with ID: " + requestId));

        changeReq.setStatus("REJECTED");
        changeReq.setAdminFeedback(reason);
        changeReq.setReviewedBy(adminEmail);
        changeReq.setReviewedAt(LocalDateTime.now());
        return profileChangeRequestRepository.save(changeReq);
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

    @Override
    @CacheEvict(value = "menus", key = "#restaurantId")
    public MenuItemResponse toggleMenuItemAvailability(String restaurantId, String itemId, boolean available, String ownerEmail) {
        log.info("Toggling menu item {} availability to {} for restaurant {}", itemId, available, restaurantId);
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + restaurantId));

        validateOwnership(restaurant, ownerEmail);

        MenuItem item = menuItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Menu item not found with ID: " + itemId));

        if (!item.getRestaurantId().equals(restaurantId)) {
            throw new IllegalArgumentException("Menu item does not belong to the specified restaurant");
        }

        item.setAvailable(available);
        MenuItem saved = menuItemRepository.save(item);
        return mapToMenuItemResponse(saved);
    }

    private void validateOwnership(Restaurant restaurant, String ownerEmail) {
        if (!restaurant.getOwnerEmail().equalsIgnoreCase(ownerEmail)) {
            throw new UnauthorizedException("You are not authorized to perform operations on this restaurant!");
        }
    }

    private RestaurantResponse mapToResponse(Restaurant r) {
        return RestaurantResponse.builder()
                .id(r.getId())
                .ownerId(r.getOwnerId())
                .name(r.getName())
                .description(r.getDescription())
                .ownerEmail(r.getOwnerEmail())
                .email(r.getEmail())
                .address(r.getAddress())
                .city(r.getCity())
                .pincode(r.getPincode())
                .latitude(r.getLatitude())
                .longitude(r.getLongitude())
                .location(r.getLocation())
                .phone(r.getPhone())
                .cuisineType(r.getCuisineType())
                .openingTime(r.getOpeningTime())
                .closingTime(r.getClosingTime())
                .logoUrl(r.getLogoUrl())
                .businessRegistrationNumber(r.getBusinessRegistrationNumber())
                .foodLicenseNumber(r.getFoodLicenseNumber())
                .verificationDocumentUrl(r.getVerificationDocumentUrl())
                .approved(r.isApproved())
                .status(r.getStatus())
                .open(r.isOpen())
                .approvedBy(r.getApprovedBy())
                .approvalDate(r.getApprovalDate())
                .createdAt(r.getCreatedAt())
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
