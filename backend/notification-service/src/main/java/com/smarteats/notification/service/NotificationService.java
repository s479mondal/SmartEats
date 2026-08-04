package com.smarteats.notification.service;

import com.smarteats.notification.dto.NotificationResponse;

import java.util.List;

public interface NotificationService {
    NotificationResponse sendNotification(String recipientEmail, String message, String orderId, String type);
    List<NotificationResponse> getNotificationsForUser(String recipientEmail);
    NotificationResponse markAsRead(String id, String recipientEmail);
    long getUnreadNotificationsCount(String recipientEmail);
}
