package com.smarteats.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.security.Key;
import java.util.List;

@Component
public class AuthenticationFilter extends AbstractGatewayFilterFactory<AuthenticationFilter.Config> {

    private final RouteValidator validator;
    private final Key key;

    public AuthenticationFilter(RouteValidator validator, @Value("${jwt.secret}") String jwtSecret) {
        super(Config.class);
        this.validator = validator;
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    public static class Config {
        // Config options can be added here if needed
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            ServerHttpRequest request = exchange.getRequest();
            String path = request.getURI().getPath();
            boolean isAdminRoute = path.startsWith("/api/admin");
            boolean isSecuredRoute = validator.isSecured.test(request) || isAdminRoute;

            // Strip untrusted client headers that could attempt identity or role spoofing
            request = request.mutate()
                    .headers(httpHeaders -> {
                        httpHeaders.remove("X-User-Email");
                        httpHeaders.remove("X-User-Roles");
                        httpHeaders.remove("X-User-Id");
                        httpHeaders.remove("x-user-email");
                        httpHeaders.remove("x-user-roles");
                        httpHeaders.remove("x-user-id");
                    })
                    .build();

            boolean hasAuth = request.getHeaders().containsKey(HttpHeaders.AUTHORIZATION);

            if (hasAuth) {
                String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
                if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                    if (isSecuredRoute) {
                        return onError(exchange, "Invalid Authorization Header format", HttpStatus.UNAUTHORIZED);
                    }
                } else {
                    String token = authHeader.substring(7);
                    try {
                        Claims claims = Jwts.parserBuilder()
                                .setSigningKey(key)
                                .build()
                                .parseClaimsJws(token)
                                .getBody();

                        String email = claims.getSubject();
                        List<?> roles = claims.get("roles", List.class);
                        String rolesStr = roles != null ? String.join(",", roles.stream().map(Object::toString).toArray(String[]::new)) : "";

                        // Admin Route RBAC: enforce ADMIN role directly at API Gateway perimeter
                        if (isAdminRoute) {
                            boolean hasAdminRole = roles != null && roles.stream()
                                    .anyMatch(r -> "ADMIN".equalsIgnoreCase(r.toString()) || "ROLE_ADMIN".equalsIgnoreCase(r.toString()));
                            if (!hasAdminRole) {
                                return onError(exchange, "Access Denied: Admin role required", HttpStatus.FORBIDDEN);
                            }
                        }

                        // Propagate cryptographically verified identity and roles downstream
                        request = request.mutate()
                                .headers(httpHeaders -> {
                                    httpHeaders.set("X-User-Email", email);
                                    httpHeaders.set("X-User-Roles", rolesStr);
                                })
                                .build();
                    } catch (Exception e) {
                        if (isSecuredRoute) {
                            return onError(exchange, "Unauthorized access: " + e.getMessage(), HttpStatus.UNAUTHORIZED);
                        }
                    }
                }
            } else if (isSecuredRoute) {
                return onError(exchange, "Missing Authorization Header", HttpStatus.UNAUTHORIZED);
            }

            return chain.filter(exchange.mutate().request(request).build());
        };
    }

    private Mono<Void> onError(ServerWebExchange exchange, String err, HttpStatus httpStatus) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(httpStatus);
        return response.setComplete();
    }
}
