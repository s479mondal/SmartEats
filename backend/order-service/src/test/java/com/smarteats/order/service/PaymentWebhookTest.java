package com.smarteats.order.service;

import com.smarteats.common.enums.PaymentStatus;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.order.client.AuthServiceClient;
import com.smarteats.order.client.RazorpayClientWrapper;
import com.smarteats.order.client.RestaurantServiceClient;
import com.smarteats.order.dto.PaymentReconciliationResult;
import com.smarteats.order.dto.PaymentReconciliationResult.PaymentReconciliationStatus;
import com.smarteats.order.dto.PaymentVerifyRequest;
import com.smarteats.order.dto.PaymentVerifyResponse;
import com.smarteats.order.dto.WebhookResponse;
import com.smarteats.order.entity.CartItem;
import com.smarteats.order.entity.Order;
import com.smarteats.order.entity.OrderStatus;
import com.smarteats.order.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.kafka.core.KafkaTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentWebhookTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private ValueOperations<String, Object> valueOperations;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Mock
    private AuthServiceClient authServiceClient;

    @Mock
    private RestaurantServiceClient restaurantServiceClient;

    @Mock
    private RazorpayClientWrapper razorpayClientWrapper;

    private OrderServiceImpl orderService;

    private static final String TEST_WEBHOOK_SECRET = "smarteats_test_webhook_secret";

    @BeforeEach
    void setUp() {
        orderService = new OrderServiceImpl(
                orderRepository,
                redisTemplate,
                kafkaTemplate,
                authServiceClient,
                restaurantServiceClient,
                razorpayClientWrapper
        );
    }

    private String createCapturedPayload(String razorpayOrderId, String paymentId, String method) {
        return "{\n" +
                "  \"entity\": \"event\",\n" +
                "  \"event\": \"payment.captured\",\n" +
                "  \"payload\": {\n" +
                "    \"payment\": {\n" +
                "      \"entity\": {\n" +
                "        \"id\": \"" + paymentId + "\",\n" +
                "        \"order_id\": \"" + razorpayOrderId + "\",\n" +
                "        \"status\": \"captured\",\n" +
                "        \"method\": \"" + method + "\"\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "}";
    }

    private String createFailedPayload(String razorpayOrderId, String paymentId) {
        return "{\n" +
                "  \"entity\": \"event\",\n" +
                "  \"event\": \"payment.failed\",\n" +
                "  \"payload\": {\n" +
                "    \"payment\": {\n" +
                "      \"entity\": {\n" +
                "        \"id\": \"" + paymentId + "\",\n" +
                "        \"order_id\": \"" + razorpayOrderId + "\",\n" +
                "        \"status\": \"failed\"\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "}";
    }

    @Test
    @DisplayName("TC-WEBHOOK-01: Valid payment.captured webhook transitions PENDING_PAYMENT -> CREATED / PAID")
    void testTC_WEBHOOK_01_ValidPaymentCaptured() {
        String razorpayOrderId = "order_rzp_hook_101";
        String paymentId = "pay_hook_999";
        String rawPayload = createCapturedPayload(razorpayOrderId, paymentId, "UPI");
        String signature = "valid_sig_101";

        Order order = Order.builder()
                .id("ord_hook_101")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId(razorpayOrderId)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .totalAmount(250.0)
                .items(List.of(new CartItem("item_1", "Biryani", 1, 250.0)))
                .build();

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, signature)).thenReturn(true);
        when(orderRepository.findByRazorpayOrderId(razorpayOrderId)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WebhookResponse response = orderService.processWebhook(rawPayload, signature);

        assertTrue(response.isSuccess());
        assertEquals("ord_hook_101", response.getOrderId());
        assertEquals(OrderStatus.CREATED, order.getStatus());
        assertEquals(PaymentStatus.PAID, order.getPaymentStatus());
        assertEquals(paymentId, order.getRazorpayPaymentId());
        assertEquals("UPI", order.getPaymentMethod());
        assertNotNull(order.getPaymentTime());

        // Verify Kafka published and cart deleted
        verify(kafkaTemplate, times(1)).send(any(), eq("ord_hook_101"), any());
        verify(redisTemplate, times(1)).delete("cart:customer@smarteats.com");
    }

    @Test
    @DisplayName("TC-WEBHOOK-02: Invalid webhook signature is rejected with BadRequestException")
    void testTC_WEBHOOK_02_InvalidSignatureRejected() {
        String rawPayload = createCapturedPayload("order_123", "pay_123", "card");
        String badSignature = "bad_signature";

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, badSignature)).thenReturn(false);

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                orderService.processWebhook(rawPayload, badSignature)
        );

        assertTrue(ex.getMessage().contains("Invalid webhook signature"));
        verify(orderRepository, never()).save(any());
        verify(kafkaTemplate, never()).send(any(), any(), any());
    }

    @Test
    @DisplayName("TC-WEBHOOK-03: Duplicate payment.captured is idempotent")
    void testTC_WEBHOOK_03_DuplicatePaymentCapturedIdempotent() {
        String razorpayOrderId = "order_rzp_dup_101";
        String rawPayload = createCapturedPayload(razorpayOrderId, "pay_dup_999", "card");
        String signature = "valid_sig_dup";

        Order order = Order.builder()
                .id("ord_dup_101")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId(razorpayOrderId)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PAID)
                .build();

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, signature)).thenReturn(true);
        when(orderRepository.findByRazorpayOrderId(razorpayOrderId)).thenReturn(Optional.of(order));

        WebhookResponse response = orderService.processWebhook(rawPayload, signature);

        assertTrue(response.isSuccess());
        assertEquals("ord_dup_101", response.getOrderId());
        verify(orderRepository, never()).save(any());
        verify(kafkaTemplate, never()).send(any(), any(), any());
        verify(redisTemplate, never()).delete(anyString());
    }

    @Test
    @DisplayName("TC-WEBHOOK-04: payment.failed releases inventory exactly once and cancels order")
    void testTC_WEBHOOK_04_PaymentFailedReleasesInventory() {
        String razorpayOrderId = "order_rzp_fail_101";
        String paymentId = "pay_fail_555";
        String rawPayload = createFailedPayload(razorpayOrderId, paymentId);
        String signature = "valid_sig_fail";

        Order order = Order.builder()
                .id("ord_fail_101")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId(razorpayOrderId)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .items(List.of(new CartItem("item_1", "Burger", 2, 100.0)))
                .build();

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, signature)).thenReturn(true);
        when(orderRepository.findByRazorpayOrderId(razorpayOrderId)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WebhookResponse response = orderService.processWebhook(rawPayload, signature);

        assertTrue(response.isSuccess());
        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        assertEquals(PaymentStatus.FAILED, order.getPaymentStatus());

        // Inventory release invoked exactly once
        verify(restaurantServiceClient, times(1)).releaseInventory(eq("rest_101"), anyList());
        // No Kafka event emitted and cart NOT deleted
        verify(kafkaTemplate, never()).send(any(), any(), any());
        verify(redisTemplate, never()).delete(anyString());
    }

    @Test
    @DisplayName("TC-WEBHOOK-05: Duplicate payment.failed does not release inventory twice")
    void testTC_WEBHOOK_05_DuplicatePaymentFailedNoDoubleRelease() {
        String razorpayOrderId = "order_rzp_fail_dup";
        String rawPayload = createFailedPayload(razorpayOrderId, "pay_fail_dup");
        String signature = "valid_sig_fail_dup";

        Order order = Order.builder()
                .id("ord_fail_dup")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId(razorpayOrderId)
                .status(OrderStatus.CANCELLED)
                .paymentStatus(PaymentStatus.FAILED)
                .build();

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, signature)).thenReturn(true);
        when(orderRepository.findByRazorpayOrderId(razorpayOrderId)).thenReturn(Optional.of(order));

        WebhookResponse response = orderService.processWebhook(rawPayload, signature);

        assertTrue(response.isSuccess());
        verify(orderRepository, never()).save(any());
        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-WEBHOOK-06: Already PAID order ignores later payment.failed")
    void testTC_WEBHOOK_06_PaidOrderIgnoresLaterPaymentFailed() {
        String razorpayOrderId = "order_rzp_paid_101";
        String rawPayload = createFailedPayload(razorpayOrderId, "pay_fail_late");
        String signature = "valid_sig";

        Order order = Order.builder()
                .id("ord_paid_101")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId(razorpayOrderId)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PAID)
                .build();

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, signature)).thenReturn(true);
        when(orderRepository.findByRazorpayOrderId(razorpayOrderId)).thenReturn(Optional.of(order));

        WebhookResponse response = orderService.processWebhook(rawPayload, signature);

        assertTrue(response.isSuccess());
        assertEquals(OrderStatus.CREATED, order.getStatus());
        assertEquals(PaymentStatus.PAID, order.getPaymentStatus());
        verify(orderRepository, never()).save(any());
        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-WEBHOOK-07: Webhook payment.captured after frontend verify is idempotent")
    void testTC_WEBHOOK_07_WebhookAfterFrontendVerify() {
        String razorpayOrderId = "order_rzp_race_1";
        String paymentId = "pay_race_1";

        Order order = Order.builder()
                .id("ord_race_1")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId(razorpayOrderId)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PAID)
                .razorpayPaymentId(paymentId)
                .build();

        String rawPayload = createCapturedPayload(razorpayOrderId, paymentId, "UPI");
        String signature = "sig_race_1";

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, signature)).thenReturn(true);
        when(orderRepository.findByRazorpayOrderId(razorpayOrderId)).thenReturn(Optional.of(order));

        WebhookResponse response = orderService.processWebhook(rawPayload, signature);

        assertTrue(response.isSuccess());
        verify(orderRepository, never()).save(any());
        verify(kafkaTemplate, never()).send(any(), any(), any());
    }

    @Test
    @DisplayName("TC-WEBHOOK-08: Frontend verify after webhook captured is idempotent")
    void testTC_WEBHOOK_08_FrontendVerifyAfterWebhookCaptured() {
        String razorpayOrderId = "order_rzp_race_2";
        String paymentId = "pay_race_2";

        Order order = Order.builder()
                .id("ord_race_2")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId(razorpayOrderId)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PAID)
                .razorpayPaymentId(paymentId)
                .build();

        when(orderRepository.findById("ord_race_2")).thenReturn(Optional.of(order));

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId("ord_race_2")
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(paymentId)
                .razorpaySignature("sig_race_2")
                .build();

        PaymentVerifyResponse response = orderService.verifyPayment("customer@smarteats.com", request);

        assertTrue(response.isSuccess());
        assertEquals(OrderStatus.CREATED, response.getOrderStatus());
        assertEquals(PaymentStatus.PAID, response.getPaymentStatus());
        verify(orderRepository, never()).save(any());
        verify(kafkaTemplate, never()).send(any(), any(), any());
    }

    @Test
    @DisplayName("TC-WEBHOOK-09: Stale PENDING_PAYMENT with confirmed failed payment is cancelled and inventory released")
    void testTC_WEBHOOK_09_StalePendingOrderCancelledByScheduler() {
        Order staleOrder = Order.builder()
                .id("ord_stale_1")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId("order_rzp_stale_1")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .createdAt(LocalDateTime.now().minusMinutes(30))
                .items(List.of(new CartItem("item_1", "Pizza", 1, 300.0)))
                .build();

        when(orderRepository.findByStatusAndPaymentStatusAndCreatedAtBefore(eq(OrderStatus.PENDING_PAYMENT), eq(PaymentStatus.PENDING), any()))
                .thenReturn(List.of(staleOrder));
        when(razorpayClientWrapper.reconcileOrderPayment("order_rzp_stale_1"))
                .thenReturn(PaymentReconciliationResult.builder()
                        .status(PaymentReconciliationStatus.FAILED)
                        .message("Payment failed on Razorpay")
                        .build());
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int expiredCount = orderService.expireStalePendingPaymentOrders();

        assertEquals(1, expiredCount);
        assertEquals(OrderStatus.CANCELLED, staleOrder.getStatus());
        assertEquals(PaymentStatus.FAILED, staleOrder.getPaymentStatus());
        verify(restaurantServiceClient, times(1)).releaseInventory(eq("rest_101"), anyList());
    }

    @Test
    @DisplayName("TC-WEBHOOK-10: Stale PENDING_PAYMENT with successful Razorpay payment becomes PAID / CREATED")
    void testTC_WEBHOOK_10_StalePendingOrderPaidReconciled() {
        Order staleOrder = Order.builder()
                .id("ord_stale_2")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId("order_rzp_stale_2")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .totalAmount(450.0)
                .createdAt(LocalDateTime.now().minusMinutes(25))
                .items(List.of(new CartItem("item_1", "Tandoori Chicken", 1, 450.0)))
                .build();

        when(orderRepository.findByStatusAndPaymentStatusAndCreatedAtBefore(eq(OrderStatus.PENDING_PAYMENT), eq(PaymentStatus.PENDING), any()))
                .thenReturn(List.of(staleOrder));
        when(razorpayClientWrapper.reconcileOrderPayment("order_rzp_stale_2"))
                .thenReturn(PaymentReconciliationResult.builder()
                        .status(PaymentReconciliationStatus.PAID)
                        .paymentId("pay_reconciled_999")
                        .paymentMethod("CARD")
                        .message("Payment captured on Razorpay")
                        .build());
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int processedCount = orderService.expireStalePendingPaymentOrders();

        assertEquals(1, processedCount);
        assertEquals(OrderStatus.CREATED, staleOrder.getStatus());
        assertEquals(PaymentStatus.PAID, staleOrder.getPaymentStatus());
        assertEquals("pay_reconciled_999", staleOrder.getRazorpayPaymentId());
        assertEquals("CARD", staleOrder.getPaymentMethod());

        verify(kafkaTemplate, times(1)).send(any(), eq("ord_stale_2"), any());
        verify(redisTemplate, times(1)).delete("cart:customer@smarteats.com");
        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-WEBHOOK-11: Razorpay unavailable during scheduler run does NOT cancel the order")
    void testTC_WEBHOOK_11_GatewayUnavailableNoCancel() {
        Order staleOrder = Order.builder()
                .id("ord_stale_3")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId("order_rzp_stale_3")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .createdAt(LocalDateTime.now().minusMinutes(20))
                .build();

        when(orderRepository.findByStatusAndPaymentStatusAndCreatedAtBefore(eq(OrderStatus.PENDING_PAYMENT), eq(PaymentStatus.PENDING), any()))
                .thenReturn(List.of(staleOrder));
        when(razorpayClientWrapper.reconcileOrderPayment("order_rzp_stale_3"))
                .thenReturn(PaymentReconciliationResult.builder()
                        .status(PaymentReconciliationStatus.GATEWAY_UNAVAILABLE)
                        .message("Connection timeout to Razorpay")
                        .build());

        int processedCount = orderService.expireStalePendingPaymentOrders();

        assertEquals(0, processedCount);
        assertEquals(OrderStatus.PENDING_PAYMENT, staleOrder.getStatus());
        assertEquals(PaymentStatus.PENDING, staleOrder.getPaymentStatus());
        verify(orderRepository, never()).save(any());
        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-WEBHOOK-12: Scheduler does not query or process CREATED / PAID orders")
    void testTC_WEBHOOK_12_SchedulerDoesNotTouchPaidOrders() {
        when(orderRepository.findByStatusAndPaymentStatusAndCreatedAtBefore(eq(OrderStatus.PENDING_PAYMENT), eq(PaymentStatus.PENDING), any()))
                .thenReturn(List.of());

        int count = orderService.expireStalePendingPaymentOrders();

        assertEquals(0, count);
        verify(razorpayClientWrapper, never()).reconcileOrderPayment(anyString());
    }

    @Test
    @DisplayName("TC-WEBHOOK-13: Inventory is not released after successful payment")
    void testTC_WEBHOOK_13_NoInventoryReleaseOnPaid() {
        String rawPayload = createCapturedPayload("order_paid_123", "pay_paid_123", "UPI");
        Order order = Order.builder()
                .id("ord_test_13")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId("order_paid_123")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .items(List.of(new CartItem("item_1", "Paneer", 1, 200.0)))
                .build();

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, "sig")).thenReturn(true);
        when(orderRepository.findByRazorpayOrderId("order_paid_123")).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        orderService.processWebhook(rawPayload, "sig");

        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-WEBHOOK-14: Unknown webhook event does not modify order state")
    void testTC_WEBHOOK_14_UnknownWebhookEventIgnored() {
        String rawPayload = "{\n" +
                "  \"entity\": \"event\",\n" +
                "  \"event\": \"refund.speed_changed\",\n" +
                "  \"payload\": {}\n" +
                "}";
        String signature = "valid_sig";

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, signature)).thenReturn(true);

        WebhookResponse response = orderService.processWebhook(rawPayload, signature);

        assertTrue(response.isSuccess());
        assertTrue(response.getMessage().contains("Event acknowledged"));
        verify(orderRepository, never()).save(any());
        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
        verify(kafkaTemplate, never()).send(any(), any(), any());
    }

    @Test
    @DisplayName("TC-WEBHOOK-15: Legacy orders without payment fields still load safely")
    void testTC_WEBHOOK_15_LegacyOrdersLoadSafely() {
        Order legacyOrder = Order.builder()
                .id("ord_legacy_001")
                .customerEmail("customer@smarteats.com")
                .restaurantId("rest_101")
                .totalAmount(150.0)
                .status(OrderStatus.CREATED)
                .items(List.of(new CartItem("item_1", "Naan", 2, 75.0)))
                .build();

        when(orderRepository.findById("ord_legacy_001")).thenReturn(Optional.of(legacyOrder));

        com.smarteats.order.dto.OrderResponse response = orderService.getOrderById("ord_legacy_001", "customer@smarteats.com", "ROLE_CUSTOMER");

        assertNotNull(response);
        assertEquals("ord_legacy_001", response.getId());
        assertEquals(OrderStatus.CREATED, response.getStatus());
        assertNull(response.getPaymentStatus());
    }

    @Test
    @DisplayName("TC-WEBHOOK-16: Webhook does not require customer JWT")
    void testTC_WEBHOOK_16_WebhookDoesNotRequireCustomerJwt() {
        String rawPayload = createCapturedPayload("order_no_jwt", "pay_no_jwt", "UPI");
        String signature = "sig_no_jwt";

        Order order = Order.builder()
                .id("ord_no_jwt")
                .customerEmail("anonymous@smarteats.com")
                .restaurantId("rest_101")
                .razorpayOrderId("order_no_jwt")
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .build();

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, signature)).thenReturn(true);
        when(orderRepository.findByRazorpayOrderId("order_no_jwt")).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Process webhook with raw payload & signature only (no JWT token or userEmail parameter required)
        WebhookResponse response = orderService.processWebhook(rawPayload, signature);

        assertTrue(response.isSuccess());
        assertEquals(OrderStatus.CREATED, order.getStatus());
    }

    @Test
    @DisplayName("TC-WEBHOOK-17: Invalid webhook signature causes zero inventory/Kafka changes")
    void testTC_WEBHOOK_17_InvalidSignatureZeroStateChanges() {
        String rawPayload = createFailedPayload("order_tampered", "pay_tampered");
        String forgedSignature = "forged_sig";

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, forgedSignature)).thenReturn(false);

        assertThrows(BadRequestException.class, () ->
                orderService.processWebhook(rawPayload, forgedSignature)
        );

        verify(orderRepository, never()).findByRazorpayOrderId(anyString());
        verify(orderRepository, never()).save(any());
        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
        verify(kafkaTemplate, never()).send(any(), any(), any());
        verify(redisTemplate, never()).delete(anyString());
    }
}
