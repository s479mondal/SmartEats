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

    public AuthServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           JwtTokenProvider jwtTokenProvider,
                           AuthenticationManager authenticationManager,
                           AuthEventProducer authEventProducer) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authenticationManager = authenticationManager;
        this.authEventProducer = authEventProducer;
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
        String status = isCustomer ? "ACTIVE" : "PENDING";
        boolean approved = isCustomer;

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
                .restaurantName(request.getRestaurantName())
                .restaurantDescription(request.getDescription())
                .restaurantAddress(request.getRestaurantAddress())
                .restaurantLocation(request.getRestaurantLocation())
                .restaurantCity(request.getCity())
                .restaurantPincode(request.getPincode())
                .restaurantLatitude(request.getLatitude())
                .restaurantLongitude(request.getLongitude())
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
}
