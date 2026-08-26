class WasteMitigationEngine:
    @staticmethod
    def evaluate_surplus(inventory_count: int, sales_velocity: float, hours_left_in_day: float, original_price: float):
        expected_sales = sales_velocity * hours_left_in_day
        surplus_count = max(0, int(inventory_count - expected_sales))

        if surplus_count == 0:
            return {
                "surplusDetected": False,
                "surplusUnits": 0,
                "recommendedAction": "NONE",
                "discountPercent": 0,
                "discountedPrice": original_price
            }
        
        # High surplus near end of operating day -> Suggest Dynamic Discount or NGO Donation
        if hours_left_in_day <= 3 and surplus_count > 5:
            discount_pct = 35.0
            discounted_price = round(original_price * (1 - discount_pct / 100.0))
            return {
                "surplusDetected": True,
                "surplusUnits": surplus_count,
                "currency": "INR",
                "currencySymbol": "₹",
                "recommendedAction": "DYNAMIC_DISCOUNT_AND_NGO_ROUTING",
                "discountPercent": discount_pct,
                "discountedPrice": discounted_price,
                "ngoPartner": "Robin Hood Army / Local Food Bank",
                "estimatedWastePreventedKg": round(surplus_count * 0.45, 2)
            }
        else:
            discount_pct = 20.0
            discounted_price = round(original_price * (1 - discount_pct / 100.0))
            return {
                "surplusDetected": True,
                "surplusUnits": surplus_count,
                "currency": "INR",
                "currencySymbol": "₹",
                "recommendedAction": "DYNAMIC_DISCOUNT",
                "discountPercent": discount_pct,
                "discountedPrice": discounted_price,
                "estimatedWastePreventedKg": round(surplus_count * 0.45, 2)
            }
