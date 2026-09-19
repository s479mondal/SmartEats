package com.smarteats.restaurant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryBatchReservationResponse implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean success;
    private String failedMenuItemId;
    private String message;
    private List<InventoryItemReservation> reservedItems;
}
