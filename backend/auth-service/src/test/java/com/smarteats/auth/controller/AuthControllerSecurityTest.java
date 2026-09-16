package com.smarteats.auth.controller;

import com.smarteats.auth.dto.UserDto;
import com.smarteats.auth.service.AuthService;
import com.smarteats.common.dto.ApiResponse;
import com.smarteats.common.exception.ForbiddenException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerSecurityTest {

    @Mock
    private AuthService authService;

    @InjectMocks
    private AuthController authController;

    private UserDto aliceDto;
    private UserDto bobDto;

    @BeforeEach
    void setUp() {
        aliceDto = UserDto.builder()
                .id("usr_alice")
                .name("Alice")
                .email("alice@smarteats.com")
                .build();

        bobDto = UserDto.builder()
                .id("usr_bob")
                .name("Bob")
                .email("bob@smarteats.com")
                .customerLatitude(12.975)
                .customerLongitude(77.641)
                .build();
    }

    @Test
    @DisplayName("Self access: user can view their own profile")
    void testProfileSelfAccessAllowed() {
        when(authService.getUserByEmail("alice@smarteats.com")).thenReturn(aliceDto);

        ResponseEntity<ApiResponse<UserDto>> response = authController.getProfile(
                "alice@smarteats.com",
                "alice@smarteats.com",
                "ROLE_CUSTOMER"
        );

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("alice@smarteats.com", response.getBody().getData().getEmail());
        verify(authService, times(1)).getUserByEmail("alice@smarteats.com");
    }

    @Test
    @DisplayName("IDOR prevention: non-admin user cannot view another user's profile")
    void testProfileOtherUserDeniedForbidden() {
        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
                authController.getProfile(
                        "bob@smarteats.com",
                        "alice@smarteats.com",
                        "ROLE_CUSTOMER"
                )
        );

        assertTrue(ex.getMessage().contains("Access Denied: You are not authorized to view another user's profile"));
        verify(authService, never()).getUserByEmail(anyString());
    }

    @Test
    @DisplayName("Admin role can view any user's profile")
    void testProfileAdminAllowedAccess() {
        when(authService.getUserByEmail("bob@smarteats.com")).thenReturn(bobDto);

        ResponseEntity<ApiResponse<UserDto>> response = authController.getProfile(
                "bob@smarteats.com",
                "admin@smarteats.com",
                "ROLE_ADMIN"
        );

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("bob@smarteats.com", response.getBody().getData().getEmail());
        verify(authService, times(1)).getUserByEmail("bob@smarteats.com");
    }

    @Test
    @DisplayName("Internal service-to-service call without Gateway headers is allowed")
    void testProfileInternalServiceCallAllowed() {
        when(authService.getUserByEmail("bob@smarteats.com")).thenReturn(bobDto);

        ResponseEntity<ApiResponse<UserDto>> response = authController.getProfile(
                "bob@smarteats.com",
                null,
                null
        );

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("bob@smarteats.com", response.getBody().getData().getEmail());
        verify(authService, times(1)).getUserByEmail("bob@smarteats.com");
    }
}
