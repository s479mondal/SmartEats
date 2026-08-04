# SmartEats

An AI-Powered Distributed Food Delivery Platform with a Restaurant Decision Support System (RDSS) for Demand Forecasting, Delivery Optimization, and Sustainable Food Waste Management.

## Project Structure
- **`frontend/`**: React-based administrative, driver, and consumer client dashboards.
- **`backend/`**: Spring Boot modular monolithic / microservices backend services.
- **`infrastructure/`**: Deployment configurations, Kubernetes YAML definitions.
- **`docker/`**: Individual Dockerfiles for the microservices.
- **`docs/`**: Exhaustive system documentation and academic write-ups.

## Getting Started

### Prerequisites
- Java 17+
- Node.js & npm
- Docker & Docker Compose
- Python 3.10+ (for ML forecasting module)

### Local Environment Set Up
To boot up the required infrastructure databases (MongoDB, Redis, Kafka) locally, run:
```bash
docker-compose up -d
```

For project design and documentation details, browse the [docs/](docs/) folder.
