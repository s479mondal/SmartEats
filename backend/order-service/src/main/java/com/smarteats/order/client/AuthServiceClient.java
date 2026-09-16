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
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Slf4j
@Component
public class AuthServiceClient {

    private final RestTemplate restTemplate;
    private final String authServiceUrl;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Autowired
    public AuthServiceClient(
            @Value("${services.auth-service.url:http://localhost:8081}") String authServiceUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
        this.authServiceUrl = authServiceUrl;
        this.objectMapper = new ObjectMapper();
    }

    public AuthServiceClient(RestTemplate restTemplate, String authServiceUrl) {
        this.restTemplate = restTemplate;
        this.authServiceUrl = authServiceUrl;
        this.objectMapper = new ObjectMapper();
    }

    public CustomerCoordinates getCustomerCoordinates(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new BadRequestException("Customer email cannot be empty");
        }

        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(authServiceUrl + "/api/auth/profile")
                    .queryParam("email", email.trim())
                    .build()
                    .encode()
                    .toUri();

            log.info("Fetching authoritative customer coordinates from Auth Service: {}", uri);
            ResponseEntity<String> response = restTemplate.getForEntity(uri, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.error("Auth Service returned non-success status {} for email {}", response.getStatusCode(), email);
                throw new BadRequestException("Failed to retrieve customer profile from Auth Service");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode dataNode = root.has("data") ? root.get("data") : root;

            if (dataNode == null || dataNode.isNull() || dataNode.isEmpty()) {
                throw new ResourceNotFoundException("Customer profile not found for email: " + email);
            }

            Double lat = null;
            Double lon = null;

            if (dataNode.has("customerLatitude") && !dataNode.get("customerLatitude").isNull()) {
                lat = dataNode.get("customerLatitude").asDouble();
            }
            if (dataNode.has("customerLongitude") && !dataNode.get("customerLongitude").isNull()) {
                lon = dataNode.get("customerLongitude").asDouble();
            }

            if (lat == null || lon == null || (lat == 0.0 && lon == 0.0)) {
                log.warn("Customer {} does not have valid stored coordinates: lat={}, lon={}", email, lat, lon);
                throw new BadRequestException("Your delivery address is not configured with valid coordinates. Please update your profile address before ordering.");
            }

            if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) {
                log.error("Out-of-bounds customer coordinates for {}: lat={}, lon={}", email, lat, lon);
                throw new BadRequestException("Customer profile coordinates are out of valid range [-90..90, -180..180]");
            }

            log.info("Authoritatively resolved customer coordinates for {}: lat={}, lon={}", email, lat, lon);
            return new CustomerCoordinates(lat, lon);

        } catch (BadRequestException | ResourceNotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error communicating with Auth Service for email {}: {}", email, e.getMessage(), e);
            throw new BadRequestException("Could not verify customer delivery coordinates: " + e.getMessage());
        }
    }
}
