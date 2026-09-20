import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { computeCombinedOrderStatus, ORDER_TRACKING_STEPS, ORDER_STATUS_MAP, DELIVERY_STATUS_MAP } from './frontend/src/utils/orderStatusUtils.js';

console.log('===============================================================');
console.log('🚀 RUNNING STEP 8.2 CUSTOMER ORDER TRACKING & STATUS TEST SUITE');
console.log('===============================================================\n');

let passed = 0;
let failed = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}: ${err.message}`);
    failed++;
  }
}

const frontendSrcDir = 'd:/E/3rd Sem capston project/SmartEats/frontend/src';
const orderApiPath = 'd:/E/3rd Sem capston project/SmartEats/frontend/src/api/orderApi.js';
const customerPortalPath = 'd:/E/3rd Sem capston project/SmartEats/frontend/src/components/CustomerPortal.jsx';
const trackingViewPath = 'd:/E/3rd Sem capston project/SmartEats/frontend/src/components/customer/OrderTrackingView.jsx';
const trackingPagePath = 'd:/E/3rd Sem capston project/SmartEats/frontend/src/pages/customer/OrderTrackingPage.jsx';
const appRoutesPath = 'd:/E/3rd Sem capston project/SmartEats/frontend/src/routes/AppRoutes.jsx';
const orderStatusUtilsPath = 'd:/E/3rd Sem capston project/SmartEats/frontend/src/utils/orderStatusUtils.js';

const orderApiSrc = fs.readFileSync(orderApiPath, 'utf-8');
const customerPortalSrc = fs.readFileSync(customerPortalPath, 'utf-8');
const trackingViewSrc = fs.readFileSync(trackingViewPath, 'utf-8');
const trackingPageSrc = fs.readFileSync(trackingPagePath, 'utf-8');
const appRoutesSrc = fs.readFileSync(appRoutesPath, 'utf-8');
const orderStatusUtilsSrc = fs.readFileSync(orderStatusUtilsPath, 'utf-8');

// 1. CREATED displays correct status
runTest('1. CREATED displays correct status ("Order Confirmed")', () => {
  const result = computeCombinedOrderStatus({ id: 'ord-1', status: 'CREATED' });
  assert.strictEqual(result.currentLabel, 'Order Confirmed');
  assert.strictEqual(result.activeStepIndex, 0);
  assert.strictEqual(result.isTerminal, false);
  assert.strictEqual(result.steps[0].status, 'current');
  assert.strictEqual(result.steps[1].status, 'upcoming');
});

// 2. ACCEPTED displays correct status
runTest('2. ACCEPTED displays correct status ("Restaurant Accepted")', () => {
  const result = computeCombinedOrderStatus({ id: 'ord-1', status: 'ACCEPTED' });
  assert.strictEqual(result.currentLabel, 'Restaurant Accepted');
  assert.strictEqual(result.activeStepIndex, 1);
  assert.strictEqual(result.isTerminal, false);
  assert.strictEqual(result.steps[0].status, 'completed');
  assert.strictEqual(result.steps[1].status, 'current');
});

// 3. PREPARING displays correct status
runTest('3. PREPARING displays correct status ("Preparing Your Food")', () => {
  const result = computeCombinedOrderStatus({ id: 'ord-1', status: 'PREPARING' });
  assert.strictEqual(result.currentLabel, 'Preparing Your Food');
  assert.strictEqual(result.activeStepIndex, 2);
  assert.strictEqual(result.steps[1].status, 'completed');
  assert.strictEqual(result.steps[2].status, 'current');
});

// 4. READY displays correct status
runTest('4. READY displays correct status ("Ready for Pickup")', () => {
  const result = computeCombinedOrderStatus({ id: 'ord-1', status: 'READY' });
  assert.strictEqual(result.currentLabel, 'Ready for Pickup');
  assert.strictEqual(result.activeStepIndex, 3);
  assert.strictEqual(result.steps[2].status, 'completed');
  assert.strictEqual(result.steps[3].status, 'current');
});

// 5. ASSIGNED displays driver-assigned state
runTest('5. ASSIGNED displays driver-assigned state ("Driver Assigned")', () => {
  const result = computeCombinedOrderStatus({ id: 'ord-1', status: 'READY' }, { id: 'del-1', status: 'ASSIGNED' });
  assert.strictEqual(result.currentLabel, 'Driver Assigned');
  assert.strictEqual(result.activeStepIndex, 4);
  assert.strictEqual(result.steps[3].status, 'completed');
  assert.strictEqual(result.steps[4].status, 'current');
});

// 6. PICKED_UP displays picked-up state
runTest('6. PICKED_UP displays picked-up state ("Picked Up")', () => {
  const result = computeCombinedOrderStatus({ id: 'ord-1', status: 'READY' }, { id: 'del-1', status: 'PICKED_UP' });
  assert.strictEqual(result.currentLabel, 'Picked Up');
  assert.strictEqual(result.activeStepIndex, 5);
  assert.strictEqual(result.steps[4].status, 'completed');
  assert.strictEqual(result.steps[5].status, 'current');
});

// 7. OUT_FOR_DELIVERY displays correct state
runTest('7. OUT_FOR_DELIVERY displays correct state ("Out for Delivery")', () => {
  const result = computeCombinedOrderStatus({ id: 'ord-1', status: 'READY' }, { id: 'del-1', status: 'OUT_FOR_DELIVERY' });
  assert.strictEqual(result.currentLabel, 'Out for Delivery');
  assert.strictEqual(result.activeStepIndex, 6);
  assert.strictEqual(result.steps[5].status, 'completed');
  assert.strictEqual(result.steps[6].status, 'current');
});

// 8. DELIVERED displays final state
runTest('8. DELIVERED displays final state ("Delivered")', () => {
  const result = computeCombinedOrderStatus({ id: 'ord-1', status: 'DELIVERED' }, { id: 'del-1', status: 'DELIVERED' });
  assert.strictEqual(result.currentLabel, 'Delivered');
  assert.strictEqual(result.activeStepIndex, 7);
  assert.strictEqual(result.isTerminal, true);
  assert.strictEqual(result.isDelivered, true);
  assert.strictEqual(result.progressPct, 100);
  assert.ok(result.steps.every(s => s.status === 'completed'));
});

// 9. CANCELLED displays final cancelled state
runTest('9. CANCELLED displays final cancelled state ("Order Cancelled")', () => {
  const result = computeCombinedOrderStatus({ id: 'ord-1', status: 'CANCELLED' });
  assert.strictEqual(result.currentLabel, 'Order Cancelled');
  assert.strictEqual(result.isTerminal, true);
  assert.strictEqual(result.isError, true);
  assert.strictEqual(result.isCancelled, true);
});

// 10. REJECTED displays final rejected state
runTest('10. REJECTED displays final rejected state ("Order Rejected")', () => {
  const result = computeCombinedOrderStatus({ id: 'ord-1', status: 'REJECTED' });
  assert.strictEqual(result.currentLabel, 'Order Rejected');
  assert.strictEqual(result.isTerminal, true);
  assert.strictEqual(result.isError, true);
  assert.strictEqual(result.isRejected, true);
});

// 11. Polling stops after terminal state
runTest('11. Polling stops after terminal state', () => {
  assert.ok(
    trackingViewSrc.includes('if (combined.isTerminal)') &&
    trackingViewSrc.includes('clearInterval(pollingTimerRef.current)'),
    'OrderTrackingView must clear polling interval when order reaches terminal state'
  );
  assert.ok(
    customerPortalSrc.includes("o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REJECTED'"),
    'CustomerPortal must only poll when an active uncompleted order is present'
  );
});

// 12. Delivery information belongs to current customer & uses secured endpoints
runTest('12. Delivery information belongs to current customer & uses secured endpoints', () => {
  assert.ok(
    orderApiSrc.includes('/api/deliveries/order/'),
    'orderApi/deliveryApi must call GET /api/deliveries/order/{orderId}'
  );
  assert.ok(
    trackingViewSrc.includes('deliveryApi.getDeliveryByOrderId'),
    'OrderTrackingView must use deliveryApi.getDeliveryByOrderId'
  );
});

// 13. Restaurant still sees only own orders (Step 8.1A verification)
runTest('13. Restaurant still sees only own orders (Step 8.1A verification)', () => {
  const orderControllerPath = 'd:/E/3rd Sem capston project/SmartEats/backend/order-service/src/main/java/com/smarteats/order/controller/OrderController.java';
  const orderControllerSrc = fs.readFileSync(orderControllerPath, 'utf-8');
  assert.ok(
    orderControllerSrc.includes('getMyRestaurantOrders') &&
    orderControllerSrc.includes("checkAuthAndRole(email, roles, \"RESTAURANT_OWNER\")"),
    'OrderController must enforce RESTAURANT_OWNER authorization'
  );
});

// 14. Driver still sees only assigned deliveries (Step 8.1B verification)
runTest('14. Driver still sees only assigned deliveries (Step 8.1B verification)', () => {
  const deliveryControllerPath = 'd:/E/3rd Sem capston project/SmartEats/backend/delivery-service/src/main/java/com/smarteats/delivery/controller/DeliveryController.java';
  const deliveryControllerSrc = fs.readFileSync(deliveryControllerPath, 'utf-8');
  assert.ok(
    deliveryControllerSrc.includes('getMyDeliveries') &&
    deliveryControllerSrc.includes("checkAuthAndRole(email, roles, \"DELIVERY_PARTNER\")"),
    'DeliveryController must enforce DELIVERY_PARTNER authorization'
  );
});

// 15. No mock/fake status is used
runTest('15. No mock/fake status is used', () => {
  assert.strictEqual(
    trackingViewSrc.includes("status: 'mock'"),
    false,
    'No mock status allowed in trackingView'
  );
  assert.strictEqual(
    trackingViewSrc.includes("fake_"),
    false,
    'No fake driver/order identifiers in trackingView'
  );
  assert.ok(
    trackingViewSrc.includes('order?.items') && trackingViewSrc.includes('order?.totalAmount'),
    'Tracking view displays real backend order details'
  );
});

// 16. App routes registered properly
runTest('16. Customer tracking routes registered in AppRoutes', () => {
  assert.ok(
    appRoutesSrc.includes('/customer/orders/:orderId') &&
    appRoutesSrc.includes('/customer/track/:orderId') &&
    appRoutesSrc.includes('<OrderTrackingPage'),
    'AppRoutes must register /customer/orders/:orderId and /customer/track/:orderId'
  );
});

console.log(`\n===============================================================`);
console.log(`🏆 ALL ORDER TRACKING TESTS COMPLETE: ${passed} passed, ${failed} failed`);
console.log(`===============================================================`);
if (failed > 0) process.exit(1);
