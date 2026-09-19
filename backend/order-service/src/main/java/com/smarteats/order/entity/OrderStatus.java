package com.smarteats.order.entity;

public enum OrderStatus {
    PENDING_PAYMENT,
    NEW,
    CREATED,
    ACCEPTED,
    REJECTED,
    PREPARING,
    READY,
    DISPATCHED,
    DELIVERED,
    CANCELLED
}
