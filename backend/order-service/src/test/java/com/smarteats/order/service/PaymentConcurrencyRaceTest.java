package com.smarteats.order.service;

import com.smarteats.common.enums.PaymentStatus;
import com.smarteats.order.client.AuthServiceClient;
import com.smarteats.order.client.RazorpayClientWrapper;
import com.smarteats.order.client.RestaurantServiceClient;
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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentConcurrencyRaceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Mock
    private AuthServiceClient authServiceClient;

    @Mock
    private RestaurantServiceClient restaurantServiceClient;

    @Mock
    private RazorpayClientWrapper razorpayClientWrapper;

    private OrderServiceImpl orderService;

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

    @Test
    @DisplayName("Race condition test: Frontend verify and payment.captured webhook execute concurrently")
    void testConcurrentFrontendVerifyAndWebhookCaptured() throws Exception {
        String orderId = "ord_race_concurrent_01";
        String razorpayOrderId = "order_rzp_concurrent_01";
        String razorpayPaymentId = "pay_race_concurrent_01";
        String signature = "sig_race_concurrent_01";
        String customerEmail = "customer@smarteats.com";

        Order sharedOrder = Order.builder()
                .id(orderId)
                .customerEmail(customerEmail)
                .restaurantId("rest_101")
                .razorpayOrderId(razorpayOrderId)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .totalAmount(350.0)
                .items(List.of(new CartItem("item_1", "Thali", 1, 350.0)))
                .build();

        // Simulate synchronized persistence layer
        lenient().when(orderRepository.findById(orderId)).thenReturn(Optional.of(sharedOrder));
        lenient().when(orderRepository.findByRazorpayOrderId(razorpayOrderId)).thenReturn(Optional.of(sharedOrder));
        lenient().when(razorpayClientWrapper.verifyPaymentSignature(eq(razorpayOrderId), eq(razorpayPaymentId), eq(signature))).thenReturn(true);
        lenient().when(razorpayClientWrapper.verifyWebhookSignature(anyString(), anyString())).thenReturn(true);

        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order o = invocation.getArgument(0);
            sharedOrder.setStatus(o.getStatus());
            sharedOrder.setPaymentStatus(o.getPaymentStatus());
            sharedOrder.setRazorpayPaymentId(o.getRazorpayPaymentId());
            return sharedOrder;
        });

        String rawWebhookPayload = "{\n" +
                "  \"entity\": \"event\",\n" +
                "  \"event\": \"payment.captured\",\n" +
                "  \"payload\": {\n" +
                "    \"payment\": {\n" +
                "      \"entity\": {\n" +
                "        \"id\": \"" + razorpayPaymentId + "\",\n" +
                "        \"order_id\": \"" + razorpayOrderId + "\",\n" +
                "        \"status\": \"captured\",\n" +
                "        \"method\": \"UPI\"\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "}";

        PaymentVerifyRequest verifyRequest = PaymentVerifyRequest.builder()
                .orderId(orderId)
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(razorpayPaymentId)
                .razorpaySignature(signature)
                .build();

        int threadCount = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CyclicBarrier barrier = new CyclicBarrier(threadCount);

        Callable<PaymentVerifyResponse> frontendVerifyTask = () -> {
            barrier.await();
            return orderService.verifyPayment(customerEmail, verifyRequest);
        };

        Callable<WebhookResponse> webhookTask = () -> {
            barrier.await();
            return orderService.processWebhook(rawWebhookPayload, "webhook_sig_123");
        };

        Future<PaymentVerifyResponse> verifyFuture = executor.submit(frontendVerifyTask);
        Future<WebhookResponse> webhookFuture = executor.submit(webhookTask);

        PaymentVerifyResponse verifyResponse = verifyFuture.get(5, TimeUnit.SECONDS);
        WebhookResponse webhookResponse = webhookFuture.get(5, TimeUnit.SECONDS);

        executor.shutdown();

        // Both return success
        assertTrue(verifyResponse.isSuccess());
        assertTrue(webhookResponse.isSuccess());

        // Final state must be PAID and CREATED
        assertEquals(OrderStatus.CREATED, sharedOrder.getStatus());
        assertEquals(PaymentStatus.PAID, sharedOrder.getPaymentStatus());

        // Inventory must NEVER be released for paid order
        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
    }
}
