package com.smarteats.restaurant.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MenuItemRequest {

    @NotBlank(message = "Item name is required")
    private String name;

    private String description;

    @DecimalMin(value = "0.0", inclusive = false, message = "Price must be greater than zero")
    private double price;

    @Builder.Default
    private boolean available = true;

    @NotBlank(message = "Category is required")
    private String category;
}
