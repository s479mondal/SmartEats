# Restaurant Decision Support System (RDSS)

The **Restaurant Decision Support System (RDSS)** is the core AI-driven novelty of the SmartEats platform. It aims to solve the operational inefficiencies and environmental impacts of traditional food delivery systems.

## Key Features
1. **Demand Forecasting Engine**:
   - Analyzes historical order data (timestamp, restaurant ID, dish categories, quantities) to predict next-day sales volumes.
   - Allows restaurants to plan staffing levels and purchase ingredients precisely, preventing over-preparation.
   
2. **Surplus & Food Waste Mitigation**:
   - Monitored menu items are checked against live inventory counts and sales histories.
   - Items flagging low turnover rates as the operating day ends are recommended for:
     - **Dynamic Discounting**: Auto-triggered price reductions for customers to clear stock.
     - **NGO Redirection**: Auto-generated donation listings pushed directly to local partner NGOs.

3. **Intelligent Dispatch System**:
   - Replaces the traditional "assign nearest driver" method.
   - Calculates a matching score based on:
     - Proximity of the delivery partner.
     - Predicted completion time of the meal (food prep status).
     - Route traffic conditions.
   - Minimizes idle driver wait time at restaurants.

## Machine Learning Flow
```
[Historical Order Data] ──> [Feature Engineering] ──> [Forecasting Model] ──> [RDSS Dashboard Output]
                                                                                  │
[Real-Time Inventory] ────> [Waste Flagging Agent] ─> [Dynamic Discounts/NGOs] <──┘
```
