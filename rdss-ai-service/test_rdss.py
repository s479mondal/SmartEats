import unittest
from forecasting_model import DemandForecaster
from waste_mitigation import WasteMitigationEngine

class TestRDSSAI(unittest.TestCase):
    def test_demand_forecast(self):
        forecaster = DemandForecaster()
        res = forecaster.predict_next_24h("rest-test")
        self.assertEqual(len(res["hourlyForecast"]), 24)
        self.assertGreater(res["totalForecastedMeals"], 0)

    def test_waste_mitigation(self):
        # 10 items remaining, selling 1 item/hr, 2 hours left -> surplus of 8 items
        res = WasteMitigationEngine.evaluate_surplus(
            inventory_count=10,
            sales_velocity=1.0,
            hours_left_in_day=2.0,
            original_price=18.0
        )
        self.assertTrue(res["surplusDetected"])
        self.assertEqual(res["discountPercent"], 35.0)
        self.assertEqual(res["discountedPrice"], 11.7)

if __name__ == '__main__':
    unittest.main()
