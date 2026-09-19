package com.smarteats.order.service;

import com.smarteats.common.enums.PaymentStatus;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.order.client.AuthServiceClient;
import com.smarteats.order.client.CustomerCoordinates;
import com.smarteats.order.client.RazorpayClientWrapper;
import com.smarteats.order.client.RestaurantServiceClient;
import com.smarteats.order.dto.*;
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
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderCreationIdempotencyTest {

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

    @Captor
    private ArgumentCaptor<Order> orderCaptor;

    private OrderServiceImpl orderService;

    private final String customerEmail = "customer@smarteats.com";
    private final String otherCustomerEmail = "attacker@smarteats.com";
    private final String restaurantId = "rest_test_idemp_01";

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);

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
    }

    private CartDto createSampleCart() {
        List<CartItem> items = new ArrayList<>();
        items.add(CartItem.builder().menuItemId("item_1").name("Paneer Tikka").quantity(2).price(200.0).build());
        items.add(CartItem.builder().menuItemId("item_2").name("Butter Naan").quantity(4).price(40.0).build());

        return CartDto.builder()
                .userEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(items)
                .build();
    }

    @Test
    @DisplayName("TC-IDEMP-01: First Razorpay checkout creates one SmartEats order with idempotencyKey")
    void testFirstRazorpayCheckoutCreatesOrder() throws Exception {
        String key = UUID.randomUUID().toString();
        CartDto cart = createSampleCart();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.empty());
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail)).thenReturn(new CustomerCoordinates(12.9716, 77.5946));

        Order savedOrder = Order.builder()
                .id("order_rzp_01")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .totalAmount(560.0)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("RAZORPAY")
                .build();

        when(orderRepository.save(any(Order.class))).thenReturn(savedOrder);
        when(razorpayClientWrapper.getKeyId()).thenReturn("rzp_test_key");
        when(razorpayClientWrapper.createRazorpayOrder(eq("order_rzp_01"), eq(560.0), eq(customerEmail)))
                .thenReturn("order_rzp_ext_01");

        PaymentOrderResponse response = orderService.createPaymentOrder(customerEmail, key);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("order_rzp_01", response.getOrderId());
        assertEquals("order_rzp_ext_01", response.getRazorpayOrderId());
        assertEquals(key, response.getIdempotencyKey());

        verify(restaurantServiceClient, times(1)).reserveInventory(eq(restaurantId), anyList());
        verify(razorpayClientWrapper, times(1)).createRazorpayOrder(anyString(), anyDouble(), anyString());
    }

    @Test
    @DisplayName("TC-IDEMP-02: Same Razorpay request repeated returns same order")
    void testSameRazorpayRequestRepeatedReturnsSameOrder() throws Exception {
        String key = UUID.randomUUID().toString();

        Order existingOrder = Order.builder()
                .id("order_rzp_01")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .totalAmount(560.0)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("RAZORPAY")
                .razorpayOrderId("order_rzp_ext_01")
                .build();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.of(existingOrder));
        when(razorpayClientWrapper.getKeyId()).thenReturn("rzp_test_key");

        PaymentOrderResponse response = orderService.createPaymentOrder(customerEmail, key);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("order_rzp_01", response.getOrderId());
        assertEquals("order_rzp_ext_01", response.getRazorpayOrderId());
        assertEquals(key, response.getIdempotencyKey());

        // Must not call redis, inventory or razorpay creation
        verify(restaurantServiceClient, never()).reserveInventory(anyString(), anyList());
        verify(razorpayClientWrapper, never()).createRazorpayOrder(anyString(), anyDouble(), anyString());
    }

    @Test
    @DisplayName("TC-IDEMP-03: Same Razorpay request creates only one Razorpay order")
    void testSameRazorpayRequestCreatesOnlyOneRazorpayOrder() throws Exception {
        String key = UUID.randomUUID().toString();
        Order existingOrder = Order.builder()
                .id("order_rzp_01")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .totalAmount(560.0)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("RAZORPAY")
                .razorpayOrderId("order_rzp_ext_01")
                .build();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.of(existingOrder));
        when(razorpayClientWrapper.getKeyId()).thenReturn("rzp_test_key");

        orderService.createPaymentOrder(customerEmail, key);
        orderService.createPaymentOrder(customerEmail, key);

        verify(razorpayClientWrapper, never()).createRazorpayOrder(anyString(), anyDouble(), anyString());
    }

    @Test
    @DisplayName("TC-IDEMP-04: Same Razorpay request reserves inventory only once")
    void testSameRazorpayRequestReservesInventoryOnlyOnce() throws Exception {
        String key = UUID.randomUUID().toString();
        Order existingOrder = Order.builder()
                .id("order_rzp_01")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .totalAmount(560.0)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("RAZORPAY")
                .razorpayOrderId("order_rzp_ext_01")
                .build();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.of(existingOrder));
        when(razorpayClientWrapper.getKeyId()).thenReturn("rzp_test_key");

        orderService.createPaymentOrder(customerEmail, key);

        verify(restaurantServiceClient, never()).reserveInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-IDEMP-05: Two concurrent Razorpay requests with same key create one SmartEats order, one Razorpay order, one inventory reservation")
    void testConcurrentRazorpayRequestsDuplicateKeyCompensation() throws Exception {
        String key = UUID.randomUUID().toString();
        CartDto cart = createSampleCart();

        // Simulate Thread B: initial check returns empty, but save throws DuplicateKeyException because Thread A just saved
        when(orderRepository.findFirstByIdempotencyKey(key))
                .thenReturn(Optional.empty()) // Before save
                .thenReturn(Optional.of(Order.builder() // After duplicate key catch
                        .id("order_rzp_winner")
                        .idempotencyKey(key)
                        .customerEmail(customerEmail)
                        .restaurantId(restaurantId)
                        .totalAmount(560.0)
                        .status(OrderStatus.PENDING_PAYMENT)
                        .paymentStatus(PaymentStatus.PENDING)
                        .paymentMethod("RAZORPAY")
                        .razorpayOrderId("order_rzp_ext_winner")
                        .build()));

        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail)).thenReturn(new CustomerCoordinates(12.9716, 77.5946));
        when(orderRepository.save(any(Order.class))).thenThrow(new DuplicateKeyException("E11000 duplicate key error collection: smarteats_orders index: idempotencyKey"));
        when(razorpayClientWrapper.getKeyId()).thenReturn("rzp_test_key");

        PaymentOrderResponse response = orderService.createPaymentOrder(customerEmail, key);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("order_rzp_winner", response.getOrderId());
        assertEquals("order_rzp_ext_winner", response.getRazorpayOrderId());

        // Thread B must release its redundant inventory reservation
        verify(restaurantServiceClient, times(1)).releaseInventory(eq(restaurantId), anyList());
        // Thread B must not create an extra Razorpay order
        verify(razorpayClientWrapper, never()).createRazorpayOrder(anyString(), anyDouble(), anyString());
    }

    @Test
    @DisplayName("TC-IDEMP-06: First COD request creates one order")
    void testFirstCodRequestCreatesOneOrder() {
        String key = UUID.randomUUID().toString();
        CartDto cart = createSampleCart();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.empty());
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail)).thenReturn(new CustomerCoordinates(12.9716, 77.5946));

        Order savedOrder = Order.builder()
                .id("order_cod_01")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(cart.getItems())
                .totalAmount(560.0)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("COD")
                .build();

        when(orderRepository.save(any(Order.class))).thenReturn(savedOrder);

        OrderResponse response = orderService.placeCodOrder(customerEmail, key);

        assertNotNull(response);
        assertEquals("order_cod_01", response.getId());
        assertEquals(OrderStatus.CREATED, response.getStatus());
        assertEquals(PaymentStatus.PENDING, response.getPaymentStatus());
        assertEquals("COD", response.getPaymentMethod());
        assertEquals(key, response.getIdempotencyKey());

        verify(restaurantServiceClient, times(1)).reserveInventory(eq(restaurantId), anyList());
        verify(redisTemplate, times(1)).delete("cart:" + customerEmail);
        verify(kafkaTemplate, times(1)).send(eq("smarteats.order.created"), eq("order_cod_01"), any());
    }

    @Test
    @DisplayName("TC-IDEMP-07: Same COD request repeated returns same order")
    void testSameCodRequestRepeatedReturnsSameOrder() {
        String key = UUID.randomUUID().toString();

        Order existingOrder = Order.builder()
                .id("order_cod_01")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>())
                .totalAmount(560.0)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("COD")
                .build();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.of(existingOrder));

        OrderResponse response = orderService.placeCodOrder(customerEmail, key);

        assertNotNull(response);
        assertEquals("order_cod_01", response.getId());
        assertEquals(key, response.getIdempotencyKey());

        // Must not call redis, inventory, or kafka again
        verify(restaurantServiceClient, never()).reserveInventory(anyString(), anyList());
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-IDEMP-08: Two concurrent COD requests create only one order and compensate duplicate inventory")
    void testConcurrentCodRequestsDuplicateKeyCompensation() {
        String key = UUID.randomUUID().toString();
        CartDto cart = createSampleCart();

        Order winningOrder = Order.builder()
                .id("order_cod_winner")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(cart.getItems())
                .totalAmount(560.0)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("COD")
                .build();

        when(orderRepository.findFirstByIdempotencyKey(key))
                .thenReturn(Optional.empty()) // Initial check
                .thenReturn(Optional.of(winningOrder)); // Recovery check after DuplicateKeyException

        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail)).thenReturn(new CustomerCoordinates(12.9716, 77.5946));
        when(orderRepository.save(any(Order.class))).thenThrow(new DuplicateKeyException("E11000 duplicate key error"));

        OrderResponse response = orderService.placeCodOrder(customerEmail, key);

        assertNotNull(response);
        assertEquals("order_cod_winner", response.getId());

        // Duplicate inventory must be released
        verify(restaurantServiceClient, times(1)).releaseInventory(eq(restaurantId), anyList());
        // Losing thread must not publish duplicate kafka event
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-IDEMP-09: Duplicate COD request does not publish duplicate Kafka event")
    void testDuplicateCodRequestNoDuplicateKafka() {
        String key = UUID.randomUUID().toString();

        Order existingOrder = Order.builder()
                .id("order_cod_01")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>())
                .totalAmount(560.0)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("COD")
                .build();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.of(existingOrder));

        orderService.placeCodOrder(customerEmail, key);
        orderService.placeCodOrder(customerEmail, key);

        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-IDEMP-10: Idempotency key reused by another customer returns 403 Forbidden")
    void testIdempotencyKeyReusedByAnotherCustomerReturnsForbidden() {
        String key = UUID.randomUUID().toString();

        Order existingOrder = Order.builder()
                .id("order_victim_01")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .totalAmount(560.0)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("COD")
                .build();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.of(existingOrder));

        ForbiddenException ex1 = assertThrows(ForbiddenException.class, () ->
                orderService.placeCodOrder(otherCustomerEmail, key));
        assertTrue(ex1.getMessage().contains("belongs to another customer"));

        ForbiddenException ex2 = assertThrows(ForbiddenException.class, () ->
                orderService.createPaymentOrder(otherCustomerEmail, key));
        assertTrue(ex2.getMessage().contains("belongs to another customer"));
    }

    @Test
    @DisplayName("TC-IDEMP-11: COD key cannot be reused for Razorpay")
    void testCodKeyCannotBeReusedForRazorpay() {
        String key = UUID.randomUUID().toString();

        Order existingCodOrder = Order.builder()
                .id("order_cod_01")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .totalAmount(560.0)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("COD")
                .build();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.of(existingCodOrder));

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                orderService.createPaymentOrder(customerEmail, key));
        assertTrue(ex.getMessage().contains("Key was originally used for a Cash on Delivery (COD) order"));
    }

    @Test
    @DisplayName("TC-IDEMP-12: Razorpay key cannot be reused for COD")
    void testRazorpayKeyCannotBeReusedForCod() {
        String key = UUID.randomUUID().toString();

        Order existingRzpOrder = Order.builder()
                .id("order_rzp_01")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .totalAmount(560.0)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("RAZORPAY")
                .razorpayOrderId("order_rzp_ext_01")
                .build();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.of(existingRzpOrder));

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                orderService.placeCodOrder(customerEmail, key));
        assertTrue(ex.getMessage().contains("Key was originally used for an Online / Razorpay payment order"));
    }

    @Test
    @DisplayName("TC-IDEMP-13: Network retry after successful backend processing returns existing result")
    void testNetworkRetryAfterSuccessReturnsExistingResult() {
        String key = UUID.randomUUID().toString();

        Order existingOrder = Order.builder()
                .id("order_rzp_retry")
                .idempotencyKey(key)
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .totalAmount(450.0)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("RAZORPAY")
                .razorpayOrderId("order_ext_retry_123")
                .build();

        when(orderRepository.findFirstByIdempotencyKey(key)).thenReturn(Optional.of(existingOrder));
        when(razorpayClientWrapper.getKeyId()).thenReturn("rzp_test_key");

        // First attempt returns result; customer network dropped; customer retries with same key
        PaymentOrderResponse retryResponse = orderService.createPaymentOrder(customerEmail, key);

        assertEquals("order_rzp_retry", retryResponse.getOrderId());
        assertEquals("order_ext_retry_123", retryResponse.getRazorpayOrderId());
        assertEquals(key, retryResponse.getIdempotencyKey());
    }

    @Test
    @DisplayName("TC-IDEMP-14: Legacy orders without idempotencyKey still load safely")
    void testLegacyOrdersWithoutIdempotencyKeyLoadSafely() {
        Order legacyOrder = Order.builder()
                .id("legacy_order_999")
                .idempotencyKey(null) // Legacy order before idempotency feature
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .totalAmount(300.0)
                .status(OrderStatus.DELIVERED)
                .paymentStatus(PaymentStatus.PAID)
                .paymentMethod("COD")
                .build();

        when(orderRepository.findById("legacy_order_999")).thenReturn(Optional.of(legacyOrder));

        OrderResponse response = orderService.getOrderById("legacy_order_999", customerEmail, "ROLE_CUSTOMER");

        assertNotNull(response);
        assertEquals("legacy_order_999", response.getId());
        assertNull(response.getIdempotencyKey());
        assertEquals(OrderStatus.DELIVERED, response.getStatus());
    }

    @Test
    @DisplayName("TC-IDEMP-15: MongoDB unique sparse index annotation present on idempotencyKey field")
    void testMongoDbIndexAnnotationConfig() throws NoSuchFieldException {
        Field field = Order.class.getDeclaredField("idempotencyKey");
        assertNotNull(field);
        Indexed indexedAnnotation = field.getAnnotation(Indexed.class);
        assertNotNull(indexedAnnotation, "idempotencyKey must have @Indexed annotation");
        assertTrue(indexedAnnotation.unique(), "idempotencyKey index must be unique");
        assertTrue(indexedAnnotation.sparse(), "idempotencyKey index must be sparse to support legacy null keys");
    }

    @Test
    @DisplayName("TC-IDEMP-16: Duplicate payment verification remains idempotent")
    void testDuplicatePaymentVerificationRemainsIdempotent() {
        Order alreadyPaidOrder = Order.builder()
                .id("order_paid_01")
                .idempotencyKey(UUID.randomUUID().toString())
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PAID)
                .razorpayOrderId("rzp_order_01")
                .razorpayPaymentId("rzp_pay_01")
                .razorpaySignature("rzp_sig_01")
                .build();

        when(orderRepository.findById("order_paid_01")).thenReturn(Optional.of(alreadyPaidOrder));

        PaymentVerifyRequest request = PaymentVerifyRequest.builder()
                .orderId("order_paid_01")
                .razorpayOrderId("rzp_order_01")
                .razorpayPaymentId("rzp_pay_01")
                .razorpaySignature("rzp_sig_01")
                .build();

        PaymentVerifyResponse response = orderService.verifyPayment(customerEmail, request);

        assertTrue(response.isSuccess());
        assertEquals(PaymentStatus.PAID, response.getPaymentStatus());
        assertEquals(OrderStatus.CREATED, response.getOrderStatus());
        assertTrue(response.getMessage().contains("already verified"));

        // Must not publish duplicate Kafka event
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-IDEMP-17: Webhook processing remains idempotent")
    void testWebhookProcessingRemainsIdempotent() {
        Order alreadyPaidOrder = Order.builder()
                .id("order_webhook_01")
                .idempotencyKey(UUID.randomUUID().toString())
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PAID)
                .razorpayOrderId("rzp_order_webhook_01")
                .razorpayPaymentId("rzp_pay_webhook_01")
                .build();

        when(orderRepository.findByRazorpayOrderId("rzp_order_webhook_01")).thenReturn(Optional.of(alreadyPaidOrder));
        when(razorpayClientWrapper.verifyWebhookSignature(anyString(), anyString())).thenReturn(true);

        String rawPayload = "{\"event\":\"order.paid\",\"payload\":{\"order\":{\"entity\":{\"id\":\"rzp_order_webhook_01\"}},\"payment\":{\"entity\":{\"id\":\"rzp_pay_webhook_01\"}}}}";

        WebhookResponse response = orderService.processWebhook(rawPayload, "test_sig");

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("order_webhook_01", response.getOrderId());
        assertTrue(response.getMessage().contains("already paid and confirmed"));

        // Must not publish duplicate Kafka event
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }
}
