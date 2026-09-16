package com.smarteats.common.geocoding;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

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
}
