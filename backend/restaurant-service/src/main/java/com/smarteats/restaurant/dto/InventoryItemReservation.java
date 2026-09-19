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
public class InventoryItemReservation implements Serializable {
    private static final long serialVersionUID = 1L;

    private String menuItemId;
    private int quantity;
    private Integer remainingQuantity;
    private boolean tracked; // true if availableQuantity was configured, false if legacy null
}
