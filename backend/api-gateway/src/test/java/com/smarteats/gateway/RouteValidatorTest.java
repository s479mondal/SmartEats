package com.smarteats.gateway;

import com.smarteats.gateway.filter.RouteValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RouteValidatorTest {

    private RouteValidator validator;

    @BeforeEach
    void setUp() {
        validator = new RouteValidator();
    }

    @Test
    @DisplayName("Location search is open/unsecured during registration")
    void testLocationSearchIsOpen() {
        MockServerHttpRequest request = MockServerHttpRequest
                .get("/api/auth/location/search?query=Kaliganj")
                .build();

        assertFalse(validator.isSecured.test(request));
    }

    @Test
    @DisplayName("Location reverse geocode is open/unsecured during registration")
    void testLocationReverseIsOpen() {
        MockServerHttpRequest request = MockServerHttpRequest
                .get("/api/auth/location/reverse?lat=23.72&lng=88.22")
                .build();

        assertFalse(validator.isSecured.test(request));
    }

    @Test
    @DisplayName("Registration and login remain open")
    void testRegisterAndLoginAreOpen() {
        MockServerHttpRequest regReq = MockServerHttpRequest.post("/api/auth/register").build();
        MockServerHttpRequest loginReq = MockServerHttpRequest.post("/api/auth/login").build();

        assertFalse(validator.isSecured.test(regReq));
        assertFalse(validator.isSecured.test(loginReq));
    }

    @Test
    @DisplayName("Profile and protected auth endpoints remain secured")
    void testProfileRemainsSecured() {
        MockServerHttpRequest profileReq = MockServerHttpRequest.get("/api/auth/profile?email=test@test.com").build();
        MockServerHttpRequest updateReq = MockServerHttpRequest.put("/api/auth/update").build();

        assertTrue(validator.isSecured.test(profileReq));
        assertTrue(validator.isSecured.test(updateReq));
    }
}
