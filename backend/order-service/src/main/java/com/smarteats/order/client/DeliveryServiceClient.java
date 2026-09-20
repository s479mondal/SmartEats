package com.smarteats.order.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URI;

@Slf4j
@Component
public class DeliveryServiceClient {

    private final RestTemplate restTemplate;
    private final String deliveryServiceUrl;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Autowired
    public DeliveryServiceClient(
            @Value("${services.delivery-service.url:http://localhost:8084}") String deliveryServiceUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
        this.deliveryServiceUrl = deliveryServiceUrl;
        this.objectMapper = new ObjectMapper();
    }

    public DeliveryServiceClient(RestTemplate restTemplate, String deliveryServiceUrl) {
        this.restTemplate = restTemplate;
        this.deliveryServiceUrl = deliveryServiceUrl;
        this.objectMapper = new ObjectMapper();
    }

    public boolean isDriverAssignedToOrder(String driverEmail, String orderId) {
        if (driverEmail == null || driverEmail.isBlank() || orderId == null || orderId.isBlank()) {
            return false;
        }

        try {
            String url = deliveryServiceUrl + "/api/deliveries/order/" + orderId.trim();
            log.info("Verifying driver assignment for driver '{}' and order ID '{}': {}", driverEmail, orderId, url);

            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-User-Email", driverEmail.trim());
            headers.set("X-User-Roles", "DELIVERY_PARTNER");
            org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    URI.create(url),
                    org.springframework.http.HttpMethod.GET,
                    entity,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode dataNode = root.has("data") ? root.get("data") : root;
                if (dataNode != null && dataNode.has("deliveryPartnerEmail")) {
                    String assignedEmail = dataNode.get("deliveryPartnerEmail").asText();
                    return driverEmail.trim().equalsIgnoreCase(assignedEmail);
                }
            }
        } catch (Exception e) {
            log.warn("Error verifying driver assignment with Delivery Service for order {}: {}", orderId, e.getMessage());
        }

        return false;
    }
}
