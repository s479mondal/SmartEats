package com.smarteats.restaurant.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryItemRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    @NotBlank(message = "Menu item ID is required")
    private String menuItemId;

    @Min(value = 1, message = "Requested quantity must be at least 1")
    private int quantity;
}
