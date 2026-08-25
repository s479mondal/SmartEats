import numpy as np
from sklearn.ensemble import RandomForestRegressor
import datetime

class DemandForecaster:
    def __init__(self):
        # Train a synthetic model on startup for demonstration
        self.model = RandomForestRegressor(n_estimators=50, random_state=42)
        self._train_synthetic_model()

    def _train_synthetic_model(self):
        # Features: [HourOfDay, DayOfWeek, IsWeekend, HistoricalAvgDemand]
        X = []
        y = []
        for hour in range(24):
            for day in range(7):
                is_weekend = 1 if day >= 5 else 0
                # Simulate peak lunch (12-14) and peak dinner (19-21)
                base_demand = 10
                if 12 <= hour <= 14:
                    base_demand = 85
                elif 19 <= hour <= 21:
                    base_demand = 110
                
                if is_weekend:
                    base_demand *= 1.3
                
                X.append([hour, day, is_weekend, base_demand])
                y.append(base_demand + np.random.randint(-5, 6))
        
        self.model.fit(X, y)

    def predict_next_24h(self, restaurant_id: str):
        today = datetime.datetime.now()
        day_of_week = today.weekday()
        predictions = []

        for hour in range(24):
            is_weekend = 1 if day_of_week >= 5 else 0
            base_val = 85 if 12 <= hour <= 14 else (110 if 19 <= hour <= 21 else 20)
            pred = self.model.predict([[hour, day_of_week, is_weekend, base_val]])[0]
            predictions.append({
                "time": f"{hour:02d}:00",
                "predictedOrders": int(round(pred)),
                "confidenceScore": 0.94
            })
        
        return {
            "restaurantId": restaurant_id,
            "forecastDate": today.strftime("%Y-%m-%d"),
            "totalForecastedMeals": sum(p["predictedOrders"] for p in predictions),
            "hourlyForecast": predictions
        }
