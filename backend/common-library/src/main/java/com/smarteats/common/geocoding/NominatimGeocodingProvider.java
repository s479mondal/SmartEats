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
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class NominatimGeocodingProvider implements GeocodingProvider {

    public static final String PROVIDER_NAME = "OpenStreetMap-Nominatim";

    private final String baseUrl;
    private final String userAgent;
    private final int timeoutMs;
    private final int minRequestIntervalMs;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    // Rate limiting
    private static final Object RATE_LOCK = new Object();
    private static long lastRequestTimestamp = 0;

    // In-memory Thread-Safe TTL Caching (10 min TTL)
    private static final long CACHE_TTL_MS = 10 * 60 * 1000L;
    private static final int MAX_CACHE_ENTRIES = 500;

    private static class CacheEntry<T> {
        final T data;
        final long createdAt;

        CacheEntry(T data) {
            this.data = data;
            this.createdAt = System.currentTimeMillis();
        }

        boolean isExpired() {
            return System.currentTimeMillis() - createdAt > CACHE_TTL_MS;
        }
    }

    private final Map<String, CacheEntry<List<LocationSearchResult>>> searchCache = new ConcurrentHashMap<>(128);
    private final Map<String, CacheEntry<ReverseGeocodingResult>> reverseCache = new ConcurrentHashMap<>(128);
    private final Map<String, CacheEntry<PincodeResult>> pincodeCache = new ConcurrentHashMap<>(128);

    public NominatimGeocodingProvider() {
        this("https://nominatim.openstreetmap.org", "SmartEats-Capstone/1.0 (academic@smarteats.com)", 5000, 1000);
    }

    @Autowired
    public NominatimGeocodingProvider(
            @Value("${geocoding.nominatim.baseUrl:https://nominatim.openstreetmap.org}") String baseUrl,
            @Value("${geocoding.nominatim.userAgent:SmartEats-Capstone/1.0 (academic@smarteats.com)}") String userAgent,
            @Value("${geocoding.nominatim.timeoutMs:5000}") int timeoutMs) {
        this(baseUrl, userAgent, timeoutMs, 1000);
    }

    public NominatimGeocodingProvider(String baseUrl, String userAgent, int timeoutMs, int minRequestIntervalMs) {
        this.baseUrl = baseUrl;
        this.userAgent = userAgent;
        this.timeoutMs = timeoutMs;
        this.minRequestIntervalMs = minRequestIntervalMs;
        this.restTemplate = createRestTemplate(timeoutMs);
        this.objectMapper = new ObjectMapper();
    }

    public NominatimGeocodingProvider(String baseUrl, String userAgent, int timeoutMs, RestTemplate restTemplate) {
        this(baseUrl, userAgent, timeoutMs, restTemplate, 0); // 0ms interval for mock unit tests
    }

    public NominatimGeocodingProvider(String baseUrl, String userAgent, int timeoutMs, RestTemplate restTemplate, int minRequestIntervalMs) {
        this.baseUrl = baseUrl;
        this.userAgent = userAgent;
        this.timeoutMs = timeoutMs;
        this.minRequestIntervalMs = minRequestIntervalMs;
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

            HttpHeaders headers = createHeaders();
            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            log.info("Dispatching geocoding request to Nominatim API for address: '{}'", sanitizedAddress);
            throttleRequest();
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, requestEntity, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.error("Nominatim API returned non-success HTTP status: {}", response.getStatusCode());
                return GeocodingResult.failure("Nominatim service returned HTTP status " + response.getStatusCode(), PROVIDER_NAME);
            }

            JsonNode rootNode = objectMapper.readTree(response.getBody());

            if (!rootNode.isArray() || rootNode.isEmpty()) {
                // Progressive fallback for sub-localities or rural areas
                List<String> fallbackQueries = generateFallbackQueries(sanitizedAddress);
                for (String fallbackQuery : fallbackQueries) {
                    List<LocationSearchResult> fbResults = executeNominatimSearch(fallbackQuery, fallbackQuery, true);
                    if (!fbResults.isEmpty()) {
                        LocationSearchResult first = fbResults.get(0);
                        log.info("Geocoding progressive fallback success for '{}' via parent query '{}' -> Lat: {}, Lon: {}",
                                sanitizedAddress, fallbackQuery, first.getLatitude(), first.getLongitude());
                        return GeocodingResult.success(first.getLatitude(), first.getLongitude(), first.getDisplayName(), PROVIDER_NAME);
                    }
                }
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

    @Override
    public List<LocationSearchResult> search(String address) {
        if (address == null || address.trim().isEmpty()) {
            log.warn("Search location request rejected: Address string is blank");
            return Collections.emptyList();
        }

        String sanitizedAddress = address.trim();
        String cacheKey = sanitizedAddress.toLowerCase(Locale.ROOT);

        // Check cache
        CacheEntry<List<LocationSearchResult>> cached = searchCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            log.info("Returning cached search results for query: '{}' ({} results)", sanitizedAddress, cached.data.size());
            return cached.data;
        }

        // 1. Direct Search with limit=5
        List<LocationSearchResult> directResults = executeNominatimSearch(sanitizedAddress, sanitizedAddress, false);
        if (!directResults.isEmpty()) {
            List<LocationSearchResult> finalResults = deduplicateAndLimit(directResults, 5);
            putSearchCache(cacheKey, finalResults);
            return finalResults;
        }

        // 2. Progressive Hierarchical Fallback for unindexed rural villages/paras (e.g. Harinathpur, Kaliganj, Nadia)
        List<String> fallbackQueries = generateFallbackQueries(sanitizedAddress);
        for (String fallbackQuery : fallbackQueries) {
            log.info("Attempting progressive fallback search for '{}' using parent query '{}'", sanitizedAddress, fallbackQuery);
            List<LocationSearchResult> fallbackResults = executeNominatimSearch(fallbackQuery, fallbackQuery, true);
            if (!fallbackResults.isEmpty()) {
                List<LocationSearchResult> finalResults = deduplicateAndLimit(fallbackResults, 5);
                putSearchCache(cacheKey, finalResults);
                return finalResults;
            }
        }

        // Zero results
        putSearchCache(cacheKey, Collections.emptyList());
        return Collections.emptyList();
    }

    @Override
    public ReverseGeocodingResult reverseGeocode(Double latitude, Double longitude) {
        if (latitude == null || longitude == null) {
            return ReverseGeocodingResult.failure("Latitude and Longitude cannot be null");
        }
        if (latitude < -90.0 || latitude > 90.0 || longitude < -180.0 || longitude > 180.0) {
            return ReverseGeocodingResult.failure("Coordinates out of bounds: [" + latitude + ", " + longitude + "]");
        }

        String cacheKey = String.format(Locale.ROOT, "%.5f,%.5f", latitude, longitude);
        CacheEntry<ReverseGeocodingResult> cached = reverseCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            return cached.data;
        }

        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + "/reverse")
                    .queryParam("lat", String.format(Locale.ROOT, "%.6f", latitude))
                    .queryParam("lon", String.format(Locale.ROOT, "%.6f", longitude))
                    .queryParam("format", "json")
                    .queryParam("addressdetails", "1")
                    .build()
                    .encode()
                    .toUri();

            HttpHeaders headers = createHeaders();
            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            log.info("Dispatching reverse geocoding request to Nominatim API for lat={}, lon={}", latitude, longitude);
            throttleRequest();
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, requestEntity, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return ReverseGeocodingResult.failure("Nominatim reverse API returned HTTP status " + response.getStatusCode());
            }

            JsonNode rootNode = objectMapper.readTree(response.getBody());
            if (rootNode.has("error")) {
                return ReverseGeocodingResult.failure("Reverse geocoding error: " + rootNode.get("error").asText());
            }

            String displayName = rootNode.has("display_name") ? rootNode.get("display_name").asText() : "Unknown Location";
            Double lat = rootNode.has("lat") ? parseDouble(rootNode.get("lat").asText()) : latitude;
            Double lon = rootNode.has("lon") ? parseDouble(rootNode.get("lon").asText()) : longitude;
            Map<String, String> addressDetails = parseAddressDetails(rootNode.get("address"));

            ReverseGeocodingResult result = ReverseGeocodingResult.success(
                    lat != null ? lat : latitude,
                    lon != null ? lon : longitude,
                    displayName,
                    addressDetails
            );

            putReverseCache(cacheKey, result);
            return result;

        } catch (Exception e) {
            log.error("Reverse geocoding failed for lat={}, lon={}: {}", latitude, longitude, e.getMessage(), e);
            return ReverseGeocodingResult.failure("Reverse geocoding failure: " + e.getMessage());
        }
    }

    @Override
    public PincodeResult lookupPincode(String pincode) {
        if (pincode == null || pincode.trim().isEmpty()) {
            return PincodeResult.failure("", "PIN code cannot be blank");
        }

        String cleanPin = pincode.trim();
        if (!cleanPin.matches("^[0-9]{6}$")) {
            return PincodeResult.failure(cleanPin, "PIN code must be exactly 6 numeric digits");
        }

        // 1. Check in-memory cache
        CacheEntry<PincodeResult> cached = pincodeCache.get(cleanPin);
        if (cached != null && !cached.isExpired()) {
            log.info("Returning cached PIN details for '{}'", cleanPin);
            return cached.data;
        }

        // 2. Query Primary Source: India Post Public API (api.postalpincode.in)
        try {
            URI indiaPostUri = URI.create("https://api.postalpincode.in/pincode/" + cleanPin);
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "SmartEats-Capstone/1.0 (academic@smarteats.com)");
            headers.set("Accept", "application/json");
            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            log.info("Dispatching PIN code lookup to India Post API for: '{}'", cleanPin);
            ResponseEntity<String> response = restTemplate.exchange(indiaPostUri, HttpMethod.GET, requestEntity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode rootNode = objectMapper.readTree(response.getBody());
                if (rootNode.isArray() && !rootNode.isEmpty()) {
                    JsonNode firstItem = rootNode.get(0);
                    String status = firstItem.has("Status") ? firstItem.get("Status").asText() : "";
                    if ("Success".equalsIgnoreCase(status) && firstItem.has("PostOffice") && firstItem.get("PostOffice").isArray()) {
                        JsonNode postOfficesNode = firstItem.get("PostOffice");
                        List<String> postOffices = new ArrayList<>();
                        String district = "";
                        String state = "";
                        String country = "India";
                        String city = "";

                        for (JsonNode po : postOfficesNode) {
                            if (po.has("Name")) {
                                postOffices.add(po.get("Name").asText());
                            }
                            if (district.isEmpty() && po.has("District")) {
                                district = po.get("District").asText();
                            }
                            if (state.isEmpty() && po.has("State")) {
                                state = po.get("State").asText();
                            }
                            if (po.has("Country")) {
                                country = po.get("Country").asText();
                            }
                            if (city.isEmpty()) {
                                if (po.has("District") && !po.get("District").asText().isBlank()) {
                                    city = po.get("District").asText();
                                } else if (po.has("Block") && !po.get("Block").asText().isBlank()) {
                                    city = po.get("Block").asText();
                                }
                            }
                        }

                        PincodeResult result = PincodeResult.success(
                                cleanPin,
                                city,
                                district,
                                state,
                                country,
                                postOffices,
                                "Location found for PIN " + cleanPin
                        );
                        putPincodeCache(cleanPin, result);
                        return result;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("India Post API query failed for PIN '{}': {}. Attempting postal fallback...", cleanPin, e.getMessage());
        }

        // 3. Query Secondary Fallback: OpenStreetMap/Nominatim Postal Code Lookup
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + "/search")
                    .queryParam("postalcode", cleanPin)
                    .queryParam("country", "India")
                    .queryParam("format", "json")
                    .queryParam("limit", "1")
                    .queryParam("addressdetails", "1")
                    .build()
                    .encode()
                    .toUri();

            HttpHeaders headers = createHeaders();
            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            log.info("Dispatching fallback postal search to Nominatim for PIN: '{}'", cleanPin);
            throttleRequest();
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, requestEntity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode rootNode = objectMapper.readTree(response.getBody());
                if (rootNode.isArray() && !rootNode.isEmpty()) {
                    JsonNode match = rootNode.get(0);
                    JsonNode addr = match.get("address");
                    String district = "";
                    String state = "";
                    String city = "";

                    if (addr != null) {
                        district = addr.has("state_district") ? addr.get("state_district").asText() : (addr.has("county") ? addr.get("county").asText() : "");
                        state = addr.has("state") ? addr.get("state").asText() : "";
                        city = addr.has("city") ? addr.get("city").asText() : (addr.has("town") ? addr.get("town").asText() : (addr.has("county") ? addr.get("county").asText() : district));
                    }

                    List<String> postOffices = city.isEmpty() ? Collections.emptyList() : List.of(city);
                    PincodeResult result = PincodeResult.success(
                            cleanPin,
                            city,
                            district,
                            state,
                            "India",
                            postOffices,
                            "Location found for PIN " + cleanPin
                    );
                    putPincodeCache(cleanPin, result);
                    return result;
                }
            }
        } catch (Exception e) {
            log.error("Fallback postal lookup failed for PIN '{}': {}", cleanPin, e.getMessage(), e);
        }

        // 4. No location found for this PIN
        PincodeResult notFound = PincodeResult.failure(cleanPin, "No location found for this PIN code.");
        putPincodeCache(cleanPin, notFound);
        return notFound;
    }

    private void putPincodeCache(String key, PincodeResult result) {
        if (pincodeCache.size() >= MAX_CACHE_ENTRIES) {
            pincodeCache.clear();
        }
        pincodeCache.put(key, new CacheEntry<>(result));
    }

    private List<LocationSearchResult> executeNominatimSearch(String queryUrlParam, String matchedQuery, boolean isParentArea) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + "/search")
                    .queryParam("q", queryUrlParam)
                    .queryParam("format", "json")
                    .queryParam("limit", "5")
                    .queryParam("addressdetails", "1")
                    .build()
                    .encode()
                    .toUri();

            HttpHeaders headers = createHeaders();
            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            log.info("Dispatching location search request to Nominatim for: '{}'", queryUrlParam);
            throttleRequest();
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, requestEntity, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return Collections.emptyList();
            }

            JsonNode rootNode = objectMapper.readTree(response.getBody());
            if (!rootNode.isArray() || rootNode.isEmpty()) {
                return Collections.emptyList();
            }

            List<LocationSearchResult> results = new ArrayList<>();
            for (JsonNode item : rootNode) {
                if (!item.has("lat") || !item.has("lon")) {
                    continue;
                }

                Double lat = parseDouble(item.get("lat").asText());
                Double lon = parseDouble(item.get("lon").asText());

                if (lat == null || lon == null || lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) {
                    continue; // Skip invalid coordinates
                }

                String displayName = item.has("display_name") ? item.get("display_name").asText() : queryUrlParam;
                Map<String, String> addressDetails = parseAddressDetails(item.get("address"));

                results.add(LocationSearchResult.builder()
                        .displayName(displayName)
                        .latitude(lat)
                        .longitude(lon)
                        .isParentArea(isParentArea)
                        .matchedQuery(matchedQuery)
                        .addressDetails(addressDetails)
                        .build());
            }

            return results;
        } catch (Exception e) {
            log.error("Nominatim search failed for '{}': {}", queryUrlParam, e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    private List<String> generateFallbackQueries(String input) {
        List<String> queries = new ArrayList<>();
        String[] tokens = input.split(",");
        if (tokens.length > 1) {
            for (int i = 1; i < tokens.length; i++) {
                StringBuilder sb = new StringBuilder();
                for (int j = i; j < tokens.length; j++) {
                    String t = tokens[j].trim();
                    if (!t.isEmpty()) {
                        if (sb.length() > 0) sb.append(", ");
                        sb.append(t);
                    }
                }
                String fallback = sb.toString();
                if (fallback.length() >= 3 && !queries.contains(fallback)) {
                    queries.add(fallback);
                }
            }
        }
        return queries;
    }

    private Map<String, String> parseAddressDetails(JsonNode addressNode) {
        Map<String, String> details = new HashMap<>();
        if (addressNode != null && addressNode.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = addressNode.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                if (field.getValue().isTextual()) {
                    details.put(field.getKey(), field.getValue().asText());
                }
            }
        }
        return details;
    }

    private List<LocationSearchResult> deduplicateAndLimit(List<LocationSearchResult> list, int limit) {
        List<LocationSearchResult> clean = new ArrayList<>();
        Set<String> seenCoords = new HashSet<>();

        for (LocationSearchResult r : list) {
            String coordKey = String.format(Locale.ROOT, "%.4f,%.4f", r.getLatitude(), r.getLongitude());
            if (!seenCoords.contains(coordKey)) {
                seenCoords.add(coordKey);
                clean.add(r);
                if (clean.size() >= limit) {
                    break;
                }
            }
        }
        return clean;
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.USER_AGENT, userAgent);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        return headers;
    }

    private void throttleRequest() {
        if (minRequestIntervalMs <= 0) {
            return;
        }
        synchronized (RATE_LOCK) {
            long now = System.currentTimeMillis();
            long elapsed = now - lastRequestTimestamp;
            if (elapsed < minRequestIntervalMs) {
                try {
                    Thread.sleep(minRequestIntervalMs - elapsed);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
            }
            lastRequestTimestamp = System.currentTimeMillis();
        }
    }

    private void putSearchCache(String key, List<LocationSearchResult> value) {
        if (searchCache.size() >= MAX_CACHE_ENTRIES) {
            searchCache.clear();
        }
        searchCache.put(key, new CacheEntry<>(value));
    }

    private void putReverseCache(String key, ReverseGeocodingResult value) {
        if (reverseCache.size() >= MAX_CACHE_ENTRIES) {
            reverseCache.clear();
        }
        reverseCache.put(key, new CacheEntry<>(value));
    }

    private Double parseDouble(String str) {
        try {
            return Double.parseDouble(str);
        } catch (Exception e) {
            return null;
        }
    }
}
