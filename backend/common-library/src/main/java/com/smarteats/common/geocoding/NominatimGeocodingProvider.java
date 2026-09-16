package com.smarteats.common.geocoding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Collections;

@Slf4j
@Component
public class NominatimGeocodingProvider implements GeocodingProvider {

    public static final String PROVIDER_NAME = "OpenStreetMap-Nominatim";

    private final String baseUrl;
    private final String userAgent;
    private final int timeoutMs;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public NominatimGeocodingProvider() {
        this("https://nominatim.openstreetmap.org", "SmartEats-Capstone/1.0 (academic@smarteats.com)", 5000);
    }

    @Autowired
    public NominatimGeocodingProvider(
            @Value("${geocoding.nominatim.baseUrl:https://nominatim.openstreetmap.org}") String baseUrl,
            @Value("${geocoding.nominatim.userAgent:SmartEats-Capstone/1.0 (academic@smarteats.com)}") String userAgent,
            @Value("${geocoding.nominatim.timeoutMs:5000}") int timeoutMs) {
        this.baseUrl = baseUrl;
        this.userAgent = userAgent;
        this.timeoutMs = timeoutMs;
        this.restTemplate = createRestTemplate(timeoutMs);
        this.objectMapper = new ObjectMapper();
    }

    public NominatimGeocodingProvider(String baseUrl, String userAgent, int timeoutMs, RestTemplate restTemplate) {
        this.baseUrl = baseUrl;
        this.userAgent = userAgent;
        this.timeoutMs = timeoutMs;
        this.restTemplate = restTemplate;
        this.objectMapper = new ObjectMapper();
    }

    private static RestTemplate createRestTemplate(int timeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        return new RestTemplate(factory);
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public GeocodingResult geocode(String address) {
        if (address == null || address.trim().isEmpty()) {
            log.warn("Geocoding request rejected: Address string is blank");
            return GeocodingResult.failure("Invalid input: Address cannot be empty or blank", PROVIDER_NAME);
        }

        String sanitizedAddress = address.trim();

        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + "/search")
                    .queryParam("q", sanitizedAddress)
                    .queryParam("format", "json")
                    .queryParam("limit", "1")
                    .build()
                    .encode()
                    .toUri();

            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.USER_AGENT, userAgent);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            log.info("Dispatching geocoding request to Nominatim API for address: '{}'", sanitizedAddress);
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, requestEntity, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.error("Nominatim API returned non-success HTTP status: {}", response.getStatusCode());
                return GeocodingResult.failure("Nominatim service returned HTTP status " + response.getStatusCode(), PROVIDER_NAME);
            }

            JsonNode rootNode = objectMapper.readTree(response.getBody());

            if (!rootNode.isArray() || rootNode.isEmpty()) {
                log.warn("No geocoding matches found by Nominatim for address: '{}'", sanitizedAddress);
                return GeocodingResult.failure("No geocoding result found for address: " + sanitizedAddress, PROVIDER_NAME);
            }

            JsonNode match = rootNode.get(0);
            if (!match.has("lat") || !match.has("lon")) {
                log.error("Malformed Nominatim response: Missing 'lat' or 'lon' attributes");
                return GeocodingResult.failure("Malformed geocoding response from provider", PROVIDER_NAME);
            }

            Double lat = parseDouble(match.get("lat").asText());
            Double lon = parseDouble(match.get("lon").asText());
            String displayName = match.has("display_name") ? match.get("display_name").asText() : sanitizedAddress;

            if (lat == null || lon == null) {
                log.error("Failed to parse coordinates from Nominatim response");
                return GeocodingResult.failure("Invalid coordinate format in response", PROVIDER_NAME);
            }

            if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) {
                log.error("Rejected out-of-bounds coordinates returned by provider: lat={}, lon={}", lat, lon);
                return GeocodingResult.failure("Provider returned out-of-bounds coordinates: [" + lat + ", " + lon + "]", PROVIDER_NAME);
            }

            log.info("Geocoding success for '{}' -> Lat: {}, Lon: {}", sanitizedAddress, lat, lon);
            return GeocodingResult.success(lat, lon, displayName, PROVIDER_NAME);

        } catch (Exception e) {
            log.error("Geocoding request failed for address '{}': {}", sanitizedAddress, e.getMessage(), e);
            return GeocodingResult.failure("Geocoding provider failure: " + e.getMessage(), PROVIDER_NAME);
        }
    }

    private Double parseDouble(String str) {
        try {
            return Double.parseDouble(str);
        } catch (Exception e) {
            return null;
        }
    }
}
