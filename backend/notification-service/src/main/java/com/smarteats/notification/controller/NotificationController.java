package com.smarteats.notification.controller;

import com.smarteats.common.dto.ApiResponse;
import com.smarteats.notification.dto.NotificationResponse;
import com.smarteats.notification.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    // Constructor injection
    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getMyNotifications(
            @RequestHeader("X-User-Email") String email) {
        log.info("Requesting notifications for user: {}", email);
        List<NotificationResponse> list = notificationService.getNotificationsForUser(email);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<NotificationResponse>> markAsRead(
            @PathVariable String id,
            @RequestHeader("X-User-Email") String email) {
        log.info("Requesting notification read transition for ID: {} by {}", id, email);
        NotificationResponse response = notificationService.markAsRead(id, email);
        return ResponseEntity.ok(ApiResponse.success(response, "Notification marked as read"));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount(
            @RequestHeader("X-User-Email") String email) {
        long count = notificationService.getUnreadNotificationsCount(email);
        return ResponseEntity.ok(ApiResponse.success(count));
    }
}
