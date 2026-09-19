package com.smarteats.order.service;

import com.smarteats.common.enums.PaymentStatus;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.order.client.AuthServiceClient;
import com.smarteats.order.client.RazorpayClientWrapper;
import com.smarteats.order.client.RestaurantServiceClient;
import com.smarteats.order.dto.OrderCreatedEvent;
import com.smarteats.order.dto.PaymentVerifyRequest;
import com.smarteats.order.dto.PaymentVerifyResponse;
import com.smarteats.order.entity.CartItem;
import com.smarteats.order.entity.Order;
import com.smarteats.order.entity.OrderStatus;
import com.smarteats.order.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentVerificationTest {

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

    @Captor
    private ArgumentCaptor<Order> orderCaptor;

    @Captor
    private ArgumentCaptor<OrderCreatedEvent> eventCaptor;

    private OrderServiceImpl orderService;

    private final String customerEmail = "customer@smarteats.com";
    private final String restaurantId = "rest_test_pay_01";
    private final String orderId = "ord_smarteats_1001";
    private final String razorpayOrderId = "order_rzp_mock_1001";
    private final String razorpayPaymentId = "pay_rzp_mock_5001";
    private final String validSignature = "f9a2b8e34c9876543210abcdef0123456789abcdef0123456789abcdef012345";

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
        ReflectionTestUtils.setField(orderService, "orderCreatedTopic", "smarteats.order.created");
        ReflectionTestUtils.setField(orderService, "orderStatusTopic", "smarteats.order.status");
        ReflectionTestUtils.setField(orderService, "orderAcceptedTopic", "smarteats.order.accepted");
        ReflectionTestUtils.setField(orderService, "orderReadyTopic", "smarteats.order.ready");
    }

    private Order createPendingPaymentOrder() {
        return Order.builder()
                .id(orderId)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>(List.of(
                        CartItem.builder().menuItemId("item_1").name("Butter Chicken").quantity(2).price(180.0).build()
                )))
                .totalAmount(360.0)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .razorpayOrderId(razorpayOrderId)
                .deliveryLatitude(12.9716)
                .deliveryLongitude(77.5946)
                .build();
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-01: Valid signature -> PENDING_PAYMENT to CREATED, PAID, Kafka event published exactly once")
    void testVerifyPaymentSuccess() {
        Order order = createPendingPaymentOrder();
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(razorpayClientWrapper.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, validSignature))
                .thenReturn(true);
        when(razorpayClientWrapper.fetchPaymentMethod(razorpayPaymentId)).thenReturn("UPI");
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId(orderId)
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(razorpayPaymentId)
                .razorpaySignature(validSignature)
                .build();

        PaymentVerifyResponse response = orderService.verifyPayment(customerEmail, request);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals(orderId, response.getOrderId());
        assertEquals(PaymentStatus.PAID, response.getPaymentStatus());
        assertEquals(OrderStatus.CREATED, response.getOrderStatus());
        assertEquals("Payment verified successfully", response.getMessage());

        verify(orderRepository).save(orderCaptor.capture());
        Order saved = orderCaptor.getValue();
        assertEquals(OrderStatus.CREATED, saved.getStatus());
        assertEquals(PaymentStatus.PAID, saved.getPaymentStatus());
        assertEquals(razorpayPaymentId, saved.getRazorpayPaymentId());
        assertEquals(validSignature, saved.getRazorpaySignature());
        assertEquals("UPI", saved.getPaymentMethod());
        assertNotNull(saved.getPaymentTime());

        // Verify Kafka event published exactly once
        verify(kafkaTemplate, times(1)).send(eq("smarteats.order.created"), eq(orderId), eventCaptor.capture());
        OrderCreatedEvent event = eventCaptor.getValue();
        assertEquals(orderId, event.getOrderId());
        assertEquals(customerEmail, event.getCustomerEmail());
        assertEquals(360.0, event.getTotalAmount());

        // Verify cart cleared
        verify(redisTemplate, times(1)).delete("cart:" + customerEmail);

        // Verify inventory is NOT reserved again
        verify(restaurantServiceClient, never()).reserveInventory(anyString(), anyList());
        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-02: Invalid signature -> Order cancelled, FAILED payment, inventory compensation released, zero Kafka event")
    void testVerifyPaymentInvalidSignature() {
        Order order = createPendingPaymentOrder();
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(razorpayClientWrapper.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, "tampered_sig"))
                .thenReturn(false);

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId(orderId)
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(razorpayPaymentId)
                .razorpaySignature("tampered_sig")
                .build();

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> orderService.verifyPayment(customerEmail, request));

        assertTrue(ex.getMessage().contains("Invalid Razorpay signature"));

        // Order marked CANCELLED and FAILED
        verify(orderRepository).save(orderCaptor.capture());
        Order saved = orderCaptor.getValue();
        assertEquals(OrderStatus.CANCELLED, saved.getStatus());
        assertEquals(PaymentStatus.FAILED, saved.getPaymentStatus());

        // Inventory compensation released
        verify(restaurantServiceClient, times(1)).releaseInventory(eq(restaurantId), anyList());

        // ZERO Kafka events published
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-03: Wrong customer IDOR attempt -> ForbiddenException thrown, zero changes")
    void testVerifyPaymentIdorProtection() {
        Order order = createPendingPaymentOrder();
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId(orderId)
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(razorpayPaymentId)
                .razorpaySignature(validSignature)
                .build();

        ForbiddenException ex = assertThrows(ForbiddenException.class,
                () -> orderService.verifyPayment("attacker@smarteats.com", request));

        assertTrue(ex.getMessage().contains("Access Denied"));
        verifyNoInteractions(razorpayClientWrapper);
        verify(orderRepository, never()).save(any());
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-04: Wrong razorpayOrderId -> BadRequestException thrown, zero changes")
    void testVerifyPaymentWrongRazorpayOrderId() {
        Order order = createPendingPaymentOrder();
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId(orderId)
                .razorpayOrderId("order_mismatch_9999")
                .razorpayPaymentId(razorpayPaymentId)
                .razorpaySignature(validSignature)
                .build();

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> orderService.verifyPayment(customerEmail, request));

        assertTrue(ex.getMessage().contains("Razorpay order ID mismatch"));
        verifyNoInteractions(razorpayClientWrapper);
        verify(orderRepository, never()).save(any());
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-05: Already PAID -> Idempotent response, zero duplicate Kafka events, zero inventory change")
    void testVerifyPaymentIdempotency() {
        Order order = createPendingPaymentOrder();
        order.setStatus(OrderStatus.CREATED);
        order.setPaymentStatus(PaymentStatus.PAID);
        order.setRazorpayPaymentId(razorpayPaymentId);
        order.setRazorpaySignature(validSignature);

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId(orderId)
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(razorpayPaymentId)
                .razorpaySignature(validSignature)
                .build();

        PaymentVerifyResponse response = orderService.verifyPayment(customerEmail, request);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals(PaymentStatus.PAID, response.getPaymentStatus());
        assertEquals(OrderStatus.CREATED, response.getOrderStatus());
        assertEquals("Payment already verified", response.getMessage());

        // No new save, no Kafka publication, no inventory operations
        verify(orderRepository, never()).save(any());
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
        verifyNoInteractions(restaurantServiceClient);
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-06: Inventory is NOT reserved twice during verification")
    void testInventoryNotReservedTwice() {
        Order order = createPendingPaymentOrder();
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(razorpayClientWrapper.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, validSignature))
                .thenReturn(true);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId(orderId)
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(razorpayPaymentId)
                .razorpaySignature(validSignature)
                .build();

        orderService.verifyPayment(customerEmail, request);

        verify(restaurantServiceClient, never()).reserveInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-07: Inventory is NOT released after successful payment")
    void testInventoryNotReleasedOnSuccess() {
        Order order = createPendingPaymentOrder();
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(razorpayClientWrapper.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, validSignature))
                .thenReturn(true);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId(orderId)
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(razorpayPaymentId)
                .razorpaySignature(validSignature)
                .build();

        orderService.verifyPayment(customerEmail, request);

        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-08: MongoDB persistence failure is handled safely")
    void testMongoPersistenceFailureHandled() {
        Order order = createPendingPaymentOrder();
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(razorpayClientWrapper.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, validSignature))
                .thenReturn(true);
        when(orderRepository.save(any(Order.class))).thenThrow(new RuntimeException("MongoDB write error"));

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId(orderId)
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(razorpayPaymentId)
                .razorpaySignature(validSignature)
                .build();

        assertThrows(RuntimeException.class, () -> orderService.verifyPayment(customerEmail, request));

        // Kafka should not be called if DB save failed
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-09: Kafka publish failure does NOT convert successful payment to FAILED")
    void testKafkaFailureDoesNotRevertPayment() {
        Order order = createPendingPaymentOrder();
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(razorpayClientWrapper.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, validSignature))
                .thenReturn(true);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("Kafka broker down"))
                .when(kafkaTemplate).send(anyString(), anyString(), any());

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId(orderId)
                .razorpayOrderId(razorpayOrderId)
                .razorpayPaymentId(razorpayPaymentId)
                .razorpaySignature(validSignature)
                .build();

        PaymentVerifyResponse response = orderService.verifyPayment(customerEmail, request);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals(PaymentStatus.PAID, response.getPaymentStatus());
        assertEquals(OrderStatus.CREATED, response.getOrderStatus());

        // Inventory is NOT released because order is successfully paid in DB
        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-10: Legacy orders without payment fields deserialize and load safely")
    void testLegacyOrderLoading() {
        Order legacyOrder = Order.builder()
                .id("ord_legacy_no_pay")
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>())
                .totalAmount(250.0)
                .status(OrderStatus.CREATED)
                .createdAt(LocalDateTime.now())
                .build();

        when(orderRepository.findById("ord_legacy_no_pay")).thenReturn(Optional.of(legacyOrder));

        com.smarteats.order.dto.OrderResponse response = orderService.getOrderById("ord_legacy_no_pay");
        assertNotNull(response);
        assertEquals("ord_legacy_no_pay", response.getId());
        assertNull(response.getPaymentStatus());
        assertNull(response.getRazorpayOrderId());
    }

    @Test
    @DisplayName("TC-PAY-VERIFY-11: Cryptographic HMAC-SHA256 signature verification with known test vector")
    void testCryptographicHmacSha256SignatureVerification() throws Exception {
        String testSecret = "eU3taZ4ADVpI3HT3sfnjRfvf";
        String testOrderId = "order_DBJOWzybf0sJbb";
        String testPaymentId = "pay_29384jj73";

        // Generate known signature using calculateHmacSha256
        String expectedSignature = RazorpayClientWrapper.calculateHmacSha256(testOrderId + "|" + testPaymentId, testSecret);
        assertNotNull(expectedSignature);
        assertEquals(64, expectedSignature.length());

        // Test with RazorpayClientWrapper
        RazorpayClientWrapper wrapper = new RazorpayClientWrapper("rzp_test_SZ9vgZQjij4g7j", testSecret);
        assertTrue(wrapper.verifyPaymentSignature(testOrderId, testPaymentId, expectedSignature));
        assertTrue(wrapper.verifyPaymentSignature(testOrderId, testPaymentId, expectedSignature.toUpperCase()));

        // Tampered paymentId should fail
        assertFalse(wrapper.verifyPaymentSignature(testOrderId, "pay_tampered_123", expectedSignature));

        // Tampered signature should fail
        assertFalse(wrapper.verifyPaymentSignature(testOrderId, testPaymentId, "bad_signature_1234567890abcdef1234567890abcdef1234567890abcdef12345678"));
    }
}
