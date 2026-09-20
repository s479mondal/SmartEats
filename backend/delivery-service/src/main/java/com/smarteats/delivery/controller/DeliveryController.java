package com.smarteats.delivery.controller;

import com.smarteats.common.dto.ApiResponse;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.UnauthorizedException;
import com.smarteats.delivery.dto.DeliveryLocationUpdateRequest;
import com.smarteats.delivery.dto.DeliveryPartnerRegisterRequest;
import com.smarteats.delivery.dto.DeliveryPartnerResponse;
import com.smarteats.delivery.dto.DeliveryResponse;
import com.smarteats.delivery.service.DeliveryService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/deliveries")
public class DeliveryController {

    private final DeliveryService deliveryService;

    // Constructor injection
    public DeliveryController(DeliveryService deliveryService) {
        this.deliveryService = deliveryService;
    }

    @PostMapping("/partner/register")
    public ResponseEntity<ApiResponse<DeliveryPartnerResponse>> registerPartner(
            @Valid @RequestBody DeliveryPartnerRegisterRequest request) {
        log.info("Registering new delivery partner: {}", request.getEmail());
        DeliveryPartnerResponse response = deliveryService.registerPartner(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Delivery partner registered successfully"));
    }

    @PostMapping("/partner/location")
    public ResponseEntity<ApiResponse<DeliveryPartnerResponse>> updateLocation(
            @Valid @RequestBody DeliveryLocationUpdateRequest request,
            @RequestHeader(value = "X-User-Email", required = false) String email,
            @RequestHeader(value = "X-User-Roles", required = false) String roles) {
        
        checkAuthAndRole(email, roles, "DELIVERY_PARTNER");
        DeliveryPartnerResponse response = deliveryService.updatePartnerLocation(
                email, request.getLatitude(), request.getLongitude(), request.getAccuracy());
        return ResponseEntity.ok(ApiResponse.success(response, "Live location updated successfully"));
    }

    @PutMapping("/partner/availability")
    public ResponseEntity<ApiResponse<DeliveryPartnerResponse>> updateAvailability(
            @RequestParam boolean active,
            @RequestParam boolean available,
            @RequestHeader(value = "X-User-Email", required = false) String email,
            @RequestHeader(value = "X-User-Roles", required = false) String roles) {
        
        checkAuthAndRole(email, roles, "DELIVERY_PARTNER");
        DeliveryPartnerResponse response = deliveryService.updatePartnerAvailability(email, active, available);
        return ResponseEntity.ok(ApiResponse.success(response, "Availability status updated"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DeliveryResponse>> getDeliveryById(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Email", required = false) String email,
            @RequestHeader(value = "X-User-Roles", required = false) String roles) {
        if (email == null || email.isBlank()) {
            throw new UnauthorizedException("Authentication required: Missing user identity");
        }
        DeliveryResponse response = deliveryService.getDeliveryById(id, email, roles);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<ApiResponse<DeliveryResponse>> getDeliveryByOrderId(
            @PathVariable String orderId,
            @RequestHeader(value = "X-User-Email", required = false) String email,
            @RequestHeader(value = "X-User-Roles", required = false) String roles) {
        if (email == null || email.isBlank()) {
            throw new UnauthorizedException("Authentication required: Missing user identity");
        }
        DeliveryResponse response = deliveryService.getDeliveryByOrderId(orderId, email, roles);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/my-deliveries")
    public ResponseEntity<ApiResponse<List<DeliveryResponse>>> getMyDeliveries(
            @RequestHeader(value = "X-User-Email", required = false) String email,
            @RequestHeader(value = "X-User-Roles", required = false) String roles) {
        
        checkAuthAndRole(email, roles, "DELIVERY_PARTNER");
        List<DeliveryResponse> list = deliveryService.getPartnerDeliveries(email);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PutMapping("/{id}/accept")
    public ResponseEntity<ApiResponse<DeliveryResponse>> accept(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Email", required = false) String email,
            @RequestHeader(value = "X-User-Roles", required = false) String roles) {
        
        checkAuthAndRole(email, roles, "DELIVERY_PARTNER");
        DeliveryResponse response = deliveryService.acceptDelivery(id, email);
        return ResponseEntity.ok(ApiResponse.success(response, "Delivery accepted successfully"));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<DeliveryResponse>> updateStatus(
            @PathVariable String id,
            @RequestParam String status,
            @RequestHeader(value = "X-User-Email", required = false) String email,
            @RequestHeader(value = "X-User-Roles", required = false) String roles) {
        
        checkAuthAndRole(email, roles, "DELIVERY_PARTNER");
        DeliveryResponse response = deliveryService.updateDeliveryStatus(id, status, email);
        return ResponseEntity.ok(ApiResponse.success(response, "Delivery status updated successfully"));
    }

    private void checkAuthAndRole(String email, String rolesHeader, String requiredRole) {
        if (email == null || email.isBlank()) {
            throw new UnauthorizedException("Authentication required: Missing user identity");
        }
        if (rolesHeader == null || (!rolesHeader.contains(requiredRole) && !rolesHeader.contains("ADMIN"))) {
            throw new ForbiddenException("Access Denied: You do not possess the required privilege " + requiredRole);
        }
    }

    private void checkRole(String rolesHeader, String requiredRole) {
        checkAuthAndRole("placeholder@smarteats.com", rolesHeader, requiredRole);
    }
}
