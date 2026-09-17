package com.smarteats.gateway.filter;

import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Predicate;

@Component
public class RouteValidator {

    public static final List<String> openApiEndpoints = List.of(
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/validate",
            "/api/auth/location/search",
            "/api/auth/location/reverse",
            "/api/auth/location/pincode",
            "/v3/api-docs",
            "/swagger-ui",
            "/swagger-ui.html",
            "/health",
            "/test"
    );

    public Predicate<ServerHttpRequest> isSecured =
            request -> {
                String path = request.getURI().getPath();
                if (path.startsWith("/api/restaurants") && !path.startsWith("/api/restaurants/my") && !path.contains("/admin/")) {
                    if (request.getMethod().name().equalsIgnoreCase("GET")) {
                        return false;
                    }
                }
                return openApiEndpoints
                        .stream()
                        .noneMatch(uri -> path.contains(uri));
            };
}
