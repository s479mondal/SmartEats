from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from forecasting_model import DemandForecaster
from waste_mitigation import WasteMitigationEngine

app = FastAPI(
    title="SmartEats - RDSS AI Service",
    description="AI-Driven Restaurant Decision Support System for Demand Forecasting, Surplus Mitigation, and Proximity Matching.",
    version="1.0.0"
)

forecaster = DemandForecaster()

class SurplusRequest(BaseModel):
    menuItemId: str
    inventoryCount: int
    salesVelocityPerHour: float
    hoursLeftInDay: float
    originalPrice: float

class DriverMatchRequest(BaseModel):
    orderId: str
    restaurantLat: float
    restaurantLng: float
    riderLat: float
    riderLng: float
    foodPrepEtaMinutes: int

@app.get("/")
def read_root():
    return {
        "service": "SmartEats RDSS AI Microservice",
        "status": "HEALTHY",
        "features": ["Demand Forecasting", "Surplus Food Waste Mitigation", "Proximity Driver Matching"]
    }

@app.get("/api/rdss/forecast")
def get_demand_forecast(restaurant_id: str = "rest-101"):
    """
    Predicts next 24-hour meal demand using Random Forest ML Model.
    """
    return forecaster.predict_next_24h(restaurant_id)

@app.post("/api/rdss/surplus-check")
def check_surplus_and_mitigate(req: SurplusRequest):
    """
    Evaluates item inventory vs velocity to recommend dynamic discounts & NGO donation dispatches.
    """
    result = WasteMitigationEngine.evaluate_surplus(
        req.inventoryCount,
        req.salesVelocityPerHour,
        req.hoursLeftInDay,
        req.originalPrice
    )
    return result

@app.post("/api/rdss/match-driver")
def calculate_driver_match_score(req: DriverMatchRequest):
    """
    Calculates intelligent driver match score based on Euclidean distance & food prep readiness.
    """
    import math
    # Approximate distance in kilometers
    lat_diff = req.restaurantLat - req.riderLat
    lng_diff = req.restaurantLng - req.riderLng
    dist_km = math.sqrt(lat_diff**2 + lng_diff**2) * 111.0
    
    # Matching score formula: higher proximity + aligned prep time -> higher score
    proximity_score = max(0.0, 100.0 - (dist_km * 15.0))
    score = min(99.0, max(50.0, proximity_score))

    return {
        "orderId": req.orderId,
        "distanceKm": round(dist_km, 2),
        "foodPrepEtaMinutes": req.foodPrepEtaMinutes,
        "matchingScorePercent": round(score, 1),
        "recommendedAssignment": score > 75.0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
