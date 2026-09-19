package com.smarteats.order.service;

import com.razorpay.RazorpayException;
import com.smarteats.common.enums.PaymentStatus;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.order.client.AuthServiceClient;
import com.smarteats.order.client.CustomerCoordinates;
import com.smarteats.order.client.RazorpayClientWrapper;
import com.smarteats.order.client.RestaurantServiceClient;
import com.smarteats.order.dto.CartDto;
import com.smarteats.order.dto.OrderResponse;
import com.smarteats.order.dto.PaymentOrderResponse;
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
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentOrderCreationTest {

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
    private final String restaurantId = "rest_test_pay_01";

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

    private CartDto createValidCart() {
        return CartDto.builder()
                .userEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>(List.of(
                        CartItem.builder().menuItemId("item_butter_chicken").name("Butter Chicken").quantity(2).price(180.0).build(),
                        CartItem.builder().menuItemId("item_naan").name("Garlic Naan").quantity(4).price(40.0).build()
                )))
                .build();
    }

    @Test
    @DisplayName("TC-PAY-01: Empty cart rejection - throws BadRequestException")
    void testCreatePaymentOrderEmptyCartRejection() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(null);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> orderService.createPaymentOrder(customerEmail));

        assertTrue(ex.getMessage().contains("Shopping cart is empty"));
        verifyNoInteractions(restaurantServiceClient);
        verifyNoInteractions(razorpayClientWrapper);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("TC-PAY-02: Closed restaurant rejection - throws BadRequestException")
    void testCreatePaymentOrderClosedRestaurantRejection() {
        CartDto cart = createValidCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(false);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> orderService.createPaymentOrder(customerEmail));

        assertTrue(ex.getMessage().contains("Restaurant is currently closed"));
        verify(restaurantServiceClient, never()).reserveInventory(anyString(), anyList());
        verifyNoInteractions(razorpayClientWrapper);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("TC-PAY-03: Insufficient inventory rejection - throws BadRequestException without calling Razorpay")
    void testCreatePaymentOrderInsufficientInventoryRejection() {
        CartDto cart = createValidCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(false);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> orderService.createPaymentOrder(customerEmail));

        assertTrue(ex.getMessage().contains("no longer available in the requested quantity"));
        verifyNoInteractions(razorpayClientWrapper);
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("TC-PAY-04: Inventory reservation succeeds -> Order created in DB as PENDING_PAYMENT")
    void testCreatePaymentOrderSuccessFlow() throws Exception {
        CartDto cart = createValidCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9716, 77.5946));
        when(razorpayClientWrapper.getKeyId()).thenReturn("rzp_test_SZ9vgZQjij4g7j");
        when(razorpayClientWrapper.createRazorpayOrder(anyString(), eq(520.0), eq(customerEmail)))
                .thenReturn("order_rzp_mock_999");

        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            if (o.getId() == null) {
                o.setId("ord_smarteats_777");
            }
            return o;
        });

        PaymentOrderResponse response = orderService.createPaymentOrder(customerEmail);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("ord_smarteats_777", response.getOrderId());
        assertEquals("order_rzp_mock_999", response.getRazorpayOrderId());
        assertEquals(520.0, response.getAmount());
        assertEquals(52000L, response.getAmountInPaise());
        assertEquals("INR", response.getCurrency());
        assertEquals("rzp_test_SZ9vgZQjij4g7j", response.getKeyId());
        assertEquals(customerEmail, response.getCustomerEmail());
        assertEquals(restaurantId, response.getRestaurantId());

        verify(orderRepository, atLeastOnce()).save(orderCaptor.capture());
        Order captured = orderCaptor.getValue();
        assertEquals(OrderStatus.PENDING_PAYMENT, captured.getStatus());
        assertEquals(PaymentStatus.PENDING, captured.getPaymentStatus());
        assertEquals("order_rzp_mock_999", captured.getRazorpayOrderId());
    }

    @Test
    @DisplayName("TC-PAY-05: Razorpay order creation fails -> Inventory compensation released and order cancelled")
    void testCreatePaymentOrderRazorpayFailureTriggersCompensation() throws Exception {
        CartDto cart = createValidCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9716, 77.5946));

        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            if (o.getId() == null) {
                o.setId("ord_smarteats_fail_01");
            }
            return o;
        });

        when(razorpayClientWrapper.createRazorpayOrder(anyString(), anyDouble(), anyString()))
                .thenThrow(new RazorpayException("Razorpay gateway timeout"));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> orderService.createPaymentOrder(customerEmail));

        assertTrue(ex.getMessage().contains("Failed to initiate payment with Razorpay"));
        verify(restaurantServiceClient, times(1)).releaseInventory(eq(restaurantId), anyList());
    }

    @Test
    @DisplayName("TC-PAY-06: DB persistence failure after reservation -> Inventory compensation released")
    void testCreatePaymentOrderDbPersistenceFailureTriggersCompensation() {
        CartDto cart = createValidCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9716, 77.5946));

        when(orderRepository.save(any(Order.class))).thenThrow(new RuntimeException("MongoDB connection lost"));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> orderService.createPaymentOrder(customerEmail));

        assertEquals("MongoDB connection lost", ex.getMessage());
        verify(restaurantServiceClient, times(1)).releaseInventory(eq(restaurantId), anyList());
        verifyNoInteractions(razorpayClientWrapper);
    }

    @Test
    @DisplayName("TC-PAY-07: PENDING_PAYMENT order does NOT publish smarteats.order.created to Kafka")
    void testCreatePaymentOrderDoesNotPublishOrderCreatedToKafka() throws Exception {
        CartDto cart = createValidCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9716, 77.5946));
        when(razorpayClientWrapper.createRazorpayOrder(anyString(), anyDouble(), anyString()))
                .thenReturn("order_rzp_mock_123");

        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId("ord_test_kafka_silent");
            return o;
        });

        orderService.createPaymentOrder(customerEmail);

        // ZERO Kafka events must be published for PENDING_PAYMENT
        verify(kafkaTemplate, never()).send(eq("smarteats.order.created"), anyString(), any());
        verify(kafkaTemplate, never()).send(eq("smarteats.order.accepted"), anyString(), any());
        verify(kafkaTemplate, never()).send(eq("smarteats.order.ready"), anyString(), any());
    }

    @Test
    @DisplayName("TC-PAY-08: Legacy placeOrder direct checkout compatibility preserved")
    void testLegacyPlaceOrderCompatibility() {
        CartDto cart = createValidCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9716, 77.5946));

        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId("ord_legacy_999");
            return o;
        });

        OrderResponse response = orderService.placeOrder(customerEmail);

        assertNotNull(response);
        assertEquals(OrderStatus.CREATED, response.getStatus());
        verify(redisTemplate, times(1)).delete("cart:" + customerEmail);
        verify(kafkaTemplate, times(1)).send(eq("smarteats.order.created"), eq("ord_legacy_999"), any());
    }

    @Test
    @DisplayName("TC-PAY-09: Order response contains payment fields correctly")
    void testGetOrderByIdContainsPaymentFields() {
        Order order = Order.builder()
                .id("ord_with_pay_info")
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>())
                .totalAmount(450.0)
                .status(OrderStatus.PENDING_PAYMENT)
                .paymentStatus(PaymentStatus.PENDING)
                .razorpayOrderId("order_rzp_existing_456")
                .paymentMethod("UPI")
                .build();

        when(orderRepository.findById("ord_with_pay_info")).thenReturn(Optional.of(order));

        OrderResponse response = orderService.getOrderById("ord_with_pay_info");

        assertNotNull(response);
        assertEquals(PaymentStatus.PENDING, response.getPaymentStatus());
        assertEquals("order_rzp_existing_456", response.getRazorpayOrderId());
        assertEquals("UPI", response.getPaymentMethod());
    }

    @Test
    @DisplayName("TC-PAY-10: IDOR protection prevents unauthorized access to payment orders")
    void testIdorProtectionForPaymentOrders() {
        Order order = Order.builder()
                .id("ord_secret_123")
                .customerEmail("victim@smarteats.com")
                .restaurantId(restaurantId)
                .items(new ArrayList<>())
                .totalAmount(300.0)
                .status(OrderStatus.PENDING_PAYMENT)
                .build();

        when(orderRepository.findById("ord_secret_123")).thenReturn(Optional.of(order));

        ForbiddenException ex = assertThrows(ForbiddenException.class,
                () -> orderService.getOrderById("ord_secret_123", "attacker@smarteats.com", "ROLE_CUSTOMER"));

        assertTrue(ex.getMessage().contains("Access Denied"));
    }
}
