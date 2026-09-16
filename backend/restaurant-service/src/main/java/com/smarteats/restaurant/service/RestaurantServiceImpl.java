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
import com.smarteats.common.geocoding.GeocodingResult;
import com.smarteats.common.geocoding.GeocodingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.GeoResult;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class RestaurantServiceImpl implements RestaurantService {

    public static final double MAX_RADIUS_KM = 50.0;
    public static final double DEFAULT_RADIUS_KM = 5.0;

    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;
    private final ProfileChangeRequestRepository profileChangeRequestRepository;
    private final GeocodingService geocodingService;

    public RestaurantServiceImpl(RestaurantRepository restaurantRepository,
                                 MenuItemRepository menuItemRepository,
                                 ProfileChangeRequestRepository profileChangeRequestRepository,
                                 GeocodingService geocodingService) {
        this.restaurantRepository = restaurantRepository;
        this.menuItemRepository = menuItemRepository;
        this.profileChangeRequestRepository = profileChangeRequestRepository;
        this.geocodingService = geocodingService;
    }

    @Override
    @CacheEvict(value = "approved_restaurants", allEntries = true)
    public RestaurantResponse registerRestaurant(RestaurantRequest request, String ownerEmail) {
        log.info("Registering new restaurant '{}' by owner '{}'", request.getName(), ownerEmail);
        
        Double lat = request.getLatitude();
        Double lon = request.getLongitude();

        String addressQuery = buildAddressQuery(request.getAddress(), request.getCity(), request.getPincode());
        if (addressQuery != null && !addressQuery.isBlank()) {
            log.info("Triggering authoritative geocoding for restaurant registration address: '{}'", addressQuery);
            GeocodingResult result = geocodingService.geocodeAddress(addressQuery);
            if (result.isSuccess()) {
                lat = result.getLatitude();
                lon = result.getLongitude();
                log.info("Geocoding resolved restaurant coordinates: lat={}, lon={}", lat, lon);
            } else {
                log.warn("Restaurant address geocoding failed for '{}': {}", addressQuery, result.getErrorMessage());
                throw new BadRequestException("Restaurant address verification failed: " + result.getErrorMessage() + ". Please provide a valid physical address.");
            }
        }

        validateCoordinates(lat, lon);

        Restaurant restaurant = Restaurant.builder()
                .name(request.getName())
                .description(request.getDescription())
                .ownerEmail(ownerEmail)
                .address(request.getAddress())
                .city(request.getCity())
                .pincode(request.getPincode())
                .latitude(lat)
                .longitude(lon)
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

        restaurant.syncGeoLocation();
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
        if (request.getLatitude() != null) {
            validateCoordinates(request.getLatitude(), null);
            restaurant.setLatitude(request.getLatitude());
        }
        if (request.getLongitude() != null) {
            validateCoordinates(null, request.getLongitude());
            restaurant.setLongitude(request.getLongitude());
        }

        restaurant.syncGeoLocation();
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
    public List<RestaurantResponse> findNearbyRestaurants(Double latitude, Double longitude, Double radiusKm) {
        log.info("Finding nearby restaurants: lat={}, lng={}, radius={}km", latitude, longitude, radiusKm);

        if (latitude == null) {
            throw new BadRequestException("Latitude is required");
        }
        if (longitude == null) {
            throw new BadRequestException("Longitude is required");
        }
        if (radiusKm == null) {
            radiusKm = DEFAULT_RADIUS_KM;
        }

        if (latitude < -90.0 || latitude > 90.0) {
            throw new BadRequestException("Invalid latitude: Must be between -90 and 90 degrees");
        }
        if (longitude < -180.0 || longitude > 180.0) {
            throw new BadRequestException("Invalid longitude: Must be between -180 and 180 degrees");
        }
        if (radiusKm <= 0.0) {
            throw new BadRequestException("Invalid radius: Must be greater than 0 kilometers");
        }
        if (radiusKm > MAX_RADIUS_KM) {
            throw new BadRequestException("Invalid radius: Maximum allowable search radius is " + MAX_RADIUS_KM + " km");
        }

        // Spring Data Point constructor: Point(x, y) where x = longitude, y = latitude
        Point customerPoint = new Point(longitude, latitude);
        Distance searchDistance = new Distance(radiusKm, Metrics.KILOMETERS);

        List<Restaurant> nearbyList = restaurantRepository.findByApprovedTrueAndGeoLocationNear(customerPoint, searchDistance);
        if (nearbyList == null || nearbyList.isEmpty()) {
            log.info("No approved restaurants found within {}km of [{}, {}]", radiusKm, latitude, longitude);
            return Collections.emptyList();
        }

        List<RestaurantResponse> responses = new ArrayList<>();
        for (Restaurant restaurant : nearbyList) {
            if (restaurant == null) continue;

            double distKm;
            if (restaurant.getLatitude() != null && restaurant.getLongitude() != null) {
                distKm = calculateHaversineDistance(latitude, longitude, restaurant.getLatitude(), restaurant.getLongitude());
            } else {
                distKm = 0.0;
            }

            double roundedDist = BigDecimal.valueOf(distKm)
                    .setScale(2, RoundingMode.HALF_UP)
                    .doubleValue();

            RestaurantResponse response = mapToResponse(restaurant);
            response.setDistanceKm(roundedDist);
            responses.add(response);
        }

        // Sort ascending by distance: nearest first
        responses.sort(Comparator.comparing(RestaurantResponse::getDistanceKm));
        log.info("Found {} approved restaurants within {}km of [{}, {}]", responses.size(), radiusKm, latitude, longitude);
        return responses;
    }

    private double calculateHaversineDistance(double lat1, double lon1, double lat2, double lon2) {
        final double EARTH_RADIUS_KM = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double rLat1 = Math.toRadians(lat1);
        double rLat2 = Math.toRadians(lat2);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);

        double c = 2 * Math.asin(Math.sqrt(a));

        return EARTH_RADIUS_KM * c;
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
        if (request.getLatitude() != null) {
            validateCoordinates(request.getLatitude(), null);
            restaurant.setLatitude(request.getLatitude());
        }
        if (request.getLongitude() != null) {
            validateCoordinates(null, request.getLongitude());
            restaurant.setLongitude(request.getLongitude());
        }

        restaurant.syncGeoLocation();
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
                .geoLocation(r.getGeoLocation())
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

    private void validateCoordinates(Double latitude, Double longitude) {
        if (latitude != null && (latitude < -90.0 || latitude > 90.0)) {
            throw new BadRequestException("Invalid latitude: Must be between -90 and 90 degrees");
        }
        if (longitude != null && (longitude < -180.0 || longitude > 180.0)) {
            throw new BadRequestException("Invalid longitude: Must be between -180 and 180 degrees");
        }
    }

    private String buildAddressQuery(String streetAddress, String city, String pincode) {
        StringBuilder sb = new StringBuilder();
        if (streetAddress != null && !streetAddress.isBlank()) {
            sb.append(streetAddress.trim());
        }
        if (city != null && !city.isBlank() && !sb.toString().contains(city.trim())) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(city.trim());
        }
        if (pincode != null && !pincode.isBlank() && !sb.toString().contains(pincode.trim())) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(pincode.trim());
        }
        return sb.length() > 0 ? sb.toString() : null;
    }
}
