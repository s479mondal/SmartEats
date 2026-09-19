package com.smarteats.restaurant.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
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
public class InventoryBatchReservationRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    @NotEmpty(message = "Items list cannot be empty")
    @Valid
    private List<InventoryItemRequest> items;
}
