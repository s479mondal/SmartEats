# Technology Stack - SmartEats

## Frontend Layer
- **React.js**: Single Page Application (SPA) framework.
- **Tailwind CSS**: Modern styling utilities.
- **WebSockets / Socket.IO Client**: Live GPS updates and real-time status feeds.

## Backend Core Layer
- **Spring Boot**: Java backend framework for building REST APIs.
- **Spring Security & JWT**: Authentication, authorization, and stateless session management.
- **Spring Cloud Gateway**: API gateway for routing client requests.

## Data Persistence & Caching
- **MongoDB**: NoSQL Document Database to store flexible schemas for users, orders, menus, and reviews.
- **Redis**: Key-value in-memory database used for fast shopping cart manipulation and API query caching.

## Asynchronous Communication
- **Apache Kafka**: Distributed event streaming platform for handling order statuses, delivery assignments, and waste alert notifications.

## Artificial Intelligence / Machine Learning
- **Python**: Core ML scripting.
- **FastAPI / Flask**: REST wrappers to serve machine learning models.
- **Scikit-Learn / XGBoost / Pandas**: For demand forecasting (linear regression, random forest regressors).

## Infrastructure & DevOps
- **Docker & Docker Compose**: Multi-container local orchestration.
- **Kubernetes**: Container deployment and scaling.
- **AWS**: Hosting compute nodes (EC2), managed databases (MongoDB Atlas), and object storage (S3).
