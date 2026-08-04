package com.smarteats.notification.service;

import com.smarteats.common.exception.ResourceNotFoundException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.notification.dto.NotificationResponse;
import com.smarteats.notification.entity.Notification;
import com.smarteats.notification.repository.NotificationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationServiceImpl(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Override
    public NotificationResponse sendNotification(String recipientEmail, String message, String orderId, String type) {
        log.info("Sending notification of type {} to {}", type, recipientEmail);
        Notification notification = Notification.builder()
                .recipientEmail(recipientEmail)
                .message(message)
                .orderId(orderId)
                .type(type)
                .read(false)
                .build();

        Notification saved = notificationRepository.save(notification);
        return mapToResponse(saved);
    }

    @Override
    public List<NotificationResponse> getNotificationsForUser(String recipientEmail) {
        return notificationRepository.findByRecipientEmailOrderByCreatedAtDesc(recipientEmail).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public NotificationResponse markAsRead(String id, String recipientEmail) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found with ID: " + id));

        if (!notification.getRecipientEmail().equalsIgnoreCase(recipientEmail)) {
            throw new UnauthorizedException("You are not authorized to mark this notification as read!");
        }

        notification.setRead(true);
        Notification saved = notificationRepository.save(notification);
        return mapToResponse(saved);
    }

    @Override
    public long getUnreadNotificationsCount(String recipientEmail) {
        return notificationRepository.findByRecipientEmailAndRead(recipientEmail, false).size();
    }

    private NotificationResponse mapToResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .recipientEmail(n.getRecipientEmail())
                .message(n.getMessage())
                .orderId(n.getOrderId())
                .type(n.getType())
                .read(n.isRead())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
