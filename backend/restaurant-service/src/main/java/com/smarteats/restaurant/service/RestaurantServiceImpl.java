package com.smarteats.restaurant.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ResourceNotFoundException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.restaurant.dto.*;
import com.smarteats.restaurant.entity.MenuItem;
import com.smarteats.restaurant.entity.ProfileChangeRequest;
import com.smarteats.restaurant.entity.Restaurant;
import com.smarteats.restaurant.repository.MenuItemRepository;
import com.smarteats.restaurant.repository.ProfileChangeRequestRepository;
import com.smarteats.restaurant.repository.RestaurantRepository;
import com.smarteats.common.geocoding.GeocodingResult;
import com.smarteats.common.geocoding.GeocodingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.GeoResult;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import com.smarteats.restaurant.util.RestaurantOperatingHoursUtil;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.LocalTime;
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
    private final Clock clock;
    private final MongoTemplate mongoTemplate;
    private final CacheManager cacheManager;

    @org.springframework.beans.factory.annotation.Autowired
    public RestaurantServiceImpl(RestaurantRepository restaurantRepository,
                                 MenuItemRepository menuItemRepository,
                                 ProfileChangeRequestRepository profileChangeRequestRepository,
                                 GeocodingService geocodingService,
                                 @org.springframework.beans.factory.annotation.Autowired(required = false) Clock clock,
                                 @org.springframework.beans.factory.annotation.Autowired(required = false) MongoTemplate mongoTemplate,
                                 @org.springframework.beans.factory.annotation.Autowired(required = false) CacheManager cacheManager) {
        this.restaurantRepository = restaurantRepository;
        this.menuItemRepository = menuItemRepository;
        this.profileChangeRequestRepository = profileChangeRequestRepository;
        this.geocodingService = geocodingService;
        this.clock = clock != null ? clock : Clock.system(RestaurantOperatingHoursUtil.ZONE_ASIA_KOLKATA);
        this.mongoTemplate = mongoTemplate;
        this.cacheManager = cacheManager;
    }

    public RestaurantServiceImpl(RestaurantRepository restaurantRepository,
                                 MenuItemRepository menuItemRepository,
                                 ProfileChangeRequestRepository profileChangeRequestRepository,
                                 GeocodingService geocodingService) {
        this(restaurantRepository, menuItemRepository, profileChangeRequestRepository, geocodingService, null, null, null);
    }

    public RestaurantServiceImpl(RestaurantRepository restaurantRepository,
                                 MenuItemRepository menuItemRepository,
                                 ProfileChangeRequestRepository profileChangeRequestRepository,
                                 GeocodingService geocodingService,
                                 Clock clock) {
        this(restaurantRepository, menuItemRepository, profileChangeRequestRepository, geocodingService, clock, null, null);
    }

    @Override
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

        Integer openMins = request.getOpeningTimeMinutes();
        Integer closeMins = request.getClosingTimeMinutes();
        String openStr = request.getOpeningTime();
        String closeStr = request.getClosingTime();

        if (openStr != null && !openStr.isBlank()) {
            openMins = RestaurantOperatingHoursUtil.timeToMinutes(openStr);
            if (openMins == null) {
                throw new BadRequestException("Invalid opening time format: '" + openStr + "'. Expected valid time (e.g. HH:mm or 10:00 AM)");
            }
        } else if (openMins != null) {
            if (openMins < 0 || openMins > 1439) {
                throw new BadRequestException("Invalid openingTimeMinutes: must be between 0 and 1439");
            }
        } else {
            openStr = "10:00";
            openMins = 600;
        }

        if (closeStr != null && !closeStr.isBlank()) {
            closeMins = RestaurantOperatingHoursUtil.timeToMinutes(closeStr);
            if (closeMins == null) {
                throw new BadRequestException("Invalid closing time format: '" + closeStr + "'. Expected valid time (e.g. HH:mm or 10:00 PM)");
            }
        } else if (closeMins != null) {
            if (closeMins < 0 || closeMins > 1439) {
                throw new BadRequestException("Invalid closingTimeMinutes: must be between 0 and 1439");
            }
        } else {
            closeStr = "22:00";
            closeMins = 1320;
        }

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
                .openingTime(openStr)
                .closingTime(closeStr)
                .openingTimeMinutes(openMins)
                .closingTimeMinutes(closeMins)
                .logoUrl(request.getLogoUrl())
                .approved(false) // Needs admin approval
                .status("PENDING")
                .open(true)
                .build();

        restaurant.syncGeoLocation();
        restaurant.syncOperatingTimeMinutes();
        Restaurant saved = restaurantRepository.save(restaurant);
        return mapToResponse(saved);
    }

    @Override
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
    public RestaurantResponse getRestaurantById(String id) {
        log.info("Fetching restaurant from DB for ID: {}", id);
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + id));
        return mapToResponse(restaurant);
    }

    @Override
    public RestaurantResponse updateRestaurant(String id, RestaurantRequest request, String ownerEmail) {
        log.info("Updating restaurant with ID: {}", id);
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + id));

        validateOwnership(restaurant, ownerEmail);

        if (request.getDescription() != null) restaurant.setDescription(request.getDescription());
        if (request.getPhone() != null) restaurant.setPhone(request.getPhone());
        if (request.getEmail() != null) restaurant.setEmail(request.getEmail());
        if (request.getOpeningTime() != null) {
            Integer m = RestaurantOperatingHoursUtil.timeToMinutes(request.getOpeningTime());
            if (m == null) {
                throw new BadRequestException("Invalid opening time format: '" + request.getOpeningTime() + "'");
            }
            restaurant.setOpeningTime(request.getOpeningTime());
            restaurant.setOpeningTimeMinutes(m);
        } else if (request.getOpeningTimeMinutes() != null) {
            if (request.getOpeningTimeMinutes() < 0 || request.getOpeningTimeMinutes() > 1439) {
                throw new BadRequestException("Invalid openingTimeMinutes: must be between 0 and 1439");
            }
            restaurant.setOpeningTimeMinutes(request.getOpeningTimeMinutes());
        }

        if (request.getClosingTime() != null) {
            Integer m = RestaurantOperatingHoursUtil.timeToMinutes(request.getClosingTime());
            if (m == null) {
                throw new BadRequestException("Invalid closing time format: '" + request.getClosingTime() + "'");
            }
            restaurant.setClosingTime(request.getClosingTime());
            restaurant.setClosingTimeMinutes(m);
        } else if (request.getClosingTimeMinutes() != null) {
            if (request.getClosingTimeMinutes() < 0 || request.getClosingTimeMinutes() > 1439) {
                throw new BadRequestException("Invalid closingTimeMinutes: must be between 0 and 1439");
            }
            restaurant.setClosingTimeMinutes(request.getClosingTimeMinutes());
        }

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
        restaurant.syncOperatingTimeMinutes();
        Restaurant saved = restaurantRepository.save(restaurant);
        return mapToResponse(saved);
    }

    @Override
    public void deleteRestaurant(String id, String ownerEmail) {
        log.info("Deleting restaurant with ID: {}", id);
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with ID: " + id));

        validateOwnership(restaurant, ownerEmail);
        restaurantRepository.delete(restaurant);
    }

    @Override
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
        if (request.getOpeningTime() != null) {
            Integer m = RestaurantOperatingHoursUtil.timeToMinutes(request.getOpeningTime());
            if (m == null) {
                throw new BadRequestException("Invalid opening time format: '" + request.getOpeningTime() + "'");
            }
            restaurant.setOpeningTime(request.getOpeningTime());
            restaurant.setOpeningTimeMinutes(m);
        } else if (request.getOpeningTimeMinutes() != null) {
            if (request.getOpeningTimeMinutes() < 0 || request.getOpeningTimeMinutes() > 1439) {
                throw new BadRequestException("Invalid openingTimeMinutes: must be between 0 and 1439");
            }
            restaurant.setOpeningTimeMinutes(request.getOpeningTimeMinutes());
        }

        if (request.getClosingTime() != null) {
            Integer m = RestaurantOperatingHoursUtil.timeToMinutes(request.getClosingTime());
            if (m == null) {
                throw new BadRequestException("Invalid closing time format: '" + request.getClosingTime() + "'");
            }
            restaurant.setClosingTime(request.getClosingTime());
            restaurant.setClosingTimeMinutes(m);
        } else if (request.getClosingTimeMinutes() != null) {
            if (request.getClosingTimeMinutes() < 0 || request.getClosingTimeMinutes() > 1439) {
                throw new BadRequestException("Invalid closingTimeMinutes: must be between 0 and 1439");
            }
            restaurant.setClosingTimeMinutes(request.getClosingTimeMinutes());
        }

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
        restaurant.syncOperatingTimeMinutes();
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
                .availableQuantity(request.getAvailableQuantity())
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
        item.setAvailableQuantity(request.getAvailableQuantity());

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

    // --- ATOMIC INVENTORY DEDUCTION & COMPENSATION ---

    @Override
    @CacheEvict(value = "menus", key = "#restaurantId")
    public InventoryBatchReservationResponse reserveInventory(String restaurantId, InventoryBatchReservationRequest request) {
        if (restaurantId == null || restaurantId.trim().isEmpty()) {
            throw new BadRequestException("Restaurant ID cannot be empty");
        }
        if (request == null || request.getItems() == null || request.getItems().isEmpty()) {
            throw new BadRequestException("Inventory reservation request items cannot be empty");
        }

        log.info("Attempting batch inventory reservation for restaurant {} with {} items", restaurantId, request.getItems().size());

        List<InventoryItemReservation> reservedSoFar = new ArrayList<>();
        boolean allSuccessful = true;
        String failedItemId = null;
        String failureReason = null;

        for (InventoryItemRequest itemReq : request.getItems()) {
            String itemId = itemReq.getMenuItemId();
            int qty = itemReq.getQuantity();

            if (itemId == null || itemId.trim().isEmpty()) {
                allSuccessful = false;
                failedItemId = "UNKNOWN";
                failureReason = "Menu item ID cannot be blank";
                break;
            }

            if (qty <= 0) {
                allSuccessful = false;
                failedItemId = itemId;
                failureReason = "Requested quantity must be at least 1";
                break;
            }

            // Verify item exists and belongs to restaurant
            MenuItem existing = menuItemRepository.findById(itemId).orElse(null);
            if (existing == null || !restaurantId.equals(existing.getRestaurantId())) {
                allSuccessful = false;
                failedItemId = itemId;
                failureReason = "Menu item " + itemId + " not found or does not belong to restaurant " + restaurantId;
                break;
            }

            if (!existing.isAvailable()) {
                allSuccessful = false;
                failedItemId = itemId;
                failureReason = "Menu item '" + existing.getName() + "' is marked unavailable";
                break;
            }

            // Case A: availableQuantity == null (Legacy/unconfigured item)
            // Preserve legacy behavior without generating fake inventory or decrementing
            if (existing.getAvailableQuantity() == null) {
                log.info("Menu item {} has unconfigured portion inventory (null). Allowing order without decrementing.", itemId);
                reservedSoFar.add(InventoryItemReservation.builder()
                        .menuItemId(itemId)
                        .quantity(qty)
                        .remainingQuantity(null)
                        .tracked(false)
                        .build());
                continue;
            }

            // Case B: Configured inventory (availableQuantity != null)
            // Execute ATOMIC conditional MongoDB update:
            // Query: _id == itemId AND restaurantId == restaurantId AND available == true AND availableQuantity >= qty
            // Update: $inc: { availableQuantity: -qty }
            if (mongoTemplate != null) {
                Query query = new Query();
                query.addCriteria(Criteria.where("_id").is(itemId)
                        .and("restaurantId").is(restaurantId)
                        .and("available").is(true)
                        .and("availableQuantity").gte(qty));

                Update update = new Update().inc("availableQuantity", -qty);
                FindAndModifyOptions options = FindAndModifyOptions.options().returnNew(true);

                MenuItem updated = mongoTemplate.findAndModify(query, update, options, MenuItem.class);

                if (updated != null) {
                    log.info("Successfully atomically reserved {} portions for item {}. Remaining: {}",
                            qty, itemId, updated.getAvailableQuantity());
                    reservedSoFar.add(InventoryItemReservation.builder()
                            .menuItemId(itemId)
                            .quantity(qty)
                            .remainingQuantity(updated.getAvailableQuantity())
                            .tracked(true)
                            .build());
                } else {
                    // Reservation failed: availableQuantity was less than requested quantity
                    log.warn("Failed atomic reservation for item {}: requested {} portions but insufficient inventory.",
                            itemId, qty);
                    allSuccessful = false;
                    failedItemId = itemId;
                    failureReason = "Insufficient portions available for item '" + existing.getName() + "'";
                    break;
                }
            } else {
                // Fallback for tests without mongoTemplate bean
                if (existing.getAvailableQuantity() >= qty) {
                    existing.setAvailableQuantity(existing.getAvailableQuantity() - qty);
                    menuItemRepository.save(existing);
                    reservedSoFar.add(InventoryItemReservation.builder()
                            .menuItemId(itemId)
                            .quantity(qty)
                            .remainingQuantity(existing.getAvailableQuantity())
                            .tracked(true)
                            .build());
                } else {
                    allSuccessful = false;
                    failedItemId = itemId;
                    failureReason = "Insufficient portions available for item '" + existing.getName() + "'";
                    break;
                }
            }
        }

        // If any item failed, ROLLBACK / COMPENSATE all previously reserved items in this order!
        if (!allSuccessful) {
            log.warn("Rolling back {} previously reserved items for restaurant {} due to failure on item: {}",
                    reservedSoFar.size(), restaurantId, failedItemId);

            for (InventoryItemReservation reserved : reservedSoFar) {
                if (reserved.isTracked()) {
                    try {
                        if (mongoTemplate != null) {
                            Query rollbackQuery = new Query();
                            rollbackQuery.addCriteria(Criteria.where("_id").is(reserved.getMenuItemId())
                                    .and("restaurantId").is(restaurantId));
                            Update rollbackUpdate = new Update().inc("availableQuantity", reserved.getQuantity());
                            mongoTemplate.findAndModify(rollbackQuery, rollbackUpdate, MenuItem.class);
                        } else {
                            MenuItem mi = menuItemRepository.findById(reserved.getMenuItemId()).orElse(null);
                            if (mi != null && mi.getAvailableQuantity() != null) {
                                mi.setAvailableQuantity(mi.getAvailableQuantity() + reserved.getQuantity());
                                menuItemRepository.save(mi);
                            }
                        }
                        log.info("Compensated/restored {} portions for item {}", reserved.getQuantity(), reserved.getMenuItemId());
                    } catch (Exception ex) {
                        log.error("Error compensating reservation for item {}: {}", reserved.getMenuItemId(), ex.getMessage());
                    }
                }
            }

            evictMenuCache(restaurantId);

            return InventoryBatchReservationResponse.builder()
                    .success(false)
                    .failedMenuItemId(failedItemId)
                    .message(failureReason != null ? failureReason : "One or more items are no longer available in the requested quantity.")
                    .reservedItems(Collections.emptyList())
                    .build();
        }

        evictMenuCache(restaurantId);

        return InventoryBatchReservationResponse.builder()
                .success(true)
                .failedMenuItemId(null)
                .message("All items reserved successfully")
                .reservedItems(reservedSoFar)
                .build();
    }

    @Override
    @CacheEvict(value = "menus", key = "#restaurantId")
    public InventoryBatchReservationResponse releaseInventory(String restaurantId, InventoryBatchReservationRequest request) {
        if (restaurantId == null || restaurantId.trim().isEmpty()) {
            throw new BadRequestException("Restaurant ID cannot be empty");
        }
        if (request == null || request.getItems() == null || request.getItems().isEmpty()) {
            return InventoryBatchReservationResponse.builder()
                    .success(true)
                    .message("No items to release")
                    .reservedItems(Collections.emptyList())
                    .build();
        }

        log.info("Releasing/restoring inventory for restaurant {} with {} items", restaurantId, request.getItems().size());

        List<InventoryItemReservation> restoredItems = new ArrayList<>();

        for (InventoryItemRequest itemReq : request.getItems()) {
            String itemId = itemReq.getMenuItemId();
            int qty = itemReq.getQuantity();

            if (itemId == null || qty <= 0) continue;

            if (mongoTemplate != null) {
                Query query = new Query();
                query.addCriteria(Criteria.where("_id").is(itemId)
                        .and("restaurantId").is(restaurantId)
                        .and("availableQuantity").ne(null));

                Update update = new Update().inc("availableQuantity", qty);
                FindAndModifyOptions options = FindAndModifyOptions.options().returnNew(true);

                MenuItem updated = mongoTemplate.findAndModify(query, update, options, MenuItem.class);
                if (updated != null) {
                    log.info("Restored {} portions for item {}. New total: {}", qty, itemId, updated.getAvailableQuantity());
                    restoredItems.add(InventoryItemReservation.builder()
                            .menuItemId(itemId)
                            .quantity(qty)
                            .remainingQuantity(updated.getAvailableQuantity())
                            .tracked(true)
                            .build());
                }
            } else {
                MenuItem mi = menuItemRepository.findById(itemId).orElse(null);
                if (mi != null && mi.getAvailableQuantity() != null) {
                    mi.setAvailableQuantity(mi.getAvailableQuantity() + qty);
                    menuItemRepository.save(mi);
                    restoredItems.add(InventoryItemReservation.builder()
                            .menuItemId(itemId)
                            .quantity(qty)
                            .remainingQuantity(mi.getAvailableQuantity())
                            .tracked(true)
                            .build());
                }
            }
        }

        evictMenuCache(restaurantId);

        return InventoryBatchReservationResponse.builder()
                .success(true)
                .message("Inventory restored successfully")
                .reservedItems(restoredItems)
                .build();
    }

    private void evictMenuCache(String restaurantId) {
        try {
            if (cacheManager != null) {
                org.springframework.cache.Cache cache = cacheManager.getCache("menus");
                if (cache != null) {
                    cache.evict(restaurantId);
                }
            }
        } catch (Exception e) {
            log.warn("Could not evict menu cache for restaurant {}: {}", restaurantId, e.getMessage());
        }
    }

    private void validateOwnership(Restaurant restaurant, String ownerEmail) {
        if (!restaurant.getOwnerEmail().equalsIgnoreCase(ownerEmail)) {
            throw new UnauthorizedException("You are not authorized to perform operations on this restaurant!");
        }
    }

    private RestaurantResponse mapToResponse(Restaurant r) {
        r.syncOperatingTimeMinutes();
        LocalTime currentTime = LocalTime.now(clock);
        boolean calculatedOpen = RestaurantOperatingHoursUtil.isCurrentlyOpen(
                r.getOpeningTimeMinutes(),
                r.getClosingTimeMinutes(),
                r.getOpeningTime(),
                r.getClosingTime(),
                r.isOpen(),
                currentTime
        );

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
                .openingTimeMinutes(r.getOpeningTimeMinutes())
                .closingTimeMinutes(r.getClosingTimeMinutes())
                .logoUrl(r.getLogoUrl())
                .businessRegistrationNumber(r.getBusinessRegistrationNumber())
                .foodLicenseNumber(r.getFoodLicenseNumber())
                .verificationDocumentUrl(r.getVerificationDocumentUrl())
                .approved(r.isApproved())
                .status(r.getStatus())
                .open(calculatedOpen)
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
                .availableQuantity(m.getAvailableQuantity())
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
