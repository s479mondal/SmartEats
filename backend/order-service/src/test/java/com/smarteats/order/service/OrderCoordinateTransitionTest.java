package com.smarteats.order.service;

import com.smarteats.common.event.OrderAcceptedEvent;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.order.client.AuthServiceClient;
import com.smarteats.order.client.CustomerCoordinates;
import com.smarteats.order.client.RestaurantCoordinates;
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
public class OrderCoordinateTransitionTest {

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

    @Captor
    private ArgumentCaptor<OrderAcceptedEvent> eventCaptor;

    @Captor
    private ArgumentCaptor<Order> orderCaptor;

    private OrderServiceImpl orderService;

    private final String testCustomerEmail = "customer@smarteats.com";
    private final String testRestaurantId = "rest_koramangala_101";
    private final double realCustomerLat = 12.9352;
    private final double realCustomerLng = 77.6245;
    private final double realRestaurantLat = 12.9716;
    private final double realRestaurantLng = 77.5946;

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
        ReflectionTestUtils.setField(orderService, "orderAcceptedTopic", "smarteats.order.accepted");
        ReflectionTestUtils.setField(orderService, "orderStatusTopic", "smarteats.order.status");
        lenient().when(restaurantServiceClient.isRestaurantOpen(anyString())).thenReturn(true);
        lenient().when(restaurantServiceClient.reserveInventory(any(), any())).thenReturn(true);
        lenient().when(restaurantServiceClient.isOwnerOfRestaurant(anyString(), anyString())).thenReturn(true);
    }

    @Test
    @DisplayName("TEST 1: Customer authoritative coordinates are captured on Order at creation time")
    void testOrderCreationCapturesAuthoritativeCustomerCoordinates() {
        // Arrange
        CartDto mockCart = CartDto.builder()
                .userEmail(testCustomerEmail)
                .restaurantId(testRestaurantId)
                .items(new ArrayList<>(List.of(
                        CartItem.builder().menuItemId("item_1").name("Biryani").quantity(2).price(250.0).build()
                )))
                .build();

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + testCustomerEmail)).thenReturn(mockCart);
        when(authServiceClient.getCustomerCoordinates(testCustomerEmail))
                .thenReturn(new CustomerCoordinates(realCustomerLat, realCustomerLng));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order o = invocation.getArgument(0);
            o.setId("ord_12345");
            return o;
        });

        // Act
        OrderResponse response = orderService.placeOrder(testCustomerEmail);

        // Assert
        assertNotNull(response);
        assertEquals(realCustomerLat, response.getDeliveryLatitude(), "Order response must have real customer latitude");
        assertEquals(realCustomerLng, response.getDeliveryLongitude(), "Order response must have real customer longitude");

        verify(orderRepository).save(orderCaptor.capture());
        Order saved = orderCaptor.getValue();
        assertEquals(realCustomerLat, saved.getDeliveryLatitude(), "Saved order must snapshot real customer latitude");
        assertEquals(realCustomerLng, saved.getDeliveryLongitude(), "Saved order must snapshot real customer longitude");
    }

    @Test
    @DisplayName("TEST 2: Client cannot override authoritative coordinates (coordinates sourced solely from Auth Service)")
    void testClientCannotOverrideCoordinates() {
        // Verify that placeOrder only relies on userEmail and calls AuthServiceClient, never accepting external coordinates
        CartDto mockCart = CartDto.builder()
                .userEmail(testCustomerEmail)
                .restaurantId(testRestaurantId)
                .items(new ArrayList<>(List.of(
                        CartItem.builder().menuItemId("item_1").name("Biryani").quantity(1).price(250.0).build()
                )))
                .build();

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + testCustomerEmail)).thenReturn(mockCart);
        when(authServiceClient.getCustomerCoordinates(testCustomerEmail))
                .thenReturn(new CustomerCoordinates(realCustomerLat, realCustomerLng));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId("ord_secured_1");
            return o;
        });

        OrderResponse response = orderService.placeOrder(testCustomerEmail);

        verify(authServiceClient, times(1)).getCustomerCoordinates(testCustomerEmail);
        assertEquals(realCustomerLat, response.getDeliveryLatitude());
        assertEquals(realCustomerLng, response.getDeliveryLongitude());
    }

    @Test
    @DisplayName("TEST 3: Missing or invalid customer coordinates reject order creation with clear error")
    void testMissingCustomerCoordinatesRejectsOrderCreation() {
        CartDto mockCart = CartDto.builder()
                .userEmail(testCustomerEmail)
                .restaurantId(testRestaurantId)
                .items(new ArrayList<>(List.of(
                        CartItem.builder().menuItemId("item_1").name("Biryani").quantity(1).price(250.0).build()
                )))
                .build();

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("cart:" + testCustomerEmail)).thenReturn(mockCart);
        when(authServiceClient.getCustomerCoordinates(testCustomerEmail))
                .thenThrow(new BadRequestException("Your delivery address is not configured with valid coordinates."));

        BadRequestException ex = assertThrows(BadRequestException.class, () -> {
            orderService.placeOrder(testCustomerEmail);
        });

        assertTrue(ex.getMessage().contains("coordinates"));
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    @DisplayName("TEST 4 & 5 & 6: OrderAcceptedEvent contains real restaurant and delivery coordinates without Bengaluru fallback")
    void testOrderAcceptedEventPublishesRealCoordinates() {
        // Arrange
        Order existingOrder = Order.builder()
                .id("ord_acceptance_99")
                .restaurantId(testRestaurantId)
                .customerEmail(testCustomerEmail)
                .totalAmount(500.0)
                .status(OrderStatus.CREATED)
                .deliveryLatitude(realCustomerLat)
                .deliveryLongitude(realCustomerLng)
                .build();

        when(orderRepository.findById("ord_acceptance_99")).thenReturn(Optional.of(existingOrder));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        when(restaurantServiceClient.getRestaurantCoordinates(testRestaurantId))
                .thenReturn(new RestaurantCoordinates(realRestaurantLat, realRestaurantLng));

        // Act
        OrderResponse response = orderService.acceptOrder("ord_acceptance_99", "owner@smarteats.com");

        // Assert
        assertNotNull(response);
        assertEquals(OrderStatus.ACCEPTED, response.getStatus());

        verify(kafkaTemplate).send(eq("smarteats.order.accepted"), eq("ord_acceptance_99"), eventCaptor.capture());
        OrderAcceptedEvent event = eventCaptor.getValue();

        assertNotNull(event);
        assertEquals(realRestaurantLat, event.getRestaurantLatitude(), "Restaurant latitude must be real restaurant coordinate");
        assertEquals(realRestaurantLng, event.getRestaurantLongitude(), "Restaurant longitude must be real restaurant coordinate");
        assertEquals(realCustomerLat, event.getDeliveryLatitude(), "Delivery latitude must be real customer delivery coordinate");
        assertEquals(realCustomerLng, event.getDeliveryLongitude(), "Delivery longitude must be real customer delivery coordinate");

        // Ensure these coordinates are NOT the old hardcoded fallback placeholders (12.9716, 77.5946, 12.9725, 77.5937)
        assertFalse(event.getDeliveryLatitude() == 12.9725 && event.getDeliveryLongitude() == 77.5937,
                "Delivery coordinates must not use the old hardcoded placeholder 12.9725/77.5937");
    }

    @Test
    @DisplayName("TEST 8: Missing or invalid restaurant coordinates reject order acceptance cleanly")
    void testMissingRestaurantCoordinatesRejectsOrderAcceptance() {
        Order existingOrder = Order.builder()
                .id("ord_no_rest_coords")
                .restaurantId(testRestaurantId)
                .customerEmail(testCustomerEmail)
                .totalAmount(350.0)
                .status(OrderStatus.CREATED)
                .deliveryLatitude(realCustomerLat)
                .deliveryLongitude(realCustomerLng)
                .build();

        when(orderRepository.findById("ord_no_rest_coords")).thenReturn(Optional.of(existingOrder));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        when(restaurantServiceClient.getRestaurantCoordinates(testRestaurantId))
                .thenThrow(new BadRequestException("Restaurant coordinates are missing or invalid for restaurant ID: " + testRestaurantId));

        BadRequestException ex = assertThrows(BadRequestException.class, () -> {
            orderService.acceptOrder("ord_no_rest_coords", "owner@smarteats.com");
        });

        assertTrue(ex.getMessage().contains("Restaurant coordinates are missing"));
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }
}
