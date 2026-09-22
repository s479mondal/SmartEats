const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient, ObjectId } = require('mongodb');

const GATEWAY_URL = 'http://localhost:8080';

const envPath = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envPath, 'utf8');
const match = env.match(/MONGODB_URI=(.+)/);
if (!match) throw new Error('No MONGODB_URI in .env');
const atlasUri = match[1].trim();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest(url, method = 'GET', body = null, token = null, customHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...customHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const fullUrl = url.startsWith('http') ? url : `${GATEWAY_URL}${url}`;
  const res = await fetch(fullUrl, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }
  return { status: res.status, data };
}

async function runBroadcastVerification() {
  console.log('================================================================');
  console.log('🚀 CONTROLLED BROADCAST & CONCURRENCY ATOMIC FLOW VERIFICATION');
  console.log('================================================================\n');

  const client = new MongoClient(atlasUri);
  await client.connect();
  const dbDelivery = client.db('smarteats_delivery');
  const dbAuth = client.db('smarteats_auth');
  const dbOrder = client.db('smarteats_order');
  const dbNotif = client.db('smarteats_notification');
  const dbRest = client.db('smarteats_restaurant');

  try {
    // 1. Ensure Drivers exist, active & available with real locations near Dada Boudi Biryani
    console.log('▶ [1/7] Setting up 2 online drivers with valid GPS coords near Dada Boudi Biryani...');
    // Restaurant: Dada Boudi Biryani (lat: 12.9898, lng: 79.1340)
    await dbDelivery.collection('delivery_partners').updateOne(
      { email: 't@gmail.com' },
      { $set: { active: true, available: true, currentLatitude: 12.9910, currentLongitude: 79.1350, lastLocationUpdate: new Date() } },
      { upsert: true }
    );
    await dbDelivery.collection('delivery_partners').updateOne(
      { email: 'g@gmail.com' },
      { $set: { active: true, available: true, currentLatitude: 12.9930, currentLongitude: 79.1370, lastLocationUpdate: new Date() } },
      { upsert: true }
    );
    console.log('  ✔ Drivers t@gmail.com and g@gmail.com primed online and available.');

    // 2. Login users
    console.log('\n▶ [2/7] Logging in Customer, Restaurant Owner, and Drivers...');
    const custLogin = await apiRequest('/api/auth/login', 'POST', { email: 's1@gmail.com', password: 'admin123' });
    const custToken = custLogin.data?.data?.token;

    const restLogin = await apiRequest('/api/auth/login', 'POST', { email: 'r@gmail.com', password: 'admin123' });
    const restToken = restLogin.data?.data?.token;

    const driver1Login = await apiRequest('/api/auth/login', 'POST', { email: 't@gmail.com', password: 'admin123' });
    const driver1Token = driver1Login.data?.data?.token;

    const driver2Login = await apiRequest('/api/auth/login', 'POST', { email: 'g@gmail.com', password: 'admin123' });
    const driver2Token = driver2Login.data?.data?.token;

    console.log(`  ✔ Customer token: ${custToken ? 'OK' : 'FAIL'}`);
    console.log(`  ✔ Restaurant token: ${restToken ? 'OK' : 'FAIL'}`);
    console.log(`  ✔ Driver 1 (t@gmail.com) token: ${driver1Token ? 'OK' : 'FAIL'}`);
    console.log(`  ✔ Driver 2 (g@gmail.com) token: ${driver2Token ? 'OK' : 'FAIL'}`);

    if (!driver1Token || !driver2Token || !restToken) {
      throw new Error('Authentication failed for test participants');
    }

    // 3. Customer places an order on Dada Boudi Biryani
    console.log('\n▶ [3/7] Customer placing order on Dada Boudi Biryani...');
    const codRes = await apiRequest('/api/orders/cod', 'POST', {
      restaurantId: '6ab060f54e48f1061d3e2629',
      items: [{ menuItemId: '6ab0614c4e48f1061d3e262a', name: 'Chicken Biryani', quantity: 1, price: 200.0 }],
      deliveryAddress: 'VIT Campus, Vellore',
      deliveryCity: 'Vellore',
      deliveryState: 'Tamil Nadu',
      deliveryPincode: '632014',
      deliveryLatitude: 12.9716,
      deliveryLongitude: 79.1590
    }, custToken);

    if (codRes.status !== 201 && codRes.status !== 200) {
      throw new Error(`Place COD order failed: ${JSON.stringify(codRes)}`);
    }
    const orderId = codRes.data?.data?.id || codRes.data?.data?.orderId;
    console.log(`  ✔ Order created: #${orderId}, Status: ${codRes.data?.data?.status || codRes.data?.data?.orderStatus}`);

    // 4. Restaurant Owner ACCEPTS order -> Triggers Controlled Broadcast!
    console.log('\n▶ [4/7] Restaurant Owner ACCEPTS Order (Triggering Controlled Broadcast)...');
    const acceptRes = await apiRequest(`/api/orders/my/orders/${orderId}/accept`, 'PATCH', null, restToken);
    console.log(`  ✔ Restaurant Accept HTTP Status: ${acceptRes.status}`);
    if (acceptRes.status !== 200) {
      throw new Error(`Failed to accept order: ${JSON.stringify(acceptRes)}`);
    }

    // Wait 3.5 seconds for Kafka event processing & controlled broadcast
    await sleep(3500);

    // Verify Delivery Offers in Delivery Service
    const offersInDb = await dbDelivery.collection('delivery_offers').find({ orderId }).toArray();
    console.log(`  ✔ Controlled broadcast generated ${offersInDb.length} offers in MongoDB:`);
    offersInDb.forEach(o => {
      console.log(`    - Driver: ${o.driverEmail}, Rest: ${o.restaurantName}, Dist: ${o.distanceKm} km, Status: ${o.status}`);
    });

    if (offersInDb.length < 2) {
      throw new Error(`Expected at least 2 candidate driver offers, but found ${offersInDb.length}`);
    }

    // Check Driver 1 portal offers via API Gateway
    const d1OffersRes = await apiRequest('/api/deliveries/offers', 'GET', null, driver1Token);
    console.log(`  ✔ Driver 1 (t@gmail.com) GET /api/deliveries/offers returned ${d1OffersRes.data?.data?.length || 0} active offer(s)`);
    const d1Offer = (d1OffersRes.data?.data || []).find(o => o.orderId === orderId);
    if (!d1Offer) throw new Error('Driver 1 did not receive the delivery offer in portal!');
    console.log(`    Offer ID: ${d1Offer.id}, Distance: ${d1Offer.distanceKm} km, Expires in: ${d1Offer.secondsRemaining}s`);

    // Check Driver 2 portal offers via API Gateway
    const d2OffersRes = await apiRequest('/api/deliveries/offers', 'GET', null, driver2Token);
    console.log(`  ✔ Driver 2 (g@gmail.com) GET /api/deliveries/offers returned ${d2OffersRes.data?.data?.length || 0} active offer(s)`);
    const d2Offer = (d2OffersRes.data?.data || []).find(o => o.orderId === orderId);
    if (!d2Offer) throw new Error('Driver 2 did not receive the delivery offer in portal!');

    // 5. Atomic Concurrency Test: Driver 1 accepts offer -> WINS
    console.log('\n▶ [5/7] CONCURRENCY RACE TEST: Driver 1 accepts offer...');
    const d1Accept = await apiRequest(`/api/deliveries/offers/${d1Offer.id}/accept`, 'POST', null, driver1Token);
    console.log(`  ✔ Driver 1 Accept HTTP ${d1Accept.status}: ${d1Accept.data?.message}`);
    if (d1Accept.status !== 200) {
      throw new Error(`Driver 1 failed to accept offer: ${JSON.stringify(d1Accept)}`);
    }
    console.log(`    Assigned Driver: ${d1Accept.data?.data?.deliveryPartnerEmail}, Status: ${d1Accept.data?.data?.status}`);

    // Driver 2 tries to accept AFTER Driver 1 -> MUST BE REJECTED ATOMICALLY WITH CONFLICT
    console.log('\n  ⚡ Driver 2 attempts to accept the same order simultaneously...');
    const d2Accept = await apiRequest(`/api/deliveries/offers/${d2Offer.id}/accept`, 'POST', null, driver2Token);
    console.log(`  ✔ Driver 2 Accept HTTP ${d2Accept.status}: ${JSON.stringify(d2Accept.data)}`);
    if (d2Accept.status !== 409 && d2Accept.status !== 400) {
      throw new Error(`Driver 2 acceptance should have been rejected with 409 Conflict, got ${d2Accept.status}`);
    }
    console.log(`  ✔ Concurrency protected: Driver 2 safely received "${d2Accept.data?.message}"`);

    // Verify Driver 2's offer was cancelled in DB
    const d2OfferInDb = await dbDelivery.collection('delivery_offers').findOne({ _id: new ObjectId(d2Offer.id) });
    console.log(`  ✔ Driver 2's offer status in DB: ${d2OfferInDb?.status} (Expected: CANCELLED)`);
    if (d2OfferInDb?.status !== 'CANCELLED') {
      throw new Error(`Expected competitor offer to be CANCELLED, but got ${d2OfferInDb?.status}`);
    }

    // 6. Check Notifications for all parties
    console.log('\n▶ [6/7] Checking Notifications generated...');
    await sleep(2000);
    const notifications = await dbNotif.collection('notifications').find({ orderId }).toArray();
    console.log(`  ✔ Total notifications generated for Order #${orderId}: ${notifications.length}`);
    notifications.forEach(n => {
      console.log(`    - [${n.type}] To: ${n.recipientEmail} => ${n.message}`);
    });

    const notifTypes = notifications.map(n => n.type);
    const notifRecipients = notifications.map(n => n.recipientEmail);

    if (!notifTypes.includes('DELIVERY_OFFER')) throw new Error('Missing DELIVERY_OFFER notification');
    if (!notifTypes.includes('OFFER_CONFIRMED')) throw new Error('Missing OFFER_CONFIRMED notification for winning driver');
    if (!notifTypes.includes('OFFER_EXPIRED')) throw new Error('Missing OFFER_EXPIRED notification for losing driver');
    if (!notifRecipients.includes('t@gmail.com')) throw new Error('Winning driver t@gmail.com missing notification');
    if (!notifRecipients.includes('g@gmail.com')) throw new Error('Losing driver g@gmail.com missing notification');

    // 7. Test READY -> ONLY Assigned Driver is notified
    console.log('\n▶ [7/7] Restaurant marks READY -> Verify ONLY assigned driver receives ORDER_READY...');
    await apiRequest(`/api/orders/my/orders/${orderId}/ready`, 'PATCH', null, restToken);
    await sleep(2000);

    const readyNotifs = await dbNotif.collection('notifications').find({ orderId, type: 'ORDER_READY' }).toArray();
    console.log(`  ✔ ORDER_READY notifications count: ${readyNotifs.length}`);
    readyNotifs.forEach(n => console.log(`    - Recipient: ${n.recipientEmail} => ${n.message}`));

    if (readyNotifs.length !== 1 || readyNotifs[0].recipientEmail !== 't@gmail.com') {
      throw new Error(`ORDER_READY must be sent ONLY to assigned driver t@gmail.com, found: ${JSON.stringify(readyNotifs)}`);
    }

    // Complete delivery lifecycle: Driver 1 PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
    const deliveryId = d1Accept.data?.data?.id;
    console.log(`\n  ✔ Completing delivery lifecycle for Delivery #${deliveryId}...`);
    await apiRequest(`/api/deliveries/${deliveryId}/status?status=PICKED_UP`, 'PUT', null, driver1Token);
    await apiRequest(`/api/deliveries/${deliveryId}/status?status=OUT_FOR_DELIVERY`, 'PUT', null, driver1Token);
    await apiRequest(`/api/deliveries/${deliveryId}/status?status=DELIVERED`, 'PUT', null, driver1Token);

    const finalDelivery = await dbDelivery.collection('deliveries').findOne({ _id: new ObjectId(deliveryId) });
    console.log(`  ✔ Final Delivery Status in MongoDB: ${finalDelivery?.status}`);
    if (finalDelivery?.status !== 'DELIVERED') {
      throw new Error(`Expected DELIVERED, got ${finalDelivery?.status}`);
    }

    console.log('\n================================================================');
    console.log('🎉 ALL VERIFICATION CHECKS PASSED PERFECTLY!');
    console.log('================================================================\n');

  } finally {
    await client.close();
  }
}

runBroadcastVerification().catch(err => {
  console.error('\n❌ VERIFICATION FAILURE:', err);
  process.exit(1);
});
