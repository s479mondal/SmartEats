package com.smarteats.auth.service;

import com.smarteats.auth.dto.AuthResponse;
import com.smarteats.auth.dto.LoginRequest;
import com.smarteats.auth.dto.RegisterRequest;
import com.smarteats.auth.dto.UserDto;
import com.smarteats.auth.entity.Role;
import com.smarteats.auth.entity.User;
import com.smarteats.auth.event.AuthEventProducer;
import com.smarteats.auth.repository.UserRepository;
import com.smarteats.auth.security.JwtTokenProvider;
import com.smarteats.common.event.DeliveryPartnerRegisteredEvent;
import com.smarteats.common.event.NGORegisteredEvent;
import com.smarteats.common.event.RestaurantOwnerRegisteredEvent;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ResourceNotFoundException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.common.geocoding.GeocodingResult;
import com.smarteats.common.geocoding.GeocodingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final AuthEventProducer authEventProducer;
    private final GeocodingService geocodingService;

    public AuthServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           JwtTokenProvider jwtTokenProvider,
                           AuthenticationManager authenticationManager,
                           AuthEventProducer authEventProducer,
                           GeocodingService geocodingService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authenticationManager = authenticationManager;
        this.authEventProducer = authEventProducer;
        this.geocodingService = geocodingService;
    }

    @Override
    public UserDto register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email is already registered!");
        }

        // Prohibit public ADMIN registration
        if (request.getRoles().contains(Role.ADMIN)) {
            throw new BadRequestException("Administrator accounts cannot be created via public registration.");
        }

        boolean isCustomer = request.getRoles().contains(Role.CUSTOMER) && request.getRoles().size() == 1;
        boolean isRestaurantOwner = request.getRoles().contains(Role.RESTAURANT_OWNER);
        String status = isCustomer ? "ACTIVE" : "PENDING";
        boolean approved = isCustomer;

        // 1. Customer Location Resolution & Geocoding
        Double custLat = request.getCustomerLatitude() != null ? request.getCustomerLatitude() : (isCustomer ? request.getLatitude() : null);
        Double custLng = request.getCustomerLongitude() != null ? request.getCustomerLongitude() : (isCustomer ? request.getLongitude() : null);

        if (isCustomer) {
            String addressQuery = buildAddressQuery(request.getAddress(), null, null, request.getLocation());
            if (addressQuery != null && !addressQuery.isBlank()) {
                log.info("Triggering authoritative geocoding for customer registration address: '{}'", addressQuery);
                GeocodingResult result = geocodingService.geocodeAddress(addressQuery);
                if (result.isSuccess()) {
                    custLat = result.getLatitude();
                    custLng = result.getLongitude();
                    log.info("Geocoding resolved customer coordinates: lat={}, lon={}", custLat, custLng);
                } else {
                    log.warn("Customer address geocoding failed for '{}': {}", addressQuery, result.getErrorMessage());
                    throw new BadRequestException("Customer address verification failed: " + result.getErrorMessage() + ". Please provide a valid physical address.");
                }
            }
        }
        validateCoordinates(custLat, custLng);

        // 2. Restaurant Owner Location Resolution & Geocoding
        Double restLat = request.getLatitude();
        Double restLng = request.getLongitude();

        if (isRestaurantOwner) {
            String restAddressQuery = buildAddressQuery(request.getRestaurantAddress(), request.getCity(), request.getPincode(), request.getRestaurantLocation());
            if (restAddressQuery != null && !restAddressQuery.isBlank()) {
                log.info("Triggering authoritative geocoding for restaurant owner registration address: '{}'", restAddressQuery);
                GeocodingResult result = geocodingService.geocodeAddress(restAddressQuery);
                if (result.isSuccess()) {
                    restLat = result.getLatitude();
                    restLng = result.getLongitude();
                    log.info("Geocoding resolved restaurant owner coordinates: lat={}, lon={}", restLat, restLng);
                } else {
                    log.warn("Restaurant owner address geocoding failed for '{}': {}", restAddressQuery, result.getErrorMessage());
                    throw new BadRequestException("Restaurant address verification failed: " + result.getErrorMessage() + ". Please provide a valid physical restaurant address.");
                }
            }
        }
        validateCoordinates(restLat, restLng);

        // Base user mapping
        User.UserBuilder userBuilder = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .address(request.getAddress())
                .location(request.getLocation())
                .roles(request.getRoles())
                .approved(approved)
                .status(status)
                .foodPreferences(request.getFoodPreferences())
                .customerLatitude(custLat)
                .customerLongitude(custLng)
                .restaurantName(request.getRestaurantName())
                .restaurantDescription(request.getDescription())
                .restaurantAddress(request.getRestaurantAddress())
                .restaurantLocation(request.getRestaurantLocation())
                .restaurantCity(request.getCity())
                .restaurantPincode(request.getPincode())
                .restaurantLatitude(restLat)
                .restaurantLongitude(restLng)
                .cuisineType(request.getCuisineType())
                .restaurantContact(request.getRestaurantContact())
                .restaurantEmail(request.getRestaurantEmail())
                .openingTime(request.getOpeningTime())
                .closingTime(request.getClosingTime())
                .logoUrl(request.getLogoUrl())
                .businessRegistrationNumber(request.getBusinessRegistrationNumber())
                .foodLicenseNumber(request.getFoodLicenseNumber())
                .verificationDocumentUrl(request.getVerificationDocumentUrl())
                .vehicleType(request.getVehicleType())
                .vehicleNumber(request.getVehicleNumber())
                .verificationInfo(request.getVerificationInfo())
                .ngoName(request.getNgoName())
                .contactPerson(request.getContactPerson())
                .ngoAddress(request.getNgoAddress())
                .organizationInfo(request.getOrganizationInfo())
                .foodRescueInfo(request.getFoodRescueInfo())
                .oauth2Provider(request.getOauth2Provider())
                .oauth2Id(request.getOauth2Id());

        // Password encoding if password is present
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            userBuilder.password(passwordEncoder.encode(request.getPassword()));
        }

        User savedUser = userRepository.save(userBuilder.build());
        log.info("User '{}' registered with ID '{}', Role: {}, Status: '{}'", savedUser.getEmail(), savedUser.getId(), savedUser.getRoles(), savedUser.getStatus());

        // Publish Kafka Event to decouple domain services
        if (savedUser.getRoles().contains(Role.RESTAURANT_OWNER)) {
            authEventProducer.publishRestaurantOwnerRegistered(
                    RestaurantOwnerRegisteredEvent.builder()
                            .userId(savedUser.getId())
                            .name(savedUser.getName())
                            .email(savedUser.getEmail())
                            .phone(savedUser.getPhone())
                            .restaurantName(savedUser.getRestaurantName())
                            .description(savedUser.getRestaurantDescription())
                            .restaurantAddress(savedUser.getRestaurantAddress())
                            .restaurantLocation(savedUser.getRestaurantLocation())
                            .city(savedUser.getRestaurantCity())
                            .pincode(savedUser.getRestaurantPincode())
                            .latitude(savedUser.getRestaurantLatitude())
                            .longitude(savedUser.getRestaurantLongitude())
                            .cuisineType(savedUser.getCuisineType())
                            .restaurantContact(savedUser.getRestaurantContact())
                            .restaurantEmail(savedUser.getRestaurantEmail())
                            .openingTime(savedUser.getOpeningTime())
                            .closingTime(savedUser.getClosingTime())
                            .logoUrl(savedUser.getLogoUrl())
                            .businessRegistrationNumber(savedUser.getBusinessRegistrationNumber())
                            .foodLicenseNumber(savedUser.getFoodLicenseNumber())
                            .verificationDocumentUrl(savedUser.getVerificationDocumentUrl())
                            .build()
            );
        } else if (savedUser.getRoles().contains(Role.DELIVERY_PARTNER)) {
            authEventProducer.publishDeliveryPartnerRegistered(
                    DeliveryPartnerRegisteredEvent.builder()
                            .userId(savedUser.getId())
                            .name(savedUser.getName())
                            .email(savedUser.getEmail())
                            .phone(savedUser.getPhone())
                            .address(savedUser.getAddress())
                            .vehicleType(savedUser.getVehicleType())
                            .vehicleNumber(savedUser.getVehicleNumber())
                            .verificationInfo(savedUser.getVerificationInfo())
                            .build()
            );
        } else if (savedUser.getRoles().contains(Role.NGO)) {
            authEventProducer.publishNGORegistered(
                    NGORegisteredEvent.builder()
                            .userId(savedUser.getId())
                            .name(savedUser.getName())
                            .email(savedUser.getEmail())
                            .phone(savedUser.getPhone())
                            .ngoName(savedUser.getNgoName())
                            .contactPerson(savedUser.getContactPerson())
                            .ngoAddress(savedUser.getNgoAddress())
                            .location(savedUser.getLocation())
                            .organizationInfo(savedUser.getOrganizationInfo())
                            .foodRescueInfo(savedUser.getFoodRescueInfo())
                            .build()
            );
        }

        return mapToDto(savedUser);
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        try {
            User user = userRepository.findByEmail(request.getEmail())
                    .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + request.getEmail()));

            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );

            String token = jwtTokenProvider.generateToken(user.getEmail(), user.getRoles());

            return AuthResponse.builder()
                    .token(token)
                    .user(mapToDto(user))
                    .build();
        } catch (AuthenticationException e) {
            throw new UnauthorizedException("Invalid email or password");
        }
    }

    @Override
    public boolean validateToken(String token) {
        return jwtTokenProvider.validateToken(token);
    }

    @Override
    public UserDto getUserByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));
        return mapToDto(user);
    }

    @Override
    public String testDatabaseConnection() {
        String testEmail = "db-test@smarteats.com";
        userRepository.findByEmail(testEmail).ifPresent(userRepository::delete);
        
        User testUser = User.builder()
                .name("Database Connection Test User")
                .email(testEmail)
                .build();
        
        User saved = userRepository.save(testUser);
        User retrieved = userRepository.findByEmail(testEmail)
                .orElseThrow(() -> new RuntimeException("Database test failed to retrieve saved user!"));
        
        return "MongoDB Connection Test Success! Inserted and retrieved test document with ID: " + retrieved.getId();
    }

    private UserDto mapToDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .address(user.getAddress())
                .location(user.getLocation())
                .roles(user.getRoles())
                .approved(user.isApproved())
                .status(user.getStatus() != null ? user.getStatus() : (user.isApproved() ? "ACTIVE" : "PENDING"))
                .rejectionReason(user.getRejectionReason())
                .foodPreferences(user.getFoodPreferences())
                .customerLatitude(user.getCustomerLatitude())
                .customerLongitude(user.getCustomerLongitude())
                .restaurantName(user.getRestaurantName())
                .restaurantDescription(user.getRestaurantDescription())
                .restaurantAddress(user.getRestaurantAddress())
                .restaurantLocation(user.getRestaurantLocation())
                .restaurantCity(user.getRestaurantCity())
                .restaurantPincode(user.getRestaurantPincode())
                .restaurantLatitude(user.getRestaurantLatitude())
                .restaurantLongitude(user.getRestaurantLongitude())
                .cuisineType(user.getCuisineType())
                .restaurantContact(user.getRestaurantContact())
                .restaurantEmail(user.getRestaurantEmail())
                .openingTime(user.getOpeningTime())
                .closingTime(user.getClosingTime())
                .logoUrl(user.getLogoUrl())
                .businessRegistrationNumber(user.getBusinessRegistrationNumber())
                .foodLicenseNumber(user.getFoodLicenseNumber())
                .verificationDocumentUrl(user.getVerificationDocumentUrl())
                .vehicleType(user.getVehicleType())
                .vehicleNumber(user.getVehicleNumber())
                .verificationInfo(user.getVerificationInfo())
                .ngoName(user.getNgoName())
                .contactPerson(user.getContactPerson())
                .ngoAddress(user.getNgoAddress())
                .organizationInfo(user.getOrganizationInfo())
                .foodRescueInfo(user.getFoodRescueInfo())
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

    private String buildAddressQuery(String streetAddress, String city, String pincode, String location) {
        StringBuilder sb = new StringBuilder();
        if (streetAddress != null && !streetAddress.isBlank()) {
            sb.append(streetAddress.trim());
        }
        if (location != null && !location.isBlank() && !sb.toString().contains(location.trim())) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(location.trim());
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
