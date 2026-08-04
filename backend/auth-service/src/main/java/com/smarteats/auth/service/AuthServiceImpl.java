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

        // Base user mapping
        User.UserBuilder userBuilder = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .roles(request.getRoles())
                .oauth2Provider(request.getOauth2Provider())
                .oauth2Id(request.getOauth2Id());

        // Password encoding if password is present (e.g. for standard login, not OAuth2-only)
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            userBuilder.password(passwordEncoder.encode(request.getPassword()));
        }

        User savedUser = userRepository.save(userBuilder.build());

        return mapToDto(savedUser);
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );

            User user = userRepository.findByEmail(request.getEmail())
                    .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + request.getEmail()));

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

    private UserDto mapToDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .roles(user.getRoles())
                .build();
    }
}
