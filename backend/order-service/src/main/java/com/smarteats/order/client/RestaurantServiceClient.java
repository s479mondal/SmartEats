package com.smarteats.order.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarteats.common.exception.BadRequestException;
import com.smarteats.common.exception.ResourceNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URI;

@Slf4j
@Component
public class RestaurantServiceClient {

    private final RestTemplate restTemplate;
    private final String restaurantServiceUrl;
    private final ObjectMapper objectMapper;

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

    public RestaurantCoordinates getRestaurantCoordinates(String restaurantId) {
        if (restaurantId == null || restaurantId.trim().isEmpty()) {
            throw new BadRequestException("Restaurant ID cannot be empty");
        }

        try {
            String url = restaurantServiceUrl + "/api/restaurants/" + restaurantId.trim();
            log.info("Fetching authoritative restaurant coordinates from Restaurant Service: {}", url);
            ResponseEntity<String> response = restTemplate.getForEntity(URI.create(url), String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.error("Restaurant Service returned non-success status {} for ID {}", response.getStatusCode(), restaurantId);
                throw new BadRequestException("Failed to retrieve restaurant details from Restaurant Service");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode dataNode = root.has("data") ? root.get("data") : root;

            if (dataNode == null || dataNode.isNull() || dataNode.isEmpty()) {
                throw new ResourceNotFoundException("Restaurant not found with ID: " + restaurantId);
            }

            Double lat = null;
            Double lon = null;

            if (dataNode.has("latitude") && !dataNode.get("latitude").isNull()) {
                lat = dataNode.get("latitude").asDouble();
            }
            if (dataNode.has("longitude") && !dataNode.get("longitude").isNull()) {
                lon = dataNode.get("longitude").asDouble();
            }

            // Also check geoLocation if latitude/longitude fields are missing
            if ((lat == null || lon == null) && dataNode.has("geoLocation") && !dataNode.get("geoLocation").isNull()) {
                JsonNode geoNode = dataNode.get("geoLocation");
                if (geoNode.has("coordinates") && geoNode.get("coordinates").isArray() && geoNode.get("coordinates").size() >= 2) {
                    // In GeoJSON Point, format is [longitude, latitude]
                    lon = geoNode.get("coordinates").get(0).asDouble();
                    lat = geoNode.get("coordinates").get(1).asDouble();
                }
            }

            if (lat == null || lon == null || (lat == 0.0 && lon == 0.0)) {
                log.warn("Restaurant {} does not have valid stored coordinates: lat={}, lon={}", restaurantId, lat, lon);
                throw new BadRequestException("Restaurant coordinates are missing or invalid for restaurant ID: " + restaurantId + ". Order cannot be accepted.");
            }

            if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) {
                log.error("Out-of-bounds restaurant coordinates for {}: lat={}, lon={}", restaurantId, lat, lon);
                throw new BadRequestException("Restaurant coordinates are out of valid range [-90..90, -180..180]");
            }

            log.info("Authoritatively resolved restaurant coordinates for {}: lat={}, lon={}", restaurantId, lat, lon);
            return new RestaurantCoordinates(lat, lon);

        } catch (BadRequestException | ResourceNotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error communicating with Restaurant Service for ID {}: {}", restaurantId, e.getMessage(), e);
            throw new BadRequestException("Could not verify restaurant coordinates: " + e.getMessage());
        }
    }

