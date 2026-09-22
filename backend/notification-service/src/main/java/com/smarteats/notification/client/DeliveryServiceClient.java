package com.smarteats.notification.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
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

    /**
     * Retrieve the assigned delivery partner email for a given orderId from Delivery Service.
     * Returns null if no delivery exists or no driver is currently assigned.
     */
    public String getAssignedDriverEmail(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            return null;
        }

        try {
            String url = deliveryServiceUrl + "/api/deliveries/order/" + orderId.trim();
            log.info("Fetching delivery details for order ID '{}' from Delivery Service: {}", orderId, url);

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Email", "system@smarteats.com");
            headers.set("X-User-Roles", "ROLE_ADMIN,ADMIN");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    URI.create(url),
                    HttpMethod.GET,
                    entity,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode dataNode = root.has("data") ? root.get("data") : root;
                if (dataNode != null && dataNode.has("deliveryPartnerEmail") && !dataNode.get("deliveryPartnerEmail").isNull()) {
                    String assignedEmail = dataNode.get("deliveryPartnerEmail").asText();
                    if (!assignedEmail.isBlank()) {
                        return assignedEmail.trim();
                    }
                }
            }
        } catch (org.springframework.web.client.HttpClientErrorException.NotFound e) {
            log.info("No delivery record found in Delivery Service for order ID: {}", orderId);
        } catch (Exception e) {
            log.warn("Failed to retrieve delivery information for order ID '{}': {}", orderId, e.getMessage());
        }

        return null;
    }
}
