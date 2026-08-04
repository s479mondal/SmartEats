package com.smarteats.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponse {
    private String id;
    private String recipientEmail;
    private String message;
    private String orderId;
    private String type;
    private boolean read;
    private LocalDateTime createdAt;
}