    public boolean isRestaurantOpen(String restaurantId) {
        if (restaurantId == null || restaurantId.trim().isEmpty()) {
            throw new BadRequestException("Restaurant ID cannot be empty");
        }

        try {
            String url = restaurantServiceUrl + "/api/restaurants/" + restaurantId.trim();
            log.info("Checking authoritative restaurant open status from Restaurant Service: {}", url);
            ResponseEntity<String> response = restTemplate.getForEntity(URI.create(url), String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.error("Restaurant Service returned non-success status {} for ID {}", response.getStatusCode(), restaurantId);
                throw new BadRequestException("Failed to retrieve restaurant details from Restaurant Service");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode dataNode = root.has("data") ? root.get("data") : root;

            if (dataNode == null || dataNode.isNull() || dataNode.isEmpty()) {
                throw new ResourceNotFoundException("Restaurant not found with ID: " + restaurantId);
            }

            if (dataNode.has("open") && !dataNode.get("open").isNull()) {
                return dataNode.get("open").asBoolean();
            }

            if (dataNode.has("status") && !dataNode.get("status").isNull()) {
                return "ACTIVE".equalsIgnoreCase(dataNode.get("status").asText());
            }

            return false;
        } catch (BadRequestException | ResourceNotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error checking restaurant open status for ID {}: {}", restaurantId, e.getMessage(), e);
            throw new BadRequestException("Could not verify restaurant operating status: " + e.getMessage());
        }
    }

    public boolean reserveInventory(String restaurantId, java.util.List<com.smarteats.order.dto.InventoryItemRequest> items) {
        if (restaurantId == null || restaurantId.trim().isEmpty() || items == null || items.isEmpty()) {
            return true;
        }

        try {
            String url = restaurantServiceUrl + "/api/restaurants/" + restaurantId.trim() + "/inventory/reserve";
            log.info("Sending batch inventory reservation request to Restaurant Service: {} (items count: {})", url, items.size());

            java.util.Map<String, Object> requestPayload = java.util.Map.of("items", items);
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            org.springframework.http.HttpEntity<java.util.Map<String, Object>> entity = new org.springframework.http.HttpEntity<>(requestPayload, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(URI.create(url), entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                boolean success = root.has("success") && root.get("success").asBoolean();
                if (!success) {
                    String msg = root.has("message") ? root.get("message").asText() : "Inventory reservation failed";
                    log.warn("Inventory reservation rejected for restaurant {}: {}", restaurantId, msg);
                    return false;
                }
                return true;
            }
            return false;
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.warn("Restaurant Service rejected inventory reservation for {}: status={}, body={}",
                    restaurantId, e.getStatusCode(), e.getResponseBodyAsString());
            return false;
        } catch (Exception e) {
            log.error("Error communicating with Restaurant Service for inventory reservation {}: {}",
                    restaurantId, e.getMessage(), e);
            return false;
        }
    }

    public boolean releaseInventory(String restaurantId, java.util.List<com.smarteats.order.dto.InventoryItemRequest> items) {
        if (restaurantId == null || restaurantId.trim().isEmpty() || items == null || items.isEmpty()) {
            return true;
        }

        try {
            String url = restaurantServiceUrl + "/api/restaurants/" + restaurantId.trim() + "/inventory/release";
            log.info("Sending batch inventory release request to Restaurant Service: {} (items count: {})", url, items.size());

            java.util.Map<String, Object> requestPayload = java.util.Map.of("items", items);
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            org.springframework.http.HttpEntity<java.util.Map<String, Object>> entity = new org.springframework.http.HttpEntity<>(requestPayload, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(URI.create(url), entity, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.error("Error releasing inventory on Restaurant Service for restaurant {}: {}", restaurantId, e.getMessage(), e);
            return false;
        }
    }

    public String getRestaurantIdByOwnerEmail(String ownerEmail) {
        if (ownerEmail == null || ownerEmail.trim().isEmpty()) {
            throw new BadRequestException("Owner email cannot be empty");
        }

        try {
            String url = restaurantServiceUrl + "/api/restaurants/my";
            log.info("Fetching authoritative restaurant for owner email: {}", ownerEmail);

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

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.error("Restaurant Service returned status {} for owner email {}", response.getStatusCode(), ownerEmail);
                throw new ResourceNotFoundException("No restaurant found for owner: " + ownerEmail);
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode dataNode = root.has("data") ? root.get("data") : root;

            if (dataNode == null || dataNode.isNull() || dataNode.isEmpty() || !dataNode.has("id")) {
                throw new ResourceNotFoundException("No restaurant found for owner: " + ownerEmail);
            }

            String restaurantId = dataNode.get("id").asText();
            log.info("Resolved restaurant ID {} for owner email {}", restaurantId, ownerEmail);
            return restaurantId;
        } catch (ResourceNotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error communicating with Restaurant Service for owner email {}: {}", ownerEmail, e.getMessage());
            throw new ResourceNotFoundException("No restaurant found for owner: " + ownerEmail);
        }
    }

    public boolean isOwnerOfRestaurant(String ownerEmail, String restaurantId) {
        if (ownerEmail == null || ownerEmail.trim().isEmpty() || restaurantId == null || restaurantId.trim().isEmpty()) {
            return false;
        }

        try {
            String primaryId = getRestaurantIdByOwnerEmail(ownerEmail);
            if (restaurantId.trim().equalsIgnoreCase(primaryId)) {
                return true;
            }
        } catch (Exception e) {
            log.debug("Primary restaurant lookup failed for owner {}: {}", ownerEmail, e.getMessage());
        }

        try {
            String url = restaurantServiceUrl + "/api/restaurants/my-restaurants";
            log.info("Checking all owned restaurants for owner email: {}", ownerEmail);

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
                if (dataNode.isArray()) {
                    for (JsonNode restNode : dataNode) {
                        if (restNode.has("id") && restaurantId.trim().equalsIgnoreCase(restNode.get("id").asText())) {
                            return true;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error verifying restaurant ownership list for owner email {}: {}", ownerEmail, e.getMessage());
        }

        return false;
    }
}

