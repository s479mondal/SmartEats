package com.smarteats.order.service;

import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.order.client.DeliveryServiceClient;
import com.smarteats.order.client.RestaurantServiceClient;
import com.smarteats.order.controller.OrderController;
import com.smarteats.order.dto.OrderResponse;
import com.smarteats.order.entity.Order;
import com.smarteats.order.entity.OrderStatus;
import com.smarteats.common.enums.PaymentStatus;
import com.smarteats.order.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerOrderSecurityTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private RestaurantServiceClient restaurantServiceClient;

    @Mock
    private DeliveryServiceClient deliveryServiceClient;

    private OrderServiceImpl orderService;
    private OrderController orderController;

    private Order orderA;
    private Order orderB;

    private final String custA = "custA@smarteats.com";
    private final String custB = "custB@smarteats.com";
    private final String restOwner = "rest_owner@smarteats.com";
    private final String driverX = "driverX@smarteats.com";

    @BeforeEach
    void setUp() {
        orderService = new OrderServiceImpl(
                orderRepository,
                null,
                null,
                null,
                restaurantServiceClient,
                null,
                deliveryServiceClient
        );
        orderController = new OrderController(orderService, null, null);

        orderA = Order.builder()
                .id("order-101")
                .customerEmail(custA)
                .restaurantId("rest_101")
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PAID)
                .totalAmount(500.0)
                .createdAt(LocalDateTime.now())
                .build();

        orderB = Order.builder()
                .id("order-102")
                .customerEmail(custB)
                .restaurantId("rest_101")
                .status(OrderStatus.CREATED)
                .paymentStatus(PaymentStatus.PAID)
                .totalAmount(750.0)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("TEST 1: Customer A requests own order list -> Only Customer A's orders")
    void testCustomerA_RequestsOwnOrders() {
        when(orderRepository.findByCustomerEmail(custA)).thenReturn(List.of(orderA));

        ResponseEntity<?> response = orderController.getCustomerOrders(custA, "CUSTOMER");
        assertEquals(HttpStatus.OK, response.getStatusCode());

        verify(orderRepository, times(1)).findByCustomerEmail(custA);
        verify(orderRepository, never()).findAll();
    }

    @Test
    @DisplayName("TEST 2: Customer B requests own order list -> Only Customer B's orders")
    void testCustomerB_RequestsOwnOrders() {
        when(orderRepository.findByCustomerEmail(custB)).thenReturn(List.of(orderB));

        ResponseEntity<?> response = orderController.getCustomerOrders(custB, "CUSTOMER");
        assertEquals(HttpStatus.OK, response.getStatusCode());

        verify(orderRepository, times(1)).findByCustomerEmail(custB);
        verify(orderRepository, never()).findAll();
    }

    @Test
    @DisplayName("TEST 3: Customer A requests Customer B's order by ID -> 403 Forbidden")
    void testCustomerA_RequestsCustomerB_OrderById() {
        when(orderRepository.findById("order-102")).thenReturn(Optional.of(orderB));

        assertThrows(ForbiddenException.class, () -> {
            orderController.getOrderById("order-102", custA, "CUSTOMER");
        });
    }

    @Test
    @DisplayName("TEST 4: Customer B requests Customer A's order by ID -> 403 Forbidden")
    void testCustomerB_RequestsCustomerA_OrderById() {
        when(orderRepository.findById("order-101")).thenReturn(Optional.of(orderA));

        assertThrows(ForbiddenException.class, () -> {
            orderController.getOrderById("order-101", custB, "CUSTOMER");
        });
    }

    @Test
    @DisplayName("TEST 5: Customer A attempts to cancel Customer B's order -> 403 Forbidden")
    void testCustomerA_AttemptsToCancelCustomerB_Order() {
        when(orderRepository.findById("order-102")).thenReturn(Optional.of(orderB));
        when(restaurantServiceClient.isOwnerOfRestaurant(custA, "rest_101")).thenReturn(false);

        assertThrows(ForbiddenException.class, () -> {
            orderController.updateStatus("order-102", "CANCELLED", custA, "CUSTOMER");
        });

        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("TEST 6: Unauthenticated customer order request -> 401 Unauthorized")
    void testUnauthenticated_CustomerOrderRequest() {
        assertThrows(UnauthorizedException.class, () -> {
            orderController.getCustomerOrders(null, "CUSTOMER");
        });

        assertThrows(UnauthorizedException.class, () -> {
            orderController.getOrderById("order-101", "", "CUSTOMER");
        });
    }

    @Test
    @DisplayName("TEST 7: Restaurant owner attempts customer-only endpoint -> 403 Forbidden")
    void testRestaurantOwner_AttemptsCustomerEndpoint() {
        assertThrows(ForbiddenException.class, () -> {
            orderController.getCustomerOrders(restOwner, "RESTAURANT_OWNER");
        });
    }

    @Test
    @DisplayName("TEST 8: Delivery partner attempts unrelated customer order -> 403 Forbidden")
    void testDeliveryPartner_AttemptsUnrelatedCustomerOrder() {
        when(orderRepository.findById("order-101")).thenReturn(Optional.of(orderA));
        when(deliveryServiceClient.isDriverAssignedToOrder(driverX, "order-101")).thenReturn(false);

        assertThrows(ForbiddenException.class, () -> {
            orderController.getOrderById("order-101", driverX, "DELIVERY_PARTNER");
        });
    }

    @Test
    @DisplayName("TEST 9: Customer A can normally access and view their own order -> 200 OK")
    void testCustomerA_AccessesOwnOrder_Success() {
        when(orderRepository.findById("order-101")).thenReturn(Optional.of(orderA));

        ResponseEntity<?> response = orderController.getOrderById("order-101", custA, "CUSTOMER");
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    @DisplayName("TEST 10: Customer A can cancel their own pending/created order -> 200 OK")
    void testCustomerA_CancelsOwnCreatedOrder_Success() {
        when(orderRepository.findById("order-101")).thenReturn(Optional.of(orderA));
        when(restaurantServiceClient.isOwnerOfRestaurant(custA, "rest_101")).thenReturn(false);
        when(orderRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseEntity<?> response = orderController.updateStatus("order-101", "CANCELLED", custA, "CUSTOMER");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(OrderStatus.CANCELLED, orderA.getStatus());
    }
}
