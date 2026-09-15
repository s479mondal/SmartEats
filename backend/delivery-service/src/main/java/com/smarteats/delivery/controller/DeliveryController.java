package com.smarteats.delivery.controller;

import com.smarteats.common.dto.ApiResponse;
import com.smarteats.common.exception.ForbiddenException;
import com.smarteats.common.exception.UnauthorizedException;
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

    @PutMapping("/partner/availability")
    public ResponseEntity<ApiResponse<DeliveryPartnerResponse>> updateAvailability(
            @RequestParam boolean active,
            @RequestParam boolean available,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "DELIVERY_PARTNER");
        DeliveryPartnerResponse response = deliveryService.updatePartnerAvailability(email, active, available);
        return ResponseEntity.ok(ApiResponse.success(response, "Availability status updated"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DeliveryResponse>> getDeliveryById(@PathVariable String id) {
        DeliveryResponse response = deliveryService.getDeliveryById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/my-deliveries")
    public ResponseEntity<ApiResponse<List<DeliveryResponse>>> getMyDeliveries(
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "DELIVERY_PARTNER");
        List<DeliveryResponse> list = deliveryService.getPartnerDeliveries(email);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PutMapping("/{id}/accept")
    public ResponseEntity<ApiResponse<DeliveryResponse>> accept(
            @PathVariable String id,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "DELIVERY_PARTNER");
        DeliveryResponse response = deliveryService.acceptDelivery(id, email);
        return ResponseEntity.ok(ApiResponse.success(response, "Delivery accepted successfully"));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<DeliveryResponse>> updateStatus(
            @PathVariable String id,
            @RequestParam String status,
            @RequestHeader("X-User-Email") String email,
            @RequestHeader("X-User-Roles") String roles) {
        
        checkRole(roles, "DELIVERY_PARTNER");
        DeliveryResponse response = deliveryService.updateDeliveryStatus(id, status, email);
        return ResponseEntity.ok(ApiResponse.success(response, "Delivery status updated successfully"));
    }

    // Role verification helper
    private void checkRole(String rolesHeader, String requiredRole) {
        if (rolesHeader == null || (!rolesHeader.contains(requiredRole) && !rolesHeader.contains("ADMIN"))) {
            throw new ForbiddenException("Access Denied: You do not possess the required privilege " + requiredRole);
        }
    }
}
