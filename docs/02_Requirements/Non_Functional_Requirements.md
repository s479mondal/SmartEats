# Non-Functional Requirements - SmartEats

## 1. Scalability
- **Horizontal Scalability**: Each microservice must be capable of running multiple replicas behind a load balancer (Spring Cloud Gateway / Kubernetes Service).
- **Database Scaling**: MongoDB must support indexing and replica sets for horizontal read scalability.

## 2. High Availability
- **Service Isolation**: A failure in the Notification Service should not block the ordering flow.
- **Failover**: Redis and Kafka must have failover capabilities or redundant nodes in the deployment configuration.

## 3. Performance
- **Low Latency**: Cart actions must resolve under 100ms via Redis.
- **Caching**: Frequently accessed restaurant menus must be cached to reduce database reads.

## 4. Security
- **Stateless Authentication**: Security must be enforced via JSON Web Tokens (JWT) verified at the gateway and independently by each microservice.
- **Role-Based Access Control (RBAC)**: Ensure customer endpoints, restaurant dashboards, delivery paths, and admin views are properly protected.

## 5. Fault Tolerance
- **Retry Mechanism**: Kafka consumers must implement retry logic for failed message consumption.
- **Circuit Breakers**: Spring Cloud Gateway should use Resilience4j circuit breakers for service fallbacks.
