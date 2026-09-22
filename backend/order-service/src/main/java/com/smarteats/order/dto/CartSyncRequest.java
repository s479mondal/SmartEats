package com.smarteats.order.dto;

import com.smarteats.order.entity.CartItem;
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
public class CartSyncRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    private String restaurantId;
    private List<CartItem> items;
}
