package com.smarteats.auth.service;

import com.smarteats.auth.dto.AuthResponse;
import com.smarteats.auth.dto.LoginRequest;
import com.smarteats.auth.dto.RegisterRequest;
import com.smarteats.auth.dto.UserDto;

public interface AuthService {
    UserDto register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    boolean validateToken(String token);
    UserDto getUserByEmail(String email);
}
