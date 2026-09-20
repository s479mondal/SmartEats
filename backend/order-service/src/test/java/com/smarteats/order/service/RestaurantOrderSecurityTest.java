package com.smarteats.order.service;

import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.order.client.AuthServiceClient;
import com.smarteats.order.client.RazorpayClientWrapper;
import com.smarteats.order.client.RestaurantCoordinates;
import com.smarteats.order.client.RestaurantServiceClient;
import com.smarteats.order.controller.OrderController;
import com.smarteats.order.dto.OrderResponse;
import com.smarteats.order.entity.Order;
import com.smarteats.order.entity.OrderStatus;
import com.smarteats.order.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RestaurantOrderSecurityTest {

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

    @InjectMocks
    private OrderServiceImpl orderService;

    private OrderController orderController;

    private Order orderA1;
    private Order orderA2;
    private Order orderB1;

    private final String OWNER_A_EMAIL = "ownerA@restaurant.com";
    private final String OWNER_B_EMAIL = "ownerB@restaurant.com";
    private final String CUSTOMER_EMAIL = "customer@smarteats.com";
    private final String REST_A_ID = "rest-A";
    private final String REST_B_ID = "rest-B";

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(orderService, "orderCreatedTopic", "smarteats.order.created");
        ReflectionTestUtils.setField(orderService, "orderAcceptedTopic", "smarteats.order.accepted");
        ReflectionTestUtils.setField(orderService, "orderReadyTopic", "smarteats.order.ready");

        orderController = new OrderController(orderService, redisTemplate, kafkaTemplate);

        orderA1 = Order.builder()
                .id("ORD-A1")
                .restaurantId(REST_A_ID)
                .customerEmail(CUSTOMER_EMAIL)
                .status(OrderStatus.CREATED)
                .deliveryLatitude(12.9716)
                .deliveryLongitude(77.5946)
                .build();

        orderA2 = Order.builder()
                .id("ORD-A2")
                .restaurantId(REST_A_ID)
                .customerEmail(CUSTOMER_EMAIL)
                .status(OrderStatus.ACCEPTED)
                .build();

        orderB1 = Order.builder()
                .id("ORD-B1")
                .restaurantId(REST_B_ID)
                .customerEmail("customerB@smarteats.com")
                .status(OrderStatus.CREATED)
                .deliveryLatitude(12.9716)
                .deliveryLongitude(77.5946)
                .build();
    }

    @Test
    @DisplayName("Test 1: Restaurant A requests its orders -> Only Restaurant A orders returned")
    void test1_RestaurantA_Requests_Its_Orders() {
        when(restaurantServiceClient.getRestaurantIdByOwnerEmail(OWNER_A_EMAIL)).thenReturn(REST_A_ID);
        when(orderRepository.findByRestaurantId(REST_A_ID)).thenReturn(List.of(orderA1, orderA2));

        List<OrderResponse> results = orderService.getMyRestaurantOrders(OWNER_A_EMAIL);

        assertEquals(2, results.size());
        assertTrue(results.stream().allMatch(o -> o.getRestaurantId().equals(REST_A_ID)));
        verify(orderRepository, times(1)).findByRestaurantId(REST_A_ID);
        verify(orderRepository, never()).findAll();
    }

    @Test
    @DisplayName("Test 2: Restaurant B requests its orders -> Only Restaurant B orders returned")
    void test2_RestaurantB_Requests_Its_Orders() {
        when(restaurantServiceClient.getRestaurantIdByOwnerEmail(OWNER_B_EMAIL)).thenReturn(REST_B_ID);
        when(orderRepository.findByRestaurantId(REST_B_ID)).thenReturn(List.of(orderB1));

        List<OrderResponse> results = orderService.getMyRestaurantOrders(OWNER_B_EMAIL);

        assertEquals(1, results.size());
        assertEquals(REST_B_ID, results.get(0).getRestaurantId());
        verify(orderRepository, times(1)).findByRestaurantId(REST_B_ID);
        verify(orderRepository, never()).findAll();
    }

    @Test
    @DisplayName("Test 3: Restaurant A attempts to access Restaurant B's order by ID -> 403 Forbidden")
    void test3_RestaurantA_Attempts_Access_RestaurantB_Order_Forbidden() {
        when(orderRepository.findById("ORD-B1")).thenReturn(Optional.of(orderB1));
        when(restaurantServiceClient.isOwnerOfRestaurant(OWNER_A_EMAIL, REST_B_ID)).thenReturn(false);

        assertThrows(ForbiddenException.class, () ->
                orderService.getMyRestaurantOrderById("ORD-B1", OWNER_A_EMAIL));

        assertThrows(ForbiddenException.class, () ->
                orderService.getOrderById("ORD-B1", OWNER_A_EMAIL, "RESTAURANT_OWNER"));
    }

    @Test
    @DisplayName("Test 4: Restaurant B attempts to access Restaurant A's order -> 403 Forbidden")
    void test4_RestaurantB_Attempts_Access_RestaurantA_Order_Forbidden() {
        when(orderRepository.findById("ORD-A1")).thenReturn(Optional.of(orderA1));
        when(restaurantServiceClient.isOwnerOfRestaurant(OWNER_B_EMAIL, REST_A_ID)).thenReturn(false);

        assertThrows(ForbiddenException.class, () ->
                orderService.getMyRestaurantOrderById("ORD-A1", OWNER_B_EMAIL));

        assertThrows(ForbiddenException.class, () ->
                orderService.getOrderById("ORD-A1", OWNER_B_EMAIL, "RESTAURANT_OWNER"));
    }

    @Test
    @DisplayName("Test 5: Unauthenticated user attempts restaurant order-management API -> 401 Unauthorized")
    void test5_UnauthenticatedUser_Attempts_RestaurantAPI_Unauthorized() {
        assertThrows(UnauthorizedException.class, () ->
                orderController.getMyRestaurantOrders(null, "RESTAURANT_OWNER"));

        assertThrows(UnauthorizedException.class, () ->
                orderController.getMyRestaurantOrders("", "RESTAURANT_OWNER"));

        assertThrows(UnauthorizedException.class, () ->
                orderController.acceptOrder("ORD-A1", null, "RESTAURANT_OWNER"));
    }

    @Test
    @DisplayName("Test 6: Customer attempts restaurant-owner order-management endpoint -> 403 Forbidden")
    void test6_Customer_Attempts_RestaurantOwner_Endpoint_Forbidden() {
        assertThrows(ForbiddenException.class, () ->
                orderController.getMyRestaurantOrders(CUSTOMER_EMAIL, "CUSTOMER"));

        assertThrows(ForbiddenException.class, () ->
                orderController.acceptOrder("ORD-A1", CUSTOMER_EMAIL, "CUSTOMER"));
    }

    @Test
    @DisplayName("Test 7: Restaurant A attempts ACCEPT/REJECT/PREPARING/READY on Restaurant B's order -> 403 Forbidden & NO modification")
    void test7_RestaurantA_Attempts_Operation_On_RestaurantB_Order_Forbidden() {
        when(orderRepository.findById("ORD-B1")).thenReturn(Optional.of(orderB1));
        when(restaurantServiceClient.isOwnerOfRestaurant(OWNER_A_EMAIL, REST_B_ID)).thenReturn(false);

        assertThrows(ForbiddenException.class, () ->
                orderService.acceptOrder("ORD-B1", OWNER_A_EMAIL));

        assertThrows(ForbiddenException.class, () ->
                orderService.rejectOrder("ORD-B1", OWNER_A_EMAIL));

        orderB1.setStatus(OrderStatus.ACCEPTED);
        assertThrows(ForbiddenException.class, () ->
                orderService.preparingOrder("ORD-B1", OWNER_A_EMAIL));

        orderB1.setStatus(OrderStatus.PREPARING);
        assertThrows(ForbiddenException.class, () ->
                orderService.readyOrder("ORD-B1", OWNER_A_EMAIL));

        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    @DisplayName("Test 8: Restaurant A can still normally manage its own order -> Succeeds")
    void test8_RestaurantA_Manages_Its_Own_Order_Succeeds() {
        when(orderRepository.findById("ORD-A1")).thenReturn(Optional.of(orderA1));
        when(restaurantServiceClient.isOwnerOfRestaurant(OWNER_A_EMAIL, REST_A_ID)).thenReturn(true);
        when(restaurantServiceClient.getRestaurantCoordinates(REST_A_ID))
                .thenReturn(new RestaurantCoordinates(12.9716, 77.5946));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderResponse response = orderService.acceptOrder("ORD-A1", OWNER_A_EMAIL);

        assertNotNull(response);
        assertEquals(OrderStatus.ACCEPTED, response.getStatus());
        verify(orderRepository, times(1)).save(orderA1);
    }
}
