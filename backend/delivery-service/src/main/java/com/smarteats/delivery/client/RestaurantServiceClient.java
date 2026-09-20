package com.smarteats.delivery.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarteats.common.exception.ResourceNotFoundException;
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

    // Lightweight in-memory cache for restaurant details (id -> RestaurantDetails)
    private final Map<String, CacheEntry<RestaurantDetails>> restaurantCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 60_000; // 1 minute TTL

    private static class CacheEntry<T> {
        final T value;
        final long expiry;

        CacheEntry(T value, long ttlMs) {
            this.value = value;
            this.expiry = System.currentTimeMillis() + ttlMs;
        }

        boolean isExpired() {
            return System.currentTimeMillis() > expiry;
        }
    }

    @org.springframework.beans.factory.annotation.Autowired
    public RestaurantServiceClient(
            @Value("${services.restaurant-service.url:http://localhost:8082}") String restaurantServiceUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
        this.restaurantServiceUrl = restaurantServiceUrl;
        this.objectMapper = new ObjectMapper();
    }

    public RestaurantServiceClient(RestTemplate restTemplate, String restaurantServiceUrl) {
        this.restTemplate = restTemplate;
        this.restaurantServiceUrl = restaurantServiceUrl;
        this.objectMapper = new ObjectMapper();
    }

    public RestaurantDetails getRestaurantDetails(String restaurantId) {
        if (restaurantId == null || restaurantId.trim().isEmpty()) {
            return null;
        }

        String key = restaurantId.trim();
        CacheEntry<RestaurantDetails> cached = restaurantCache.get(key);
        if (cached != null && !cached.isExpired()) {
            return cached.value;
        }

        try {
            String url = restaurantServiceUrl + "/api/restaurants/" + key;
            log.info("Fetching restaurant details from Restaurant Service: {}", url);
            ResponseEntity<String> response = restTemplate.getForEntity(URI.create(url), String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode dataNode = root.has("data") ? root.get("data") : root;

                if (dataNode != null && !dataNode.isNull() && !dataNode.isEmpty()) {
                    String name = dataNode.has("name") && !dataNode.get("name").isNull() ? dataNode.get("name").asText() : null;
                    String phone = dataNode.has("phone") && !dataNode.get("phone").isNull() ? dataNode.get("phone").asText() : null;
                    String address = dataNode.has("address") && !dataNode.get("address").isNull() ? dataNode.get("address").asText() : null;
                    String city = dataNode.has("city") && !dataNode.get("city").isNull() ? dataNode.get("city").asText() : null;
                    Double lat = dataNode.has("latitude") && !dataNode.get("latitude").isNull() ? dataNode.get("latitude").asDouble() : null;
                    Double lng = dataNode.has("longitude") && !dataNode.get("longitude").isNull() ? dataNode.get("longitude").asDouble() : null;

                    RestaurantDetails details = RestaurantDetails.builder()
                            .id(key)
                            .name(name)
                            .phone(phone)
                            .address(address)
                            .city(city)
                            .latitude(lat)
                            .longitude(lng)
                            .build();

                    restaurantCache.put(key, new CacheEntry<>(details, CACHE_TTL_MS));
                    return details;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch restaurant details for ID {} from Restaurant Service: {}", key, e.getMessage());
        }

        return null;
    }

    public boolean isOwnerOfRestaurant(String ownerEmail, String restaurantId) {
        if (ownerEmail == null || ownerEmail.trim().isEmpty() || restaurantId == null || restaurantId.trim().isEmpty()) {
            return false;
        }

        try {
            String url = restaurantServiceUrl + "/api/restaurants/my-restaurants";
            log.info("Verifying restaurant ownership with Restaurant Service for owner: {} and restaurant: {}", ownerEmail, restaurantId);

            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-User-Email", ownerEmail.trim());
            headers.set("X-User-Roles", "RESTAURANT_OWNER");
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
                if (dataNode != null && dataNode.isArray()) {
                    for (JsonNode restNode : dataNode) {
                        if (restNode.has("id") && restaurantId.trim().equalsIgnoreCase(restNode.get("id").asText())) {
                            return true;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Error querying my-restaurants list for owner email {}: {}", ownerEmail, e.getMessage());
        }

        // Fallback to /api/restaurants/my (primary restaurant)
        try {
            String url = restaurantServiceUrl + "/api/restaurants/my";
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-User-Email", ownerEmail.trim());
            headers.set("X-User-Roles", "RESTAURANT_OWNER");
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
                if (dataNode != null && dataNode.has("id")) {
                    return restaurantId.trim().equalsIgnoreCase(dataNode.get("id").asText());
                }
            }
        } catch (Exception e) {
            log.warn("Error verifying primary restaurant ownership for owner {}: {}", ownerEmail, e.getMessage());
        }

        return false;
    }
}
