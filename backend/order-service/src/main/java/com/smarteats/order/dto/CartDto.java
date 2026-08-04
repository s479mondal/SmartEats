package com.smarteats.order.dto;

import com.smarteats.order.entity.CartItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String userEmail;
    private String restaurantId;
    @Builder.Default
    private List<CartItem> items = new ArrayList<>();
}
