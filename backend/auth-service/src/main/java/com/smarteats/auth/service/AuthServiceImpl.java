package com.smarteats.auth.service;

import com.smarteats.auth.dto.AuthResponse;
import com.smarteats.auth.dto.LoginRequest;
import com.smarteats.auth.dto.RegisterRequest;
import com.smarteats.auth.dto.UserDto;
import com.smarteats.auth.entity.User;
import com.smarteats.auth.repository.UserRepository;
import com.smarteats.auth.security.JwtTokenProvider;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ResourceNotFoundException;
import com.smarteats.common.exception.UnauthorizedException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;

    // Explicit constructor injection
    public AuthServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           JwtTokenProvider jwtTokenProvider,
                           AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authenticationManager = authenticationManager;
    }

    @Override
    public UserDto register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email is already registered!");
        }

        boolean requiresApproval = request.getRoles().contains(com.smarteats.auth.entity.Role.RESTAURANT_OWNER) ||
                                  request.getRoles().contains(com.smarteats.auth.entity.Role.DELIVERY_PARTNER) ||
                                  request.getRoles().contains(com.smarteats.auth.entity.Role.NGO);

        // Base user mapping
        User.UserBuilder userBuilder = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .roles(request.getRoles())
                .approved(!requiresApproval)
                .status(requiresApproval ? "PENDING_APPROVAL" : "APPROVED")
                .oauth2Provider(request.getOauth2Provider())
                .oauth2Id(request.getOauth2Id());

        // Password encoding if password is present
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            userBuilder.password(passwordEncoder.encode(request.getPassword()));
        }

        User savedUser = userRepository.save(userBuilder.build());

        return mapToDto(savedUser);
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        try {
            User user = userRepository.findByEmail(request.getEmail())
                    .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + request.getEmail()));

            // Verify if account requires admin approval
            if (!user.isApproved()) {
                throw new UnauthorizedException("Account approval is pending from Admin! Please wait for verification.");
            }

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
                .roles(user.getRoles())
                .approved(user.isApproved())
                .status(user.getStatus())
                .build();
    }
}
