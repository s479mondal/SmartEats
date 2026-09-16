package com.smarteats.auth.controller;

import com.smarteats.auth.dto.AuthResponse;
import com.smarteats.auth.dto.LoginRequest;
import com.smarteats.auth.dto.RegisterRequest;
import com.smarteats.auth.dto.UserDto;
import com.smarteats.auth.service.AuthService;
import com.smarteats.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    // Constructor injection
    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserDto>> register(@Valid @RequestBody RegisterRequest request) {
        log.info("Registering new user: {}", request.getEmail());
        UserDto registeredUser = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(registeredUser, "User registered successfully"));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        log.info("Login attempt for email: {}", request.getEmail());
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Login successful"));
    }

    @GetMapping("/validate")
    public ResponseEntity<ApiResponse<Boolean>> validateToken(@RequestParam("token") String token) {
        log.info("Validating token request");
        boolean isValid = authService.validateToken(token);
        if (isValid) {
            return ResponseEntity.ok(ApiResponse.success(true, "Token is valid"));
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Token is invalid or expired"));
        }
    }

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserDto>> getProfile(
            @RequestParam(value = "email", required = false) String email,
            @RequestHeader(value = "X-User-Email", required = false) String authEmail,
            @RequestHeader(value = "X-User-Roles", required = false) String authRoles) {

        String targetEmail = (email != null && !email.isBlank()) ? email.trim() : authEmail;
        if (targetEmail == null || targetEmail.isBlank()) {
            throw new com.smarteats.common.exception.BadRequestException("User email parameter is required");
        }

        // Security / IDOR Prevention:
        // When request traverses the API Gateway with verified identity, enforce that users can only view their own profile unless ADMIN
        if (authEmail != null && !authEmail.isBlank()) {
            boolean isAdmin = authRoles != null && (authRoles.contains("ADMIN") || authRoles.contains("ROLE_ADMIN"));
            if (!authEmail.equalsIgnoreCase(targetEmail) && !isAdmin) {
                log.warn("IDOR attempt: User '{}' attempted to view profile of '{}'", authEmail, targetEmail);
                throw new com.smarteats.common.exception.ForbiddenException("Access Denied: You are not authorized to view another user's profile");
            }
        }

        log.info("Fetching profile for email: {}", targetEmail);
        UserDto userDto = authService.getUserByEmail(targetEmail);
        return ResponseEntity.ok(ApiResponse.success(userDto, "User profile fetched successfully"));
    }

    @GetMapping("/db/test")
    public ResponseEntity<ApiResponse<String>> testDb() {
        String result = authService.testDatabaseConnection();
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
