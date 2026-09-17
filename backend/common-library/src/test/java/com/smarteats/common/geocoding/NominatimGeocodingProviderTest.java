package com.smarteats.common.geocoding;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class NominatimGeocodingProviderTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private NominatimGeocodingProvider provider;

    private static final String BASE_URL = "https://nominatim.openstreetmap.org";
    private static final String USER_AGENT = "SmartEats-Capstone/1.0 (academic@smarteats.com)";

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        provider = new NominatimGeocodingProvider(BASE_URL, USER_AGENT, 5000, restTemplate);
    }

    // Existing Single Geocode Tests
    @Test
    void testGeocodeSuccess() {
        String mockResponse = "[{\"lat\":\"12.9716\",\"lon\":\"77.5946\",\"display_name\":\"Indiranagar, Bengaluru, Karnataka, India\"}]";

        mockServer.expect(requestTo("https://nominatim.openstreetmap.org/search?q=Indiranagar%20Bengaluru&format=json&limit=1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(mockResponse, MediaType.APPLICATION_JSON));

        GeocodingResult result = provider.geocode("Indiranagar Bengaluru");

        assertTrue(result.isSuccess());
        assertEquals(12.9716, result.getLatitude());
        assertEquals(77.5946, result.getLongitude());
        assertEquals("Indiranagar, Bengaluru, Karnataka, India", result.getFormattedAddress());
        assertEquals("OpenStreetMap-Nominatim", result.getProviderName());
        mockServer.verify();
    }

    @Test
    void testGeocodeEmptyResult() {
        mockServer.expect(requestTo("https://nominatim.openstreetmap.org/search?q=NonExistentPlaceXYZ123&format=json&limit=1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        GeocodingResult result = provider.geocode("NonExistentPlaceXYZ123");

        assertFalse(result.isSuccess());
        assertNotNull(result.getErrorMessage());
        assertTrue(result.getErrorMessage().contains("No geocoding result found"));
        mockServer.verify();
    }

    @Test
    void testGeocodeBlankAddressInput() {
        GeocodingResult resultNull = provider.geocode(null);
        assertFalse(resultNull.isSuccess());
        assertTrue(resultNull.getErrorMessage().contains("empty or blank"));

        GeocodingResult resultEmpty = provider.geocode("   ");
        assertFalse(resultEmpty.isSuccess());
        assertTrue(resultEmpty.getErrorMessage().contains("empty or blank"));
    }

    @Test
    void testGeocodeOutOfBoundsCoordinates() {
        String mockResponse = "[{\"lat\":\"195.0\",\"lon\":\"77.5946\",\"display_name\":\"Invalid Location\"}]";

        mockServer.expect(requestTo("https://nominatim.openstreetmap.org/search?q=InvalidCoord&format=json&limit=1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(mockResponse, MediaType.APPLICATION_JSON));

        GeocodingResult result = provider.geocode("InvalidCoord");

        assertFalse(result.isSuccess());
        assertTrue(result.getErrorMessage().contains("out-of-bounds"));
        mockServer.verify();
    }

    @Test
    void testGeocodeProviderHttpError() {
        mockServer.expect(requestTo("https://nominatim.openstreetmap.org/search?q=ErrorAddress&format=json&limit=1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withServerError());

        GeocodingResult result = provider.geocode("ErrorAddress");

        assertFalse(result.isSuccess());
        assertNotNull(result.getErrorMessage());
        mockServer.verify();
    }

    // Step 2: Multi-Result Search & Progressive Fallback Tests
    @Test
    void testSearchExactMatchSuccess() {
        String mockResponse = "[" +
                "{\"lat\":\"23.7149\",\"lon\":\"88.2899\",\"display_name\":\"Kaliganj, Nadia, West Bengal, India\",\"address\":{\"county\":\"Nadia\",\"state\":\"West Bengal\",\"country\":\"India\"}}," +
                "{\"lat\":\"23.7276\",\"lon\":\"88.2294\",\"display_name\":\"Kaliganj, Nadia, West Bengal, 741150, India\",\"address\":{\"county\":\"Nadia\",\"state\":\"West Bengal\",\"postcode\":\"741150\",\"country\":\"India\"}}" +
                "]";

        mockServer.expect(requestTo("https://nominatim.openstreetmap.org/search?q=Kaliganj,%20Nadia&format=json&limit=5&addressdetails=1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(mockResponse, MediaType.APPLICATION_JSON));

        List<LocationSearchResult> results = provider.search("Kaliganj, Nadia");

        assertNotNull(results);
        assertEquals(2, results.size());

        LocationSearchResult first = results.get(0);
        assertEquals("Kaliganj, Nadia, West Bengal, India", first.getDisplayName());
        assertEquals(23.7149, first.getLatitude());
        assertEquals(88.2899, first.getLongitude());
        assertFalse(first.isParentArea());
        assertEquals("Kaliganj, Nadia", first.getMatchedQuery());
        assertNotNull(first.getAddressDetails());
        assertEquals("Nadia", first.getAddressDetails().get("county"));

        mockServer.verify();
    }

    @Test
    void testSearchProgressiveFallbackWhenExactNotFound() {
        // First query for "Harinathpur, Kaliganj, Nadia" returns empty array []
        mockServer.expect(requestTo("https://nominatim.openstreetmap.org/search?q=Harinathpur,%20Kaliganj,%20Nadia&format=json&limit=5&addressdetails=1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        // Fallback query for parent area "Kaliganj, Nadia" returns candidates
        String fallbackResponse = "[" +
                "{\"lat\":\"23.7276\",\"lon\":\"88.2294\",\"display_name\":\"Kaliganj, Nadia, West Bengal, 741150, India\",\"address\":{\"county\":\"Nadia\",\"state\":\"West Bengal\",\"postcode\":\"741150\",\"country\":\"India\"}}" +
                "]";

        mockServer.expect(requestTo("https://nominatim.openstreetmap.org/search?q=Kaliganj,%20Nadia&format=json&limit=5&addressdetails=1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(fallbackResponse, MediaType.APPLICATION_JSON));

        List<LocationSearchResult> results = provider.search("Harinathpur, Kaliganj, Nadia");

        assertNotNull(results);
        assertEquals(1, results.size());

        LocationSearchResult fallbackResult = results.get(0);
        assertEquals("Kaliganj, Nadia, West Bengal, 741150, India", fallbackResult.getDisplayName());
        assertEquals(23.7276, fallbackResult.getLatitude());
        assertEquals(88.2294, fallbackResult.getLongitude());
        assertTrue(fallbackResult.isParentArea(), "Fallback candidate must be marked as isParentArea=true");
        assertEquals("Kaliganj, Nadia", fallbackResult.getMatchedQuery());

        mockServer.verify();
    }

    @Test
    void testSearchDeduplicationAndInvalidCoordinateFiltering() {
        String mockResponse = "[" +
                "{\"lat\":\"12.9716\",\"lon\":\"77.5946\",\"display_name\":\"Place A\"}," +
                "{\"lat\":\"12.9716\",\"lon\":\"77.5946\",\"display_name\":\"Place A Duplicate\"}," +
                "{\"lat\":\"999.0\",\"lon\":\"77.5946\",\"display_name\":\"Invalid Out of Bounds\"}," +
                "{\"lat\":\"13.0000\",\"lon\":\"77.6000\",\"display_name\":\"Place B\"}" +
                "]";

        mockServer.expect(requestTo("https://nominatim.openstreetmap.org/search?q=TestPlace&format=json&limit=5&addressdetails=1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(mockResponse, MediaType.APPLICATION_JSON));

        List<LocationSearchResult> results = provider.search("TestPlace");

        assertNotNull(results);
        assertEquals(2, results.size());
        assertEquals("Place A", results.get(0).getDisplayName());
        assertEquals("Place B", results.get(1).getDisplayName());
        mockServer.verify();
    }

    @Test
    void testSearchBlankQueryReturnsEmptyList() {
        List<LocationSearchResult> resultsNull = provider.search(null);
        assertNotNull(resultsNull);
        assertTrue(resultsNull.isEmpty());

        List<LocationSearchResult> resultsBlank = provider.search("   ");
        assertNotNull(resultsBlank);
        assertTrue(resultsBlank.isEmpty());
    }

    // Step 2: Reverse Geocoding Tests
    @Test
    void testReverseGeocodeSuccess() {
        String mockResponse = "{\"lat\":\"23.7276\",\"lon\":\"88.2294\",\"display_name\":\"Plassey Kaliganj Road, Kaliganj, Nadia, West Bengal, 741150, India\",\"address\":{\"road\":\"Plassey Kaliganj Road\",\"village\":\"Kaliganj\",\"county\":\"Nadia\",\"state\":\"West Bengal\",\"postcode\":\"741150\",\"country\":\"India\"}}";

        mockServer.expect(requestTo("https://nominatim.openstreetmap.org/reverse?lat=23.727600&lon=88.229400&format=json&addressdetails=1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(mockResponse, MediaType.APPLICATION_JSON));

        ReverseGeocodingResult result = provider.reverseGeocode(23.7276, 88.2294);

        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals(23.7276, result.getLatitude());
        assertEquals(88.2294, result.getLongitude());
        assertTrue(result.getFormattedAddress().contains("Kaliganj"));
        assertNotNull(result.getAddressDetails());
        assertEquals("West Bengal", result.getAddressDetails().get("state"));
        mockServer.verify();
    }

    @Test
    void testReverseGeocodeOutOfBoundsCoordinates() {
        ReverseGeocodingResult result = provider.reverseGeocode(95.0, 77.0);
        assertNotNull(result);
        assertFalse(result.isSuccess());
        assertTrue(result.getErrorMessage().contains("out of bounds"));
    }

    @Test
    void testReverseGeocodeHttpError() {
        mockServer.expect(requestTo("https://nominatim.openstreetmap.org/reverse?lat=12.000000&lon=77.000000&format=json&addressdetails=1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withServerError());

        ReverseGeocodingResult result = provider.reverseGeocode(12.0, 77.0);

        assertNotNull(result);
        assertFalse(result.isSuccess());
        mockServer.verify();
    }
}
