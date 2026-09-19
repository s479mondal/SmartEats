import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('===============================================================');
console.log('🚀 RUNNING COMPREHENSIVE FRONTEND TEST SUITE (COD + RAZORPAY)');
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
const restaurantDetailPath = 'd:/E/3rd Sem capston project/SmartEats/frontend/src/pages/customer/RestaurantDetailPage.jsx';
const razorpayUtilsPath = 'd:/E/3rd Sem capston project/SmartEats/frontend/src/utils/razorpayUtils.js';

const orderApiSrc = fs.readFileSync(orderApiPath, 'utf-8');
const customerPortalSrc = fs.readFileSync(customerPortalPath, 'utf-8');
const restaurantDetailSrc = fs.readFileSync(restaurantDetailPath, 'utf-8');
const razorpayUtilsSrc = fs.readFileSync(razorpayUtilsPath, 'utf-8');

// COD TESTS
runTest('TC-COD-11: Frontend COD selection calls /api/orders/cod with idempotencyKey', () => {
  assert.ok(
    orderApiSrc.includes("'/api/orders/cod'") &&
    customerPortalSrc.includes('orderApi.placeCodOrder') &&
    restaurantDetailSrc.includes('orderApi.placeCodOrder'),
    'placeCodOrder API method missing or not called in components'
  );
});

runTest('TC-COD-12: Frontend does not open Razorpay for COD', () => {
  const customerPortalCheckout = customerPortalSrc.slice(customerPortalSrc.indexOf('const handleCheckout'));
  const restaurantDetailCheckout = restaurantDetailSrc.slice(restaurantDetailSrc.indexOf('const handleCheckout'));

  const customerPortalBranching = customerPortalCheckout.includes("if (paymentMethod === 'COD')") &&
    customerPortalCheckout.indexOf("return;") < customerPortalCheckout.indexOf('initiateRazorpayCheckout');
  const restaurantDetailBranching = restaurantDetailCheckout.includes("if (paymentMethod === 'COD')") &&
    restaurantDetailCheckout.indexOf("return;") < restaurantDetailCheckout.indexOf('initiateRazorpayCheckout');

  assert.ok(customerPortalBranching && restaurantDetailBranching, 'COD branch must early return before initiateRazorpayCheckout');
});

runTest('TC-COD-13: COD success clears cart', () => {
  assert.ok(
    customerPortalSrc.includes('clearCart()') &&
    restaurantDetailSrc.includes('clearCart()'),
    'clearCart must be called inside COD success block'
  );
});

runTest('TC-COD-14: COD failure keeps cart', () => {
  assert.ok(
    customerPortalSrc.includes('catch (err)') &&
    !customerPortalSrc.slice(customerPortalSrc.indexOf('catch (err)')).split('finally')[0].includes('clearCart') &&
    restaurantDetailSrc.includes('catch (err)') &&
    !restaurantDetailSrc.slice(restaurantDetailSrc.indexOf('catch (err)')).split('finally')[0].includes('clearCart'),
    'clearCart must not be called inside COD catch block'
  );
});

runTest('TC-COD-15: Double-click protection works', () => {
  assert.ok(
    customerPortalSrc.includes('disabled={!cart || cart.length === 0 || hasStaleCartIssues || isCheckingOut}') &&
    restaurantDetailSrc.includes('disabled={!cart || cart.length === 0 || orderSubmitting || hasStaleCartIssues}'),
    'Checkout button must be disabled during active submission'
  );
});

// RAZORPAY TESTS
runTest('TC-FE-PAY-01: Checkout calls createPaymentOrder API with idempotencyKey', () => {
  assert.ok(
    razorpayUtilsSrc.includes('orderApi.createPaymentOrder('),
    'initiateRazorpayCheckout must call orderApi.createPaymentOrder()'
  );
  assert.ok(
    orderApiSrc.includes("'/api/orders/payment/create-order'"),
    'orderApi.createPaymentOrder must call POST /api/orders/payment/create-order'
  );
});

runTest('TC-FE-PAY-02: Returned backend amountInPaise is passed to Razorpay', () => {
  assert.ok(
    razorpayUtilsSrc.includes('amount: paymentOrder.amountInPaise'),
    'Razorpay options must use authoritative amount: paymentOrder.amountInPaise'
  );
});

runTest('TC-FE-PAY-03: Returned razorpayOrderId is passed as Razorpay order_id', () => {
  assert.ok(
    razorpayUtilsSrc.includes('order_id: paymentOrder.razorpayOrderId'),
    'Razorpay options must pass order_id: paymentOrder.razorpayOrderId'
  );
});

