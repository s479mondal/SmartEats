package com.smarteats.order.dto;

import com.smarteats.order.entity.CartItem;
import com.smarteats.order.entity.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {
    private String id;
    private String customerEmail;
    private String restaurantId;
    private List<CartItem> items;
    private double totalAmount;
    private OrderStatus status;
    private LocalDateTime createdAt;
}
