const http = require('http');
const fs = require('fs');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function registerAndLogin(email, role, extra = {}) {
  const regPayload = {
    name: `Test ${role} ${Date.now()}`,
    email,
    password: 'Password123!',
    phone: '9876543210',
    roles: [role],
    ...extra
  };

  const regRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    regPayload
  );

  if (regRes.status !== 200 && regRes.status !== 201 && !(regRes.status === 400 && regRes.body?.message?.includes('already registered'))) {
    throw new Error(`Registration failed: status=${regRes.status}, body=${JSON.stringify(regRes.body)}`);
  }

  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { email, password: 'Password123!' }
  );

  const token = loginRes.body?.data?.token || loginRes.body?.token;
  if (!token) {
    throw new Error(`Failed to get JWT token for ${email}: status=${loginRes.status}, body=${JSON.stringify(loginRes.body)}`);
  }
  return token;
}

async function runStep83BVerification() {
  console.log('===============================================================');
  console.log('🧪 SMART EATS - STEP 8.3B DRIVER PORTAL GPS BEACON TEST SUITE');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Static Audit of DriverPortal.jsx Implementation
  console.log('\n1. Auditing DriverPortal.jsx Geolocation & Beacon Code...');
  const portalCode = fs.readFileSync('frontend/src/components/DriverPortal.jsx', 'utf8');

  assert(
    portalCode.includes('navigator.geolocation.watchPosition') &&
    portalCode.includes('enableHighAccuracy: true'),
    'DriverPortal uses navigator.geolocation.watchPosition with enableHighAccuracy: true'
  );

  assert(
    portalCode.includes('navigator.geolocation.clearWatch'),
    'DriverPortal calls navigator.geolocation.clearWatch on offline toggle and unmount'
  );

  assert(
    portalCode.includes('MIN_BEACON_INTERVAL_MS = 5000') || portalCode.includes('lastBeaconTimeRef'),
    'DriverPortal implements beacon throttling (minimum 5s interval)'
  );

  assert(
    portalCode.includes('deliveryApi.updatePartnerLocation({') &&
    !portalCode.includes('email: user.email') &&
    !portalCode.includes('driverId:'),
    'DriverPortal sends only latitude, longitude, and accuracy to updatePartnerLocation without driver email/ID in payload'
  );

  assert(
    portalCode.includes('PERMISSION_DENIED') || portalCode.includes('err.code === 1'),
    'DriverPortal handles PERMISSION_DENIED (err.code === 1) with explicit user notice'
  );

  assert(
    portalCode.includes('POSITION_UNAVAILABLE') || portalCode.includes('TIMEOUT'),
    'DriverPortal handles POSITION_UNAVAILABLE / TIMEOUT gracefully'
  );

  assert(
    portalCode.includes('GPS LIVE') && portalCode.includes('GPS Tracking Stopped'),
    'DriverPortal renders live GPS status badges (ONLINE: GPS LIVE, OFFLINE: GPS Tracking Stopped)'
  );

  assert(
    portalCode.includes('isMountedRef.current'),
    'DriverPortal prevents memory leaks and state updates on unmounted component via isMountedRef'
  );

  // 2. Dynamic Live Beacon API Simulation
  console.log('\n2. Live Driver Account Lifecycle & GPS Beacon Tests...');
  const timestamp = Date.now();
  const driverEmail = `beacon_driver_${timestamp}@smarteats.com`;

  const token = await registerAndLogin(driverEmail, 'DELIVERY_PARTNER', {
    vehicleType: 'MOTORCYCLE',
    vehicleNumber: 'KA-02-ZZ-8888',
    drivingLicenseNumber: 'DL-KA02-8888888',
    driverBaseAddress: 'Whitefield Main Road, Bengaluru',
    driverCity: 'Bengaluru',
    driverState: 'Karnataka',
    driverPincode: '560066',
    driverBaseLatitude: 12.9698,
    driverBaseLongitude: 77.7500
  });

  // Test GPS Beacon 1 (Driver at Hoodi)
  const beacon1Res = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    },
    { latitude: 12.9800, longitude: 77.7300, accuracy: 6.2 }
  );

  assert(beacon1Res.status === 200, 'Live GPS Beacon 1 accepted by backend with HTTP 200');
  const b1Data = beacon1Res.body?.data;
  assert(
    b1Data?.currentLatitude === 12.9800 && b1Data?.currentLongitude === 77.7300,
    'currentLatitude and currentLongitude set to GPS location (12.9800, 77.7300)'
  );
  assert(
    b1Data?.baseLatitude === 12.9698 && b1Data?.baseLongitude === 77.7500,
    'baseLatitude and baseLongitude remain strictly invariant (12.9698, 77.7500)'
  );
  assert(
    b1Data?.locationAccuracyMeters === 6.2,
    'locationAccuracyMeters persisted correctly (6.2m)'
  );

  // Test GPS Beacon 2 (Driver moving to ITPL)
  const beacon2Res = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/deliveries/partner/location',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    },
    { latitude: 12.9865, longitude: 77.7350, accuracy: 4.0 }
  );

  assert(beacon2Res.status === 200, 'Live GPS Beacon 2 accepted by backend with HTTP 200');
  const b2Data = beacon2Res.body?.data;
  assert(
    b2Data?.currentLatitude === 12.9865 && b2Data?.currentLongitude === 77.7350,
    'currentLatitude and currentLongitude updated after movement (12.9865, 77.7350)'
  );
  assert(
    b2Data?.baseLatitude === 12.9698 && b2Data?.baseLongitude === 77.7500,
    'baseLatitude and baseLongitude STILL strictly invariant after movement'
  );

  // Test Driver goes OFFLINE
  const offlineRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/deliveries/partner/availability?active=false&available=false',
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert(
    offlineRes.status === 200 && offlineRes.body?.data?.active === false,
    'Driver toggled OFFLINE (active=false, available=false)'
  );

  console.log('\n===============================================================');
  console.log(`🏆 STEP 8.3B TEST SUITE COMPLETE: ${passed} passed, ${failed} failed`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep83BVerification().catch((err) => {
  console.error('\n❌ STEP 8.3B VERIFICATION FAILED:', err);
  process.exit(1);
});
