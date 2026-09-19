package com.smarteats.restaurant.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "menuItems")
public class MenuItem implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    private String id;
    private String restaurantId;
    private String name;
    private String description;
    private double price;
    private boolean available;
    private String category;
    private Integer availableQuantity;
}
