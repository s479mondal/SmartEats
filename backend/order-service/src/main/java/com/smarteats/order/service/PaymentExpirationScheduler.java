package com.smarteats.order.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class PaymentExpirationScheduler {

    private final OrderService orderService;

    public PaymentExpirationScheduler(OrderService orderService) {
        this.orderService = orderService;
    }

    @Scheduled(fixedDelayString = "${payment.pending-expiry-check-ms:60000}", initialDelay = 10000)
    public void cleanupStalePendingPaymentOrders() {
        try {
            int count = orderService.expireStalePendingPaymentOrders();
            if (count > 0) {
                log.info("PaymentExpirationScheduler: Cleaned up and reconciled {} stale pending payment orders", count);
            }
        } catch (Exception e) {
            log.error("PaymentExpirationScheduler encountered an error during expiration cycle: {}", e.getMessage(), e);
        }
    }
}
