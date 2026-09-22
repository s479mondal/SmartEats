package com.smarteats.common.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderReadyEvent implements Serializable {
    private static final long serialVersionUID = 1L;

    private String orderId;
    private String id;
    private String restaurantId;
    private String restaurantName;
    private String customerEmail;
    private double totalAmount;
    private String status;
    private String timestamp;
}
