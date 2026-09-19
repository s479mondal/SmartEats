import crypto from 'crypto';

const API_BASE = 'http://localhost:8080';
const TEST_EMAIL = 'customer@smarteats.com';
const TEST_PASSWORD = 'password123';
const RAZORPAY_SECRET = 'eU3taZ4ADVpI3HT3sfnjRfvf';

console.log('==================================================');
console.log('   SMARTEATS LIVE RAZORPAY SANDBOX FLOW TEST     ');
console.log('==================================================\n');

async function runLiveTest() {
  try {
    // 1. Authenticate / Register Customer
    const dynamicEmail = `customer_${Date.now()}@smarteats.com`;
    const dynamicPassword = 'Password@123';
    console.log(`1. Registering test customer: ${dynamicEmail}...`);

    const registerRes = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Razorpay Test Customer',
        email: dynamicEmail,
        password: dynamicPassword,
        phone: '9876543210',
        role: 'CUSTOMER',
        address: 'Indiranagar 100ft Rd, Bengaluru 560038',
        latitude: 12.9716,
        longitude: 77.5946
      })
    });

    const registerData = await registerRes.json();
    console.log('   [OK] Customer registered.');

    console.log('   Logging in customer...');
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dynamicEmail, password: dynamicPassword })
    });

    const loginData = await loginRes.json();
    const token = loginData.data?.token || loginData.token;
    if (!token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    console.log('   [OK] Customer logged in successfully.');

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 2. Fetch Restaurants to get a valid restaurant ID and menu item
    console.log('2. Fetching available restaurants...');
    const restRes = await fetch(`${API_BASE}/api/restaurants`, { headers: authHeaders });
    const restData = await restRes.json();
    const restaurants = restData.data || restData;
    if (!restaurants || restaurants.length === 0) {
      throw new Error('No restaurants found in database');
    }
    const restaurant = restaurants[0];
    const restaurantId = restaurant.id || restaurant._id;
    console.log(`   [OK] Selected restaurant: ${restaurant.name} (${restaurantId})`);

    // 3. Fetch Restaurant Menu
    console.log('3. Fetching restaurant menu items...');
    const menuRes = await fetch(`${API_BASE}/api/restaurants/${restaurantId}/menu`, { headers: authHeaders });
    const menuData = await menuRes.json();
    const menuItems = menuData.data || menuData;
    if (!menuItems || menuItems.length === 0) {
      throw new Error(`No menu items found for restaurant ${restaurantId}`);
    }
    const menuItem = menuItems[0];
    const menuItemId = menuItem.id || menuItem._id;
    console.log(`   [OK] Selected menu item: ${menuItem.name} (₹${menuItem.price})`);

    // 4. Clear existing cart
    console.log('4. Clearing cart...');
    await fetch(`${API_BASE}/api/orders/cart`, { method: 'DELETE', headers: authHeaders });

    // 5. Add item to cart
    console.log('5. Adding item to cart...');
    const addCartRes = await fetch(`${API_BASE}/api/orders/cart?restaurantId=${encodeURIComponent(restaurantId)}`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        menuItemId: menuItemId,
        name: menuItem.name,
        quantity: 1,
        price: menuItem.price
      })
    });
    const addCartData = await addCartRes.json();
    console.log('   [OK] Item added to cart.');

    // 6. Call createPaymentOrder (POST /api/orders/payment/create-order)
    console.log('6. Creating Razorpay payment order (POST /api/orders/payment/create-order)...');
    const createOrderRes = await fetch(`${API_BASE}/api/orders/payment/create-order`, {
      method: 'POST',
      headers: authHeaders
    });
    const createOrderData = await createOrderRes.json();
    if (!createOrderRes.ok || !createOrderData.data?.razorpayOrderId) {
      throw new Error(`Failed to create payment order: ${JSON.stringify(createOrderData)}`);
    }

    const paymentOrder = createOrderData.data;
    console.log(`   [OK] Payment Order Created:`);
    console.log(`        - SmartEats Order ID : ${paymentOrder.orderId}`);
    console.log(`        - Razorpay Order ID  : ${paymentOrder.razorpayOrderId}`);
    console.log(`        - Amount in Paise    : ${paymentOrder.amountInPaise} (₹${paymentOrder.amount})`);
    console.log(`        - Key ID             : ${paymentOrder.keyId}`);

    // 7. Verify order in DB is in PENDING_PAYMENT status
    console.log('7. Verifying order state in Order Service...');
    const getOrderRes = await fetch(`${API_BASE}/api/orders/${paymentOrder.orderId}`, { headers: authHeaders });
    const getOrderData = await getOrderRes.json();
    const currentOrder = getOrderData.data;
    if (currentOrder.status !== 'PENDING_PAYMENT' || currentOrder.paymentStatus !== 'PENDING') {
      throw new Error(`Unexpected order state before payment: status=${currentOrder.status}, paymentStatus=${currentOrder.paymentStatus}`);
    }
    console.log(`   [OK] Order status is authoritatively verified as PENDING_PAYMENT.`);

    // 8. Generate HMAC-SHA256 signature for test payment
    const mockPaymentId = `pay_test_sandbox_${Date.now()}`;
    const payload = `${paymentOrder.razorpayOrderId}|${mockPaymentId}`;
    const generatedSignature = crypto.createHmac('sha256', RAZORPAY_SECRET).update(payload).digest('hex');
    console.log(`8. Generated test HMAC-SHA256 signature for paymentId ${mockPaymentId}`);

    // 9. Call verifyPayment (POST /api/orders/payment/verify)
    console.log('9. Calling payment verification endpoint (POST /api/orders/payment/verify)...');
    const verifyRes = await fetch(`${API_BASE}/api/orders/payment/verify`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        orderId: paymentOrder.orderId,
        razorpayOrderId: paymentOrder.razorpayOrderId,
        razorpayPaymentId: mockPaymentId,
        razorpaySignature: generatedSignature
      })
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.data?.success) {
      throw new Error(`Payment verification failed: ${JSON.stringify(verifyData)}`);
    }

    console.log(`   [OK] Payment Verification Succeeded:`);
    console.log(`        - Order ID       : ${verifyData.data.orderId}`);
    console.log(`        - Payment Status : ${verifyData.data.paymentStatus}`);
    console.log(`        - Order Status   : ${verifyData.data.orderStatus}`);
    console.log(`        - Message        : ${verifyData.data.message}`);

    // 10. Verify order state in order history
    console.log('10. Checking Customer Order History...');
    const customerOrdersRes = await fetch(`${API_BASE}/api/orders/customer`, { headers: authHeaders });
    const customerOrdersData = await customerOrdersRes.json();
    const myOrders = customerOrdersData.data || customerOrdersData;
    const verifiedOrderInList = myOrders.find(o => o.id === paymentOrder.orderId);
    if (!verifiedOrderInList || verifiedOrderInList.paymentStatus !== 'PAID') {
      throw new Error(`Verified order not found in customer order history with status PAID`);
    }
    console.log(`   [OK] Order ${paymentOrder.orderId} found in history with status PAID and order status ${verifiedOrderInList.status}.`);

    // 11. Test Idempotency
    console.log('11. Testing payment verification idempotency (duplicate verify call)...');
    const duplicateVerifyRes = await fetch(`${API_BASE}/api/orders/payment/verify`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        orderId: paymentOrder.orderId,
        razorpayOrderId: paymentOrder.razorpayOrderId,
        razorpayPaymentId: mockPaymentId,
        razorpaySignature: generatedSignature
      })
    });
    const duplicateVerifyData = await duplicateVerifyRes.json();
    if (!duplicateVerifyRes.ok || !duplicateVerifyData.data?.success || duplicateVerifyData.data.message !== 'Payment already verified') {
      throw new Error(`Idempotent verification failed: ${JSON.stringify(duplicateVerifyData)}`);
    }
    console.log(`   [OK] Duplicate verification safely returned idempotent response: "${duplicateVerifyData.data.message}"`);

    console.log('\n==================================================');
    console.log('  LIVE RAZORPAY SANDBOX FLOW TEST COMPLETE: SUCCESS! ✅');
    console.log('==================================================');
  } catch (err) {
    console.error('\n[FAIL] Live test error:', err.message);
    process.exit(1);
  }
}

runLiveTest();
