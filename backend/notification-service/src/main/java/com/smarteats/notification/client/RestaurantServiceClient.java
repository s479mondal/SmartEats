package com.smarteats.notification.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class RestaurantServiceClient {

    private final RestTemplate restTemplate;
    private final String restaurantServiceUrl;
    private final ObjectMapper objectMapper;
    private final Map<String, String> ownerEmailCache = new ConcurrentHashMap<>();

    public RestaurantServiceClient(
            @Value("${services.restaurant-service.url:http://localhost:8082}") String restaurantServiceUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(4000);
        factory.setReadTimeout(4000);
        this.restTemplate = new RestTemplate(factory);
        this.restaurantServiceUrl = restaurantServiceUrl;
        this.objectMapper = new ObjectMapper();
    }

    public String getRestaurantOwnerEmail(String restaurantId) {
        if (restaurantId == null || restaurantId.isBlank()) {
            return null;
        }

        String cached = ownerEmailCache.get(restaurantId.trim());
        if (cached != null) {
            return cached;
        }

        try {
            String url = restaurantServiceUrl + "/api/restaurants/" + restaurantId.trim();
            ResponseEntity<String> response = restTemplate.getForEntity(URI.create(url), String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode dataNode = root.has("data") ? root.get("data") : root;
                if (dataNode != null && dataNode.has("ownerEmail") && !dataNode.get("ownerEmail").isNull()) {
                    String ownerEmail = dataNode.get("ownerEmail").asText();
                    ownerEmailCache.put(restaurantId.trim(), ownerEmail);
                    return ownerEmail;
                }
            }
        } catch (Exception e) {
            log.warn("Could not retrieve owner email for restaurant ID {}: {}", restaurantId, e.getMessage());
        }

        return null;
    }
}
