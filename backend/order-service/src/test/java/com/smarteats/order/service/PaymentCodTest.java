package com.smarteats.order.service;

import com.smarteats.common.enums.PaymentStatus;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.order.client.AuthServiceClient;
import com.smarteats.order.client.CustomerCoordinates;
import com.smarteats.order.client.RazorpayClientWrapper;
import com.smarteats.order.client.RestaurantServiceClient;
import com.smarteats.order.dto.CartDto;
import com.smarteats.order.dto.OrderCreatedEvent;
import com.smarteats.order.dto.OrderResponse;
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
class PaymentCodTest {

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

    @Captor
    private ArgumentCaptor<OrderCreatedEvent> eventCaptor;

    private OrderServiceImpl orderService;

    private final String customerEmail = "customer@smarteats.com";
    private final String restaurantId = "rest_test_cod_01";

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
    }

    private CartDto createSampleCart() {
        List<CartItem> items = new ArrayList<>();
        items.add(CartItem.builder().menuItemId("item_1").name("Butter Chicken").quantity(2).price(250.0).build());
        items.add(CartItem.builder().menuItemId("item_2").name("Garlic Naan").quantity(3).price(50.0).build());

        return CartDto.builder()
                .userEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(items)
                .build();
    }

    @Test
    @DisplayName("TC-COD-01: Valid COD cart creates CREATED order")
    void testValidCodCartCreatesCreatedOrder() {
        CartDto cart = createSampleCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9255, 79.1333));

        Order mockSaved = Order.builder()
                .id("ord_cod_001")
                .customerEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(cart.getItems())
                .totalAmount(650.0)
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PENDING)
                .paymentMethod("COD")
                .build();

        when(orderRepository.save(any(Order.class))).thenReturn(mockSaved);

        OrderResponse response = orderService.placeCodOrder(customerEmail);

        assertNotNull(response);
        assertEquals("ord_cod_001", response.getId());
        assertEquals(OrderStatus.CREATED, response.getStatus());
        assertEquals(PaymentStatus.PENDING, response.getPaymentStatus());
        assertEquals("COD", response.getPaymentMethod());
        assertEquals(650.0, response.getTotalAmount());

        verify(orderRepository).save(orderCaptor.capture());
        Order captured = orderCaptor.getValue();
        assertEquals(OrderStatus.CREATED, captured.getStatus());
        assertEquals(PaymentStatus.PENDING, captured.getPaymentStatus());
        assertEquals("COD", captured.getPaymentMethod());
    }

    @Test
    @DisplayName("TC-COD-02: COD order has paymentMethod = COD and paymentStatus = PENDING")
    void testCodOrderStateAttributes() {
        CartDto cart = createSampleCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9255, 79.1333));

        when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            o.setId("ord_cod_002");
            return o;
        });

        OrderResponse response = orderService.placeCodOrder(customerEmail);

        assertEquals("COD", response.getPaymentMethod());
        assertEquals(PaymentStatus.PENDING, response.getPaymentStatus());
        assertNull(response.getRazorpayOrderId());
    }

    @Test
    @DisplayName("TC-COD-03: COD creates no Razorpay order")
    void testCodCreatesNoRazorpayOrder() throws Exception {
        CartDto cart = createSampleCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9255, 79.1333));

        when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            o.setId("ord_cod_003");
            return o;
        });

        orderService.placeCodOrder(customerEmail);

        verify(razorpayClientWrapper, never()).createRazorpayOrder(anyString(), anyDouble(), anyString());
        verify(orderRepository).save(orderCaptor.capture());
        assertNull(orderCaptor.getValue().getRazorpayOrderId());
        assertNull(orderCaptor.getValue().getRazorpayPaymentId());
        assertNull(orderCaptor.getValue().getRazorpaySignature());
    }

    @Test
    @DisplayName("TC-COD-04: COD creates no PENDING_PAYMENT order")
    void testCodCreatesNoPendingPaymentOrder() {
        CartDto cart = createSampleCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9255, 79.1333));

        when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            o.setId("ord_cod_004");
            return o;
        });

        OrderResponse response = orderService.placeCodOrder(customerEmail);

        assertNotEquals(OrderStatus.PENDING_PAYMENT, response.getStatus());
        assertEquals(OrderStatus.CREATED, response.getStatus());
    }

    @Test
    @DisplayName("TC-COD-05: COD reserves inventory atomically")
    void testCodReservesInventoryAtomically() {
        CartDto cart = createSampleCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9255, 79.1333));

        when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            o.setId("ord_cod_005");
            return o;
        });

        orderService.placeCodOrder(customerEmail);

        verify(restaurantServiceClient, times(1)).reserveInventory(eq(restaurantId), argThat(list ->
                list.size() == 2 &&
                list.get(0).getMenuItemId().equals("item_1") && list.get(0).getQuantity() == 2 &&
                list.get(1).getMenuItemId().equals("item_2") && list.get(1).getQuantity() == 3
        ));
    }

    @Test
    @DisplayName("TC-COD-06: Insufficient inventory rejects COD and keeps cart")
    void testInsufficientInventoryRejectsCodAndKeepsCart() {
        CartDto cart = createSampleCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(false);

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                orderService.placeCodOrder(customerEmail));

        assertTrue(ex.getMessage().contains("no longer available"));
        verify(orderRepository, never()).save(any());
        verify(redisTemplate, never()).delete(anyString());
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-COD-07: Database failure releases reserved inventory")
    void testDatabaseFailureReleasesReservedInventory() {
        CartDto cart = createSampleCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9255, 79.1333));

        when(orderRepository.save(any(Order.class))).thenThrow(new RuntimeException("MongoDB Connection Timeout"));

        assertThrows(RuntimeException.class, () ->
                orderService.placeCodOrder(customerEmail));

        verify(restaurantServiceClient, times(1)).releaseInventory(eq(restaurantId), anyList());
        verify(redisTemplate, never()).delete(anyString());
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-COD-08: Successful COD publishes smarteats.order.created once")
    void testSuccessfulCodPublishesKafkaEventOnce() {
        CartDto cart = createSampleCart();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9255, 79.1333));

        when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            o.setId("ord_cod_008");
            return o;
        });

        orderService.placeCodOrder(customerEmail);

        verify(kafkaTemplate, times(1)).send(eq("smarteats.order.created"), eq("ord_cod_008"), eventCaptor.capture());
        OrderCreatedEvent event = eventCaptor.getValue();
        assertEquals("ord_cod_008", event.getOrderId());
        assertEquals(customerEmail, event.getCustomerEmail());
        assertEquals(restaurantId, event.getRestaurantId());
        assertEquals(650.0, event.getTotalAmount());
        assertEquals(2, event.getItems().size());
    }

    @Test
    @DisplayName("TC-COD-09: Razorpay webhook does not modify COD orders")
    void testRazorpayWebhookDoesNotModifyCodOrders() {
        String rawPayload = "{\"event\":\"payment.captured\",\"payload\":{\"payment\":{\"entity\":{\"id\":\"pay_123\",\"order_id\":\"order_rzp_unknown\",\"status\":\"captured\"}}}}";
        String validSig = "sig_valid";

        when(razorpayClientWrapper.verifyWebhookSignature(rawPayload, validSig)).thenReturn(true);
        when(orderRepository.findByRazorpayOrderId("order_rzp_unknown")).thenReturn(Optional.empty());

        WebhookResponse response = orderService.processWebhook(rawPayload, validSig);

        assertTrue(response.isSuccess());
        assertTrue(response.getMessage().contains("No order found"));
        verify(orderRepository, never()).save(any());
        verify(restaurantServiceClient, never()).releaseInventory(anyString(), anyList());
    }

    @Test
    @DisplayName("TC-COD-10: Customer cannot create COD order for empty cart / arbitrary email")
    void testEmptyCartRejection() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(null);

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                orderService.placeCodOrder(customerEmail));

        assertTrue(ex.getMessage().contains("empty"));
        verify(restaurantServiceClient, never()).reserveInventory(anyString(), anyList());
        verify(orderRepository, never()).save(any());
    }
}
