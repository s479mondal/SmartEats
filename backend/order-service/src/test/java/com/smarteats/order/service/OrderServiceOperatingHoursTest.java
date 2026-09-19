package com.smarteats.order.service;

import com.smarteats.common.exception.BadRequestException;
import com.smarteats.order.client.AuthServiceClient;
import com.smarteats.order.client.CustomerCoordinates;
import com.smarteats.order.client.RestaurantServiceClient;
import com.smarteats.order.dto.CartDto;
import com.smarteats.order.dto.OrderResponse;
import com.smarteats.order.entity.CartItem;
import com.smarteats.order.entity.Order;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceOperatingHoursTest {

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
    private final String restaurantId = "rest_test_999";

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
        org.mockito.Mockito.lenient().when(restaurantServiceClient.reserveInventory(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).thenReturn(true);
    }

    @Test
    @DisplayName("ORDER TEST: Order placement succeeds when restaurant is OPEN")
    void testPlaceOrderSucceedsWhenRestaurantOpen() {
        CartDto cart = CartDto.builder()
                .userEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>(List.of(
                        CartItem.builder().menuItemId("m1").name("Burger").quantity(1).price(150.0).build()
                )))
                .build();

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(true);
        when(authServiceClient.getCustomerCoordinates(customerEmail))
                .thenReturn(new CustomerCoordinates(12.9716, 77.5946));

        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order o = invocation.getArgument(0);
            o.setId("ord_test_success");
            return o;
        });

        OrderResponse response = orderService.placeOrder(customerEmail);

        assertNotNull(response);
        assertEquals("ord_test_success", response.getId());
        verify(restaurantServiceClient, times(1)).isRestaurantOpen(restaurantId);
        verify(orderRepository, times(1)).save(any(Order.class));
    }

    @Test
    @DisplayName("ORDER TEST: Order placement is REJECTED with BadRequestException when restaurant is CLOSED")
    void testPlaceOrderRejectedWhenRestaurantClosed() {
        CartDto cart = CartDto.builder()
                .userEmail(customerEmail)
                .restaurantId(restaurantId)
                .items(new ArrayList<>(List.of(
                        CartItem.builder().menuItemId("m1").name("Burger").quantity(1).price(150.0).build()
                )))
                .build();

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + customerEmail)).thenReturn(cart);
        when(restaurantServiceClient.isRestaurantOpen(restaurantId)).thenReturn(false);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> orderService.placeOrder(customerEmail));

        assertEquals("Restaurant is currently closed for orders.", ex.getMessage());
        verify(restaurantServiceClient, times(1)).isRestaurantOpen(restaurantId);
        verify(orderRepository, never()).save(any(Order.class));
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }
}
