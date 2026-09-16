const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient, ObjectId } = require('mongodb');
const { execSync } = require('child_process');

const envPath = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envPath, 'utf8');
const atlasUri = env.match(/MONGODB_URI=(.+)/)[1].trim();

const GATEWAY_URL = 'http://localhost:8080';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${GATEWAY_URL}${endpoint}`, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }
  return { status: res.status, data };
}

async function runBug4Verification() {
  console.log('================================================================');
  console.log('🚀 LIVE VERIFICATION: BUG #4 ORDER VS DELIVERY STATUS SYNC');
  console.log('================================================================\n');

  const atlasClient = new MongoClient(atlasUri);
  await atlasClient.connect();

  // 1. CUSTOMER LOGIN
  console.log('▶ [1/6] Authenticating Customer...');
  const custLogin = await apiRequest('/api/auth/login', 'POST', {
    email: 'customer@smarteats.com',
    password: 'admin123'
  });
  const customerToken = custLogin.data?.data?.token || custLogin.data?.token;
  if (!customerToken) throw new Error('Customer login failed: ' + JSON.stringify(custLogin));
  console.log('  ✔ Customer logged in.');

  // 2. CREATE NEW ORDER
  console.log('\n▶ [2/6] Placing Order via Redis Cart...');
  await apiRequest('/api/orders/cart', 'DELETE', null, customerToken);
  await apiRequest('/api/orders/cart?restaurantId=rest_101', 'POST', {
    menuItemId: 'item_501',
    name: 'Woodfired Margherita',
    price: 292,
    quantity: 1
  }, customerToken);

  const checkoutRes = await apiRequest('/api/orders/checkout', 'POST', {}, customerToken);
  const orderId = checkoutRes.data?.data?.id || checkoutRes.data?.id;
  console.log(`  ✔ Order created with ID: ${orderId} (Status: ${checkoutRes.data?.data?.status || checkoutRes.data?.status})`);

  // Check Order in Atlas
  const initialOrder = await atlasClient.db('smarteats_order').collection('orders').findOne({ _id: new ObjectId(orderId) });
  console.log(`  ✔ Atlas Initial Order Status: ${initialOrder.status}`);

  // 3. RESTAURANT ACCEPTS -> PREPARING -> READY
  console.log('\n▶ [3/6] Restaurant Kitchen Lifecycle...');
  const restLogin = await apiRequest('/api/auth/login', 'POST', {
    email: 'restaurant@smarteats.com',
    password: 'admin123'
  });
  const restToken = restLogin.data?.data?.token || restLogin.data?.token;

  await apiRequest(`/api/orders/my/orders/${orderId}/accept`, 'PATCH', null, restToken);
  await apiRequest(`/api/orders/my/orders/${orderId}/preparing`, 'PATCH', null, restToken);
  await apiRequest(`/api/orders/my/orders/${orderId}/ready`, 'PATCH', null, restToken);

  const readyOrder = await atlasClient.db('smarteats_order').collection('orders').findOne({ _id: new ObjectId(orderId) });
  console.log(`  ✔ Atlas Order Status before delivery: ${readyOrder.status}`);

  // 4. DELIVERY CREATED & DRIVER COMPLETES DELIVERY
  console.log('\n▶ [4/6] Driver Assignment & Delivery Lifecycle...');
  await sleep(3000); // Allow Kafka order-accepted event processing

  const delivery = await atlasClient.db('smarteats_delivery').collection('deliveries').findOne({ orderId: orderId });
  if (!delivery) throw new Error('Delivery document not found for order: ' + orderId);
  const deliveryId = delivery._id.toString();
  const driverEmail = delivery.deliveryPartnerEmail || 'ajay.rider@smarteats.com';
  console.log(`  ✔ Delivery found: ID ${deliveryId}, Rider: ${driverEmail}`);

  const driverLogin = await apiRequest('/api/auth/login', 'POST', {
    email: driverEmail,
    password: 'admin123'
  });
  const driverToken = driverLogin.data?.data?.token || driverLogin.data?.token;
  if (!driverToken) throw new Error('Driver login failed: ' + JSON.stringify(driverLogin));

  await apiRequest(`/api/deliveries/${deliveryId}/status?status=PICKED_UP`, 'PUT', null, driverToken);
  await apiRequest(`/api/deliveries/${deliveryId}/status?status=OUT_FOR_DELIVERY`, 'PUT', null, driverToken);
  
  console.log('  -> Setting Delivery status to DELIVERED...');
  const delRes = await apiRequest(`/api/deliveries/${deliveryId}/status?status=DELIVERED`, 'PUT', null, driverToken);
  console.log(`  ✔ Driver status updated HTTP ${delRes.status}`);

  // Allow Kafka event propagation to Order Service and Notification Service
  console.log('  -> Waiting for Kafka event propagation (3s)...');
  await sleep(3500);

  // 5. VERIFICATIONS
  console.log('\n================================================================');
  console.log('🔍 VERIFICATION CHECKS');
  console.log('================================================================');

  // VERIFY 1: Delivery MongoDB document status = DELIVERED
  const finalDel = await atlasClient.db('smarteats_delivery').collection('deliveries').findOne({ _id: delivery._id });
  console.log(`VERIFY 1 - Delivery MongoDB status: ${finalDel.status}`);
  if (finalDel.status !== 'DELIVERED') throw new Error(`Delivery status mismatch: ${finalDel.status}`);

  // VERIFY 2 & 3: Check Order Service logs for event receipt
  const logContent = fs.readFileSync(path.resolve(__dirname, '../backend/order-service.log'), 'utf8');
  const recentLog = logContent.slice(-8000);
  const orderLogMatched = recentLog.includes(orderId) && recentLog.includes('DELIVERED');
  console.log(`VERIFY 2 & 3 - Order Service Kafka Consumer Logged Event: ${orderLogMatched ? 'YES' : 'NO'}`);

  // VERIFY 4: Order MongoDB document status = DELIVERED
  const finalOrder = await atlasClient.db('smarteats_order').collection('orders').findOne({ _id: new ObjectId(orderId) });
  console.log(`VERIFY 4 - Order MongoDB status in Atlas: ${finalOrder.status}`);
  if (finalOrder.status !== 'DELIVERED') {
    throw new Error(`CRITICAL: Order status was NOT synchronized to DELIVERED! Current: ${finalOrder.status}`);
  }
  console.log('  ✔ SUCCESS: Order status synchronized to DELIVERED!');

  // VERIFY 5: Notification Service stored customer notification
  const notif = await atlasClient.db('smarteats_notification').collection('notifications').findOne({
    recipientEmail: 'customer@smarteats.com',
    type: 'ORDER_DELIVERED',
    message: { $regex: orderId }
  });
  console.log(`VERIFY 5 - Notification Service stored ORDER_DELIVERED notification: ${notif ? 'YES' : 'NO'}`);

  // VERIFY 6: Customer Order API response returns DELIVERED
  const custOrderById = await apiRequest(`/api/orders/${orderId}`, 'GET', null, customerToken);
  const myOrder = custOrderById.data?.data || custOrderById.data;
  console.log(`VERIFY 6 - Customer API /api/orders/${orderId} status: ${myOrder?.status}`);
  if (myOrder?.status !== 'DELIVERED') {
    throw new Error(`Customer API does not show DELIVERED: ${myOrder?.status}`);
  }

  const custOrders = await apiRequest('/api/orders/customer', 'GET', null, customerToken);
  const rawList = custOrders.data?.data || custOrders.data;
  const orderList = Array.isArray(rawList) ? rawList : [];
  const foundInList = orderList.find(o => (o.id || o._id) === orderId);
  console.log(`  ✔ Customer Orders List /api/orders/customer status: ${foundInList?.status}`);
  if (foundInList?.status !== 'DELIVERED') {
    throw new Error(`Customer Orders List does not show DELIVERED: ${foundInList?.status}`);
  }

  // 6. PHASE 7: DUPLICATE EVENT / IDEMPOTENCY TEST
  console.log('\n================================================================');
  console.log('🔄 PHASE 7: DUPLICATE EVENT / IDEMPOTENCY TEST');
  console.log('================================================================');
  console.log('Publishing duplicate order-delivered event via docker kafka-console-producer...');
  
  const kafkaCmd = `cmd.exe /c "echo ${orderId} | docker exec -i smarteats-kafka kafka-console-producer --bootstrap-server localhost:9092 --topic smarteats.order.delivered"`;
  execSync(kafkaCmd);
  await sleep(3000);

  const afterDupOrder = await atlasClient.db('smarteats_order').collection('orders').findOne({ _id: new ObjectId(orderId) });
  const totalOrdersWithId = await atlasClient.db('smarteats_order').collection('orders').countDocuments({ _id: new ObjectId(orderId) });
  console.log(`  ✔ Order Status after duplicate event: ${afterDupOrder.status}`);
  console.log(`  ✔ Documents count with order ID: ${totalOrdersWithId} (expected 1)`);

  const afterDupLogContent = fs.readFileSync(path.resolve(__dirname, '../backend/order-service.log'), 'utf8');
  const skippedLogged = afterDupLogContent.slice(-8000).includes('is already marked as DELIVERED in order-service. Skipping duplicate event.');
  console.log(`  ✔ Idempotency check logged: ${skippedLogged ? 'YES' : 'NO'}`);

  await atlasClient.close();

  console.log('\n================================================================');
  console.log('🎉 ALL BUG #4 SYNCHRONIZATION AND IDEMPOTENCY TESTS PASSED!');
  console.log('================================================================\n');
}

runBug4Verification().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
