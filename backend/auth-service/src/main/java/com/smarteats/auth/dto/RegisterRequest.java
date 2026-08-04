package com.smarteats.auth.dto;

import com.smarteats.auth.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 50, message = "Name must be between 2 and 50 characters")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    // Optional for OAuth2 registration, required for standard registration
    private String password;

    @NotEmpty(message = "At least one role is required")
    private Set<Role> roles;

    // OAuth2 registration details (optional)
    private String oauth2Provider;
    private String oauth2Id;
}
