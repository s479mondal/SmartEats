const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function testRedisCart() {
  console.log('--- PART 3: REDIS LIVE VERIFICATION ---');
  
  // 1. Customer login
  const loginRes = await fetch('http://localhost:8080/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@smarteats.com', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  const token = loginData?.data?.token;
  console.log('Login status:', loginRes.status, 'Token acquired:', !!token);

  // 2. Add item to cart
  const addRes = await fetch('http://localhost:8080/api/orders/cart?restaurantId=rest_101', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      menuItemId: 'item_501',
      name: 'Paneer Butter Masala',
      price: 240,
      quantity: 3
    })
  });
  const addData = await addRes.json();
  console.log('Add to cart HTTP:', addRes.status, 'Data:', JSON.stringify(addData));

  // 3. Inspect Redis Key directly in container
  const redisKeys = execSync('cmd.exe /c "docker exec smarteats-redis redis-cli KEYS *"').toString().trim();
  console.log('Redis KEYS output:\n', redisKeys);

  const cartValue = execSync('cmd.exe /c "docker exec smarteats-redis redis-cli GET cart:customer@smarteats.com"').toString().trim();
  console.log('Redis GET cart:customer@smarteats.com output:\n', cartValue);

  // 4. Update quantity
  const updateRes = await fetch('http://localhost:8080/api/orders/cart?restaurantId=rest_101', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      menuItemId: 'item_501',
      name: 'Paneer Butter Masala',
      price: 240,
      quantity: 5
    })
  });
  const updateData = await updateRes.json();
  console.log('Update quantity HTTP:', updateRes.status, 'Data:', JSON.stringify(updateData));

  const updatedCartValue = execSync('cmd.exe /c "docker exec smarteats-redis redis-cli GET cart:customer@smarteats.com"').toString().trim();
  console.log('Redis GET after update:\n', updatedCartValue);

  // 5. Remove item / Clear cart
  const clearRes = await fetch('http://localhost:8080/api/orders/cart', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log('Delete cart HTTP:', clearRes.status);

  const finalRedisKeys = execSync('cmd.exe /c "docker exec smarteats-redis redis-cli KEYS *"').toString().trim();
  console.log('Redis KEYS after clear:\n', finalRedisKeys || '(empty)');
}

testRedisCart().catch(err => console.error('Redis test error:', err));
