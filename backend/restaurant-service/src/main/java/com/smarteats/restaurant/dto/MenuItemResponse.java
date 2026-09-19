package com.smarteats.restaurant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MenuItemResponse implements Serializable {
    private static final long serialVersionUID = 1L;

    private String id;
    private String restaurantId;
    private String name;
    private String description;
    private double price;
    private boolean available;
    private String category;
    private Integer availableQuantity;
}
