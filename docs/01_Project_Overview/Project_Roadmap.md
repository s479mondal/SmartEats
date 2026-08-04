# Project Roadmap - SmartEats

## Phase 1: Core Foundation (Monolith)
- **Goal**: A working ordering flow, end-to-end, built in a modular monolith.
- **Tasks**:
  - Implement Auth Service (Spring Security, JWT, BCrypt, RBAC).
  - Implement Restaurant & Menu Module (CRUD MongoDB collections).
  - Implement Cart Module (Redis-backed, auto-expiring cart).
  - Implement Order Module (MongoDB transaction placement).

## Phase 2: Payments, Delivery, Admin
- **Goal**: Complete order lifecycle from payment to delivery to admin oversight.
- **Tasks**:
  - Integrate Mock Payment APIs (Stripe/Razorpay sandbox).
  - Add Delivery Partner login, order acceptance, and status transitions.
  - Implement Admin dashboard with platform aggregations.
  - Set up notification module for transaction stages.

## Phase 3: Microservices & Event-Driven Messaging
- **Goal**: Decompose monolith into a scalable distributed system.
- **Tasks**:
  - Split monolith into services: `auth-service`, `restaurant-service`, `order-service`, `delivery-service`, and `notification-service`.
  - Set up **Spring Cloud Gateway** as the API Gateway.
  - Set up **Kafka** clusters for inter-service communication (e.g., publishing `order.placed` event).

## Phase 4: Real-Time Tracking & Cloud Deployment
- **Goal**: A live, deployed, demoable system.
- **Tasks**:
  - Implement real-time coordinate pushing via WebSockets.
  - Dockerize each microservice.
  - Deploy to AWS EC2 + MongoDB Atlas. Configure Kubernetes.

## Phase 5: AI Layer (Differentiator)
- **Goal**: Integrate RDSS AI system.
- **Tasks**:
  - Build Demand Forecasting model in Python (FastAPI integration).
  - Implement Intelligent Delivery Assignment (weighted score calculation).
  - Create food waste tracking, dynamic discounts, and NGO dispatch workflows.
