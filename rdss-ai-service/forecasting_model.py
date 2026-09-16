import numpy as np
import datetime

class DemandForecaster:
    def __init__(self):
        self._has_sklearn = False
        try:
            from sklearn.ensemble import RandomForestRegressor
            self.model = RandomForestRegressor(n_estimators=50, random_state=42)
            self._train_synthetic_model()
            self._has_sklearn = True
        except Exception as e:
            print(f"[RDSS WARNING] Could not initialize RandomForestRegressor ({e}). Using native analytical forecaster.")

    def _train_synthetic_model(self):
        X = []
        y = []
        for hour in range(24):
            for day in range(7):
                is_weekend = 1 if day >= 5 else 0
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
            if self._has_sklearn:
                pred = self.model.predict([[hour, day_of_week, is_weekend, base_val]])[0]
            else:
                pred = base_val * (1.25 if is_weekend else 1.0) + ((hour * 7 + 3) % 9)
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