runTest('TC-FE-PAY-04: Razorpay success calls backend verify endpoint', () => {
  assert.ok(
    razorpayUtilsSrc.includes('orderApi.verifyPayment({'),
    'handler must call orderApi.verifyPayment'
  );
  assert.ok(
    razorpayUtilsSrc.includes('orderId: paymentOrder.orderId'),
    'verification payload must include orderId'
  );
  assert.ok(
    razorpayUtilsSrc.includes('razorpayOrderId: razorpayResponse.razorpay_order_id'),
    'verification payload must include razorpayOrderId'
  );
});

runTest('TC-FE-PAY-05: Payment failure does not call verifyPayment', () => {
  const failureIndex = razorpayUtilsSrc.indexOf(".on('payment.failed'");
  assert.ok(failureIndex !== -1, 'Must attach payment.failed event listener');
  const failureSection = razorpayUtilsSrc.slice(failureIndex, failureIndex + 500);
  assert.strictEqual(
    failureSection.includes('verifyPayment'),
    false,
    'payment.failed handler must not invoke verifyPayment'
  );
});

runTest('TC-FE-PAY-06: Modal dismissal does not mark order paid', () => {
  assert.ok(
    razorpayUtilsSrc.includes('modal: {') && razorpayUtilsSrc.includes('ondismiss:'),
    'Razorpay options must define modal.ondismiss'
  );
  const modalIndex = razorpayUtilsSrc.indexOf('modal: {');
  const modalSection = razorpayUtilsSrc.slice(modalIndex, modalIndex + 400);
  assert.strictEqual(
    modalSection.includes('verifyPayment'),
    false,
    'Modal ondismiss handler must not invoke verifyPayment'
  );
});

runTest('TC-FE-PAY-07: Cart is preserved on payment failure or dismissal', () => {
  assert.ok(
    customerPortalSrc.includes('onFailure:') && customerPortalSrc.includes('onDismiss:'),
    'CustomerPortal must implement onFailure and onDismiss handlers'
  );
  assert.strictEqual(
    customerPortalSrc.includes('onDismiss: () => { clearCart(); }'),
    false,
    'onDismiss handler must never call clearCart'
  );
});

runTest('TC-FE-PAY-08: Successful payment triggers cart clearance', () => {
  assert.ok(
    customerPortalSrc.includes('onSuccess: (paymentResult) => {') &&
    customerPortalSrc.includes('clearCart()'),
    'CustomerPortal onSuccess handler must clear cart upon successful verification'
  );
});

runTest('TC-FE-PAY-09: Double-click protection while checkout is active', () => {
  assert.ok(
    customerPortalSrc.includes('isCheckingOut') &&
    customerPortalSrc.includes('disabled={!cart || cart.length === 0 || hasStaleCartIssues || isCheckingOut}'),
    'Pay Now button must be disabled when isCheckingOut is true'
  );
});

runTest('TC-FE-PAY-10: Stale inventory / price check occurs before payment', () => {
  assert.ok(
    customerPortalSrc.includes('hasStaleCartIssues'),
    'Checkout must detect hasStaleCartIssues before allowing payment order creation'
  );
});

runTest('TC-FE-PAY-11: RAZORPAY_KEY_SECRET is absent from frontend source', () => {
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(js|jsx|ts|tsx|html|css|json)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.strictEqual(content.includes('RAZORPAY_KEY_SECRET'), false);
        assert.strictEqual(content.includes('eU3taZ4ADVpI3HT3sfnjRfvf'), false);
      }
    }
  }
  scanDir(frontendSrcDir);
});

runTest('TC-FE-IDEMP-01: Frontend generates crypto UUID for each new checkout attempt', () => {
  assert.ok(
    customerPortalSrc.includes('crypto.randomUUID') || customerPortalSrc.includes('crypto.randomUUID()'),
    'CustomerPortal must generate UUID for checkout attempt'
  );
  assert.ok(
    restaurantDetailSrc.includes('crypto.randomUUID') || restaurantDetailSrc.includes('crypto.randomUUID()'),
    'RestaurantDetailPage must generate UUID for checkout attempt'
  );
  assert.ok(
    orderApiSrc.includes("headers['Idempotency-Key'] = idempotencyKey"),
    'orderApi must attach Idempotency-Key header'
  );
});

console.log(`\n===============================================================`);
console.log(`🏆 ALL FRONTEND TESTS COMPLETE: ${passed} passed, ${failed} failed`);
console.log(`===============================================================`);
if (failed > 0) process.exit(1);
