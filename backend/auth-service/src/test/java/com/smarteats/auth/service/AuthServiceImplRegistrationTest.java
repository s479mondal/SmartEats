package com.smarteats.auth.service;

import com.smarteats.auth.dto.RegisterRequest;
import com.smarteats.auth.dto.UserDto;
import com.smarteats.auth.entity.Role;
import com.smarteats.auth.entity.User;
import com.smarteats.auth.event.AuthEventProducer;
import com.smarteats.auth.repository.UserRepository;
import com.smarteats.auth.security.JwtTokenProvider;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.geocoding.GeocodingResult;
import com.smarteats.common.geocoding.GeocodingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplRegistrationTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private AuthEventProducer authEventProducer;

    @Mock
    private GeocodingService geocodingService;

    @InjectMocks
    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
    }

    @Test
    void testCustomerRegistrationWithValidAddressGeocodingSuccess() {
        RegisterRequest request = RegisterRequest.builder()
                .name("Rahul Kumar")
                .email("rahul@smarteats.com")
                .password("password123")
                .phone("+91 9876543210")
                .address("100 Feet Road, Indiranagar")
                .location("Bengaluru")
                .roles(Collections.singleton(Role.CUSTOMER))
                .build();

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");
        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.success(12.9716, 77.5946, "100 Feet Road, Indiranagar, Bengaluru", "OpenStreetMap-Nominatim"));

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId("usr_123");
            return u;
        });

        UserDto response = authService.register(request);

        assertNotNull(response);
        assertEquals("rahul@smarteats.com", response.getEmail());
        assertEquals(12.9716, response.getCustomerLatitude());
        assertEquals(77.5946, response.getCustomerLongitude());
        verify(geocodingService, times(1)).geocodeAddress(contains("100 Feet Road"));
    }

    @Test
    void testCustomerRegistrationWithInvalidAddressGeocodingFailure() {
        RegisterRequest request = RegisterRequest.builder()
                .name("Invalid User")
                .email("invalid@smarteats.com")
                .password("password123")
                .address("FakeAddressNonExistentXYZ999")
                .roles(Collections.singleton(Role.CUSTOMER))
                .build();

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.failure("No geocoding result found for address", "OpenStreetMap-Nominatim"));

        BadRequestException ex = assertThrows(BadRequestException.class, () -> authService.register(request));
        assertTrue(ex.getMessage().contains("Customer address verification failed"));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void testRestaurantOwnerRegistrationGeocodingSuccess() {
        RegisterRequest request = RegisterRequest.builder()
                .name("Owner Name")
                .email("owner@smarteats.com")
                .password("password123")
                .restaurantName("Spice Garden")
                .restaurantAddress("Koramangala 5th Block")
                .city("Bengaluru")
                .pincode("560095")
                .roles(Collections.singleton(Role.RESTAURANT_OWNER))
                .build();

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");
        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.success(12.9352, 77.6245, "Koramangala 5th Block, Bengaluru 560095", "OpenStreetMap-Nominatim"));

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId("usr_owner_123");
            return u;
        });

        UserDto response = authService.register(request);

        assertNotNull(response);
        assertEquals(12.9352, response.getRestaurantLatitude());
        assertEquals(77.6245, response.getRestaurantLongitude());
        verify(authEventProducer, times(1)).publishRestaurantOwnerRegistered(any());
    }

    @Test
    void testCustomerRegistrationClientSuppliedCoordinatesDoesNotBypassGeocoding() {
        // Client sends spoofed coordinates (1.0, 2.0) along with a valid physical address
        RegisterRequest request = RegisterRequest.builder()
                .name("Spoof Attempt")
                .email("spoof@smarteats.com")
                .password("password123")
                .address("100 Feet Road, Indiranagar")
                .location("Bengaluru")
                .customerLatitude(1.0)
                .customerLongitude(2.0)
                .roles(Collections.singleton(Role.CUSTOMER))
                .build();

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");
        // Geocoding resolves real coordinates (12.9716, 77.5946)
        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.success(12.9716, 77.5946, "100 Feet Road, Indiranagar, Bengaluru", "OpenStreetMap-Nominatim"));

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId("usr_spoof_123");
            return u;
        });

        UserDto response = authService.register(request);

        assertNotNull(response);
        // Authoritative geocoding MUST overwrite client's spoofed coordinates
        assertEquals(12.9716, response.getCustomerLatitude());
        assertEquals(77.5946, response.getCustomerLongitude());
        assertNotEquals(1.0, response.getCustomerLatitude());
        assertNotEquals(2.0, response.getCustomerLongitude());
        verify(geocodingService, times(1)).geocodeAddress(contains("100 Feet Road"));
    }

    @Test
    void testNgoRegistrationWithValidAddressGeocodingSuccess() {
        RegisterRequest request = RegisterRequest.builder()
                .name("Priya Sharma")
                .email("ngo@smarteats.com")
                .password("password123")
                .ngoName("Durgapur Food Relief NGO")
                .contactPerson("Priya Sharma")
                .ngoAddress("Near City Centre, Durgapur")
                .ngoCity("Durgapur")
                .ngoPincode("713216")
                .roles(Collections.singleton(Role.NGO))
                .build();

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");
        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.success(23.5421, 87.2934, "Near City Centre, Durgapur 713216", "OpenStreetMap-Nominatim"));

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId("usr_ngo_123");
            return u;
        });

        UserDto response = authService.register(request);

        assertNotNull(response);
        assertEquals("Durgapur Food Relief NGO", response.getNgoName());
        assertEquals(23.5421, response.getNgoLatitude());
        assertEquals(87.2934, response.getNgoLongitude());
        assertEquals("Durgapur", response.getNgoCity());
        assertEquals("713216", response.getNgoPincode());
        verify(authEventProducer, times(1)).publishNGORegistered(any());
    }

    @Test
    void testNgoRegistrationFineTuningWithin50kmRetained() {
        // Geocoding center at (23.5400, 87.2900), client dragged pin to exact office at (23.5421, 87.2934) (~0.42 km away)
        RegisterRequest request = RegisterRequest.builder()
                .name("Priya Sharma")
                .email("ngo_tuned@smarteats.com")
                .password("password123")
                .ngoName("Durgapur Food Relief NGO")
                .contactPerson("Priya Sharma")
                .ngoAddress("Near City Centre, Durgapur")
                .ngoCity("Durgapur")
                .ngoPincode("713216")
                .ngoLatitude(23.542100)
                .ngoLongitude(87.293400)
                .locationSource("USER_CONFIRMED_MAP")
                .roles(Collections.singleton(Role.NGO))
                .build();

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");
        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.success(23.5400, 87.2900, "City Centre, Durgapur", "OpenStreetMap-Nominatim"));

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId("usr_ngo_tuned");
            return u;
        });

        UserDto response = authService.register(request);

        assertNotNull(response);
        // Retains user fine-tuned coordinates because it is within 50km
        assertEquals(23.542100, response.getNgoLatitude());
        assertEquals(87.293400, response.getNgoLongitude());
    }

    @Test
    void testNgoRegistrationAntiSpoofingOverwritesFarCoordinates() {
        // Client tries spoofing coordinates (1.0, 2.0) with a Durgapur address
        RegisterRequest request = RegisterRequest.builder()
                .name("Spoof NGO")
                .email("spoof_ngo@smarteats.com")
                .password("password123")
                .ngoName("Spoof Relief NGO")
                .contactPerson("Spoof Person")
                .ngoAddress("Near City Centre, Durgapur")
                .ngoCity("Durgapur")
                .ngoPincode("713216")
                .ngoLatitude(1.0)
                .ngoLongitude(2.0)
                .locationSource("USER_CONFIRMED_MAP")
                .roles(Collections.singleton(Role.NGO))
                .build();

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword");
        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.success(23.5421, 87.2934, "Near City Centre, Durgapur 713216", "OpenStreetMap-Nominatim"));

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId("usr_ngo_spoof");
            return u;
        });

        UserDto response = authService.register(request);

        assertNotNull(response);
        // Overwritten with authoritative geocoded coordinates
        assertEquals(23.5421, response.getNgoLatitude());
        assertEquals(87.2934, response.getNgoLongitude());
        assertNotEquals(1.0, response.getNgoLatitude());
        assertNotEquals(2.0, response.getNgoLongitude());
    }

    @Test
    void testNgoRegistrationInvalidAddressFailure() {
        RegisterRequest request = RegisterRequest.builder()
                .name("Invalid NGO")
                .email("invalid_ngo@smarteats.com")
                .password("password123")
                .ngoName("Invalid NGO")
                .contactPerson("Invalid Person")
                .ngoAddress("FakeNonExistentAddressXYZ9999")
                .roles(Collections.singleton(Role.NGO))
                .build();

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(geocodingService.geocodeAddress(anyString()))
                .thenReturn(GeocodingResult.failure("No geocoding result found for address", "OpenStreetMap-Nominatim"));

        BadRequestException ex = assertThrows(BadRequestException.class, () -> authService.register(request));
        assertTrue(ex.getMessage().contains("NGO address verification failed"));
        verify(userRepository, never()).save(any(User.class));
    }
}
