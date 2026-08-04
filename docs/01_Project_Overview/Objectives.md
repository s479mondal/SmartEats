# Objectives - SmartEats

## Functional Objectives
- **Authentication Service**: Implement multi-role authentication (Customer, Restaurant, Delivery Partner, Admin) with role-based access control (RBAC) and JWT validation.
- **Restaurant & Menu Management**: Enable restaurants to perform CRUD on profiles, menu structures, and set real-time item availability.
- **Cart & Order Processing**: Build a high-performance shopping cart backed by Redis, and an ACID-compliant ordering system using MongoDB transactions.
- **Interactive Dashboards**: Build clean React dashboards for restaurants to see order requests, predictions, and inventory statuses.
- **Real-Time Notification Systems**: Provide event-driven notification pushes (via WebSockets/SSE) to keep customers updated on order status.

## Research & AI Objectives
- **Demand Forecasting**: Train a time-series model (Regression, Random Forest, or XGBoost) to forecast next-day sales volumes based on historical order data.
- **Intelligent Delivery Dispatch**: Develop a weighted scoring model for partner assignment factoring in distance, current traffic conditions, and food preparation completion times.
- **Sustainable Waste Mitigation**: Build an automated detection agent that flags low-turning inventory nearing end-of-day, triggers dynamic discounting, or schedules donation pickups for local NGOs.
