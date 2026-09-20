package com.smarteats.order.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.order.client.AuthServiceClient;
import com.smarteats.order.client.CustomerCoordinates;
import com.smarteats.order.client.RestaurantServiceClient;
import com.smarteats.order.dto.CartDto;
import com.smarteats.order.dto.OrderResponse;
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
class OrderInventoryCheckoutTest {

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
    private com.smarteats.order.client.RazorpayClientWrapper razorpayClientWrapper;

    private OrderServiceImpl orderService;

    private final String customerEmail = "customer@smarteats.com";
    private final String restaurantId = "rest_test_inventory";

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
        lenient().when(restaurantServiceClient.isOwnerOfRestaurant(anyString(), anyString())).thenReturn(true);
    }

    @Test
    @DisplayName("TC-INV-ORD-01: Order placement succeeds when restaurant-service confirms inventory reservation")
    void testPlaceOrderSucceedsWithInventoryReservation() {
        CartDto cart = CartDto.builder()
                .userEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>(List.of(
                        CartItem.builder().menuItemId("item_1").name("Paneer Tikka").quantity(2).price(200.0).build(),
                        CartItem.builder().menuItemId("item_2").name("Butter Naan").quantity(3).price(50.0).build()
                )))
                .build();

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9716, 77.5946));

        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order o = invocation.getArgument(0);
            o.setId("ord_success_123");
            return o;
        });

        OrderResponse response = orderService.placeOrder(customerEmail);

        assertNotNull(response);
        assertEquals("ord_success_123", response.getId());
        verify(restaurantServiceClient, times(1)).reserveInventory(eq(restaurantId), anyList());
        verify(orderRepository, times(1)).save(any(Order.class));
        verify(redisTemplate, times(1)).delete("cart:" + customerEmail);
        verify(kafkaTemplate, times(1)).send(eq("smarteats.order.created"), eq("ord_success_123"), any());
    }

    @Test
    @DisplayName("TC-INV-ORD-02: Order placement rejected with 400/BadRequest when restaurant inventory reservation fails")
    void testPlaceOrderFailsWhenInventoryReservationFails() {
        CartDto cart = CartDto.builder()
                .userEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>(List.of(
                        CartItem.builder().menuItemId("item_soldout").name("Biryani").quantity(5).price(250.0).build()
                )))
                .build();

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(false);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> orderService.placeOrder(customerEmail));

        assertEquals("One or more items are no longer available in the requested quantity.", ex.getMessage());
        verify(restaurantServiceClient, times(1)).reserveInventory(eq(restaurantId), anyList());
        verify(orderRepository, never()).save(any(Order.class));
        verify(redisTemplate, never()).delete(anyString());
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("TC-INV-ORD-03: Compensation rollback triggered when order persistence throws unexpected exception")
    void testPlaceOrderCompensationRollbackOnDbFailure() {
        CartDto cart = CartDto.builder()
                .userEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>(List.of(
                        CartItem.builder().menuItemId("item_1").name("Paneer Tikka").quantity(2).price(200.0).build()
                )))
                .build();

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(restaurantServiceClient.reserveInventory(eq(restaurantId), anyList())).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9716, 77.5946));

        when(orderRepository.save(any(Order.class))).thenThrow(new RuntimeException("Database timeout exception"));

        RuntimeException ex = assertThrows(RuntimeException.class, () -> orderService.placeOrder(customerEmail));
        assertEquals("Database timeout exception", ex.getMessage());

        // Verify that compensation release was called to restore reserved inventory
        verify(restaurantServiceClient, times(1)).releaseInventory(eq(restaurantId), anyList());
    }

    @Test
    @DisplayName("TC-INV-ORD-04: Rejecting or cancelling order releases portions back to restaurant inventory")
    void testOrderStatusRejectionRestoresInventory() {
        String orderId = "ord_to_reject";
        Order order = Order.builder()
                .id(orderId)
                .restaurantId(restaurantId)
                .customerEmail(customerEmail)
                .status(OrderStatus.CREATED)
                .items(List.of(
                        CartItem.builder().menuItemId("item_1").name("Paneer Tikka").quantity(2).price(200.0).build()
                ))
                .build();

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OrderResponse response = orderService.rejectOrder(orderId, "owner@smarteats.com");

        assertEquals(OrderStatus.REJECTED, response.getStatus());
        verify(restaurantServiceClient, times(1)).releaseInventory(eq(restaurantId), anyList());
    }
}
