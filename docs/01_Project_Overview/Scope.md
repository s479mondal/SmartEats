# Project Scope - SmartEats

## What is Included (In Scope)
- **Modular Monolith to Microservices Migration**: Transitioning a single core Spring Boot backend into distinct services: Auth, Restaurant, Order, Delivery, and Notification.
- **AI-Powered RDSS**: The Restaurant Decision Support System consisting of a Python machine learning engine (FastAPI/Flask) doing demand forecasting and surplus waste management.
- **Event-Driven Messaging**: Integration of Apache Kafka for asynchronous communication between microservices (e.g., dispatching order events).
- **In-Memory Caching**: Using Redis to store active shopping carts and cache highly-requested menu items.
- **Dockerization**: Writing Dockerfiles for each microservice and defining a `docker-compose.yml` for unified local deployment.

## What is Excluded (Out of Scope)
- **Production Payment Gateway Integration**: Real payments are bypassed using Stripe/Razorpay sandbox or mock transaction APIs.
- **Production Kubernetes Hosting (EKS)**: Focus is on local Kubernetes development (Minikube/Kind) or Docker Compose, unless explicit resources allow cloud hosting.
- **Cross-City Delivery Routing**: Routes are optimized within localized areas; complex cross-city logistics are out of scope.
