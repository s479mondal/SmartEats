async function testRdss() {
  console.log('--- PART 11: RDSS AI EXACT SCHEMA VERIFICATION ---');

  // 1. Demand Forecast
  const forecastRes = await fetch('http://localhost:8080/api/rdss/forecast?restaurant_id=rest_101');
  const forecastData = await forecastRes.json();
  console.log('\n[1] DEMAND FORECAST:');
  console.log('HTTP Status:', forecastRes.status);
  console.log('Forecasted Meals:', forecastData.totalForecastedMeals);
  console.log('Confidence:', forecastData.hourlyForecast?.[0]?.confidenceScore);

  // 2. Surplus Check
  const surplusRes = await fetch('http://localhost:8080/api/rdss/surplus-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menuItemId: 'item_501',
      inventoryCount: 50,
      salesVelocityPerHour: 5.0,
      hoursLeftInDay: 6.0,
      originalPrice: 250.0
    })
  });
  const surplusData = await surplusRes.json();
  console.log('\n[2] SURPLUS CHECK:');
  console.log('HTTP Status:', surplusRes.status);
  console.log('Response:', JSON.stringify(surplusData, null, 2));

  // 3. Driver Matching
  const matchRes = await fetch('http://localhost:8080/api/rdss/match-driver', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: 'ord_test_999',
      restaurantLat: 12.9716,
      restaurantLng: 77.5946,
      riderLat: 12.9720,
      riderLng: 77.5950,
      foodPrepEtaMinutes: 15
    })
  });
  const matchData = await matchRes.json();
  console.log('\n[3] DRIVER MATCHING:');
  console.log('HTTP Status:', matchRes.status);
  console.log('Response:', JSON.stringify(matchData, null, 2));
}

testRdss().catch(err => console.error('RDSS test error:', err));
