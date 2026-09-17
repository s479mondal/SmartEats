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
}
