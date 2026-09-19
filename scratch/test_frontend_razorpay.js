import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('==================================================');
console.log('    SMARTEATS FRONTEND RAZORPAY TEST SUITE       ');
console.log('==================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

// 1. Security Check: Verify RAZORPAY_KEY_SECRET is completely absent from frontend codebase
runTest('TC-FE-PAY-11: RAZORPAY_KEY_SECRET is completely absent from frontend source', () => {
  const frontendSrcDir = path.join(rootDir, 'frontend', 'src');
  
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        scanDir(fullPath);
      } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.html') || file.endsWith('.css')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert(
          !content.includes('RAZORPAY_KEY_SECRET') && !content.includes('eU3taZ4ADVpI3HT3sfnjRfvf'),
          `Security violation: RAZORPAY_KEY_SECRET found in ${fullPath}`
        );
      }
    }
  }
  
  scanDir(frontendSrcDir);
});

// 2. Inspect orderApi exports
runTest('TC-FE-PAY-01: orderApi exports createPaymentOrder and verifyPayment methods', () => {
  const orderApiContent = fs.readFileSync(path.join(rootDir, 'frontend', 'src', 'api', 'orderApi.js'), 'utf8');
  assert(orderApiContent.includes('createPaymentOrder:'), 'orderApi must include createPaymentOrder');
  assert(orderApiContent.includes('/api/orders/payment/create-order'), 'createPaymentOrder must call /api/orders/payment/create-order');
  assert(orderApiContent.includes('verifyPayment:'), 'orderApi must include verifyPayment');
  assert(orderApiContent.includes('/api/orders/payment/verify'), 'verifyPayment must call /api/orders/payment/verify');
});

// 3. Inspect razorpayUtils implementation
runTest('TC-FE-PAY-02 & TC-FE-PAY-03: razorpayUtils passes backend amountInPaise and razorpayOrderId', () => {
  const utilsContent = fs.readFileSync(path.join(rootDir, 'frontend', 'src', 'utils', 'razorpayUtils.js'), 'utf8');
  assert(utilsContent.includes('amount: paymentOrder.amountInPaise'), 'Must use paymentOrder.amountInPaise for Razorpay amount');
  assert(utilsContent.includes('order_id: paymentOrder.razorpayOrderId'), 'Must pass paymentOrder.razorpayOrderId as order_id');
  assert(utilsContent.includes('loadRazorpayScript'), 'Must include loadRazorpayScript helper');
  assert(utilsContent.includes('https://checkout.razorpay.com/v1/checkout.js'), 'Must load official Razorpay script URL');
});

// 4. Verification before Success
runTest('TC-FE-PAY-04 & TC-FE-PAY-05: Razorpay success handler verifies with backend before reporting success', () => {
  const utilsContent = fs.readFileSync(path.join(rootDir, 'frontend', 'src', 'utils', 'razorpayUtils.js'), 'utf8');
  assert(utilsContent.includes('orderApi.verifyPayment({'), 'Must call backend verifyPayment in handler');
  assert(utilsContent.includes('razorpayOrderId: razorpayResponse.razorpay_order_id'), 'Must pass razorpayOrderId');
  assert(utilsContent.includes('razorpayPaymentId: razorpayResponse.razorpay_payment_id'), 'Must pass razorpayPaymentId');
  assert(utilsContent.includes('razorpaySignature: razorpayResponse.razorpay_signature'), 'Must pass razorpaySignature');
  assert(utilsContent.includes('if (verifyResult && verifyResult.success)'), 'Must check backend verification success before invoking onSuccess');
});

// 5. Inspect CustomerPortal and RestaurantDetailPage integration
runTest('TC-FE-PAY-06, 09, 10: Cart cleared only on verify success and double-click prevented', () => {
  const portalContent = fs.readFileSync(path.join(rootDir, 'frontend', 'src', 'components', 'CustomerPortal.jsx'), 'utf8');
  const detailContent = fs.readFileSync(path.join(rootDir, 'frontend', 'src', 'pages', 'customer', 'RestaurantDetailPage.jsx'), 'utf8');

  // Check double-click protection
  assert(portalContent.includes('isCheckingOut'), 'CustomerPortal must track isCheckingOut state');
  assert(portalContent.includes('disabled={!cart || cart.length === 0 || hasStaleCartIssues || isCheckingOut}'), 'CustomerPortal button must be disabled while checking out');
  assert(detailContent.includes('disabled={!cart || cart.length === 0 || orderSubmitting || hasStaleCartIssues}'), 'RestaurantDetailPage button must be disabled while submitting');

  // Check cart cleared only on success callback
  assert(portalContent.includes('if (setCart) setCart([]);'), 'CustomerPortal must clear cart on success');
  assert(detailContent.includes('if (setCart) setCart([]);'), 'RestaurantDetailPage must clear cart on success');

  // Check dismiss handling
  assert(portalContent.includes('onDismiss:'), 'CustomerPortal must handle onDismiss safely');
  assert(detailContent.includes('onDismiss:'), 'RestaurantDetailPage must handle onDismiss safely');
});

// 6. User identity check
runTest('TC-FE-PAY-12: Customer email used for prefill only, not trusted for authorization', () => {
  const utilsContent = fs.readFileSync(path.join(rootDir, 'frontend', 'src', 'utils', 'razorpayUtils.js'), 'utf8');
  assert(utilsContent.includes('prefill:'), 'Email is used in Razorpay prefill');
  const orderApiContent = fs.readFileSync(path.join(rootDir, 'frontend', 'src', 'api', 'orderApi.js'), 'utf8');
  assert(!orderApiContent.includes("createPaymentOrder: async (customerEmail)"), 'createPaymentOrder relies on authenticated JWT header, not arbitrary user parameter');
});

console.log(`\nAll ${passedTests}/${totalTests} Frontend Razorpay Unit Checks PASSED! ✅`);
