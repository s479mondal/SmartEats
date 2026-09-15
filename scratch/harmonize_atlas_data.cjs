const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient } = require('mongodb');

const envPath = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envPath, 'utf8');
const match = env.match(/MONGODB_URI=(.+)/);
if (!match) {
  console.error('No MONGODB_URI found');
  process.exit(1);
}
const uri = match[1].trim();

async function harmonize() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to Atlas for harmonization.');

    // 1. Restaurant DB harmonization
    const restDb = client.db('smarteats_restaurant');
    const restCol = restDb.collection('restaurants');
    
    // Update rest_101 if needed
    const r101Res = await restCol.updateOne(
      { _id: 'rest_101' },
      { 
        $set: { 
          open: true, 
          status: 'ACTIVE', 
          latitude: 12.9716, 
          longitude: 77.5946, 
          email: 'restaurant@smarteats.com' 
        } 
      }
    );
    console.log('rest_101 updated:', r101Res.matchedCount, 'matched,', r101Res.modifiedCount, 'modified');

    // Update rest_102 if needed
    const r102Res = await restCol.updateOne(
      { _id: 'rest_102' },
      { 
        $set: { 
          open: true, 
          status: 'ACTIVE', 
          latitude: 12.9750, 
          longitude: 77.5980, 
          email: 'restaurant@smarteats.com' 
        } 
      }
    );
    console.log('rest_102 updated:', r102Res.matchedCount, 'matched,', r102Res.modifiedCount, 'modified');

    // 2. Delivery DB harmonization
    const delDb = client.db('smarteats_delivery');
    const partnerCol = delDb.collection('delivery_partners');

    // Upsert driver@smarteats.com
    const driverRes = await partnerCol.updateOne(
      { email: 'driver@smarteats.com' },
      {
        $set: {
          _id: 'del_part_1',
          userId: 'usr_driver_1',
          name: 'Delivery Driver',
          email: 'driver@smarteats.com',
          phone: '+91 9988776655',
          vehicleType: 'Bike',
          vehicleNumber: 'KA01AB1234',
          latitude: 12.9716,
          longitude: 77.5946,
          active: true,
          available: true,
          status: 'ACTIVE',
          _class: 'com.smarteats.delivery.entity.DeliveryPartner'
        }
      },
      { upsert: true }
    );
    console.log('driver@smarteats.com partner updated/upserted:', driverRes.upsertedCount ? 'upserted' : 'updated');

    // Ensure ajay.rider@smarteats.com is available and has standard admin123 hash
    await partnerCol.updateOne(
      { email: 'ajay.rider@smarteats.com' },
      { $set: { active: true, available: true, status: 'ACTIVE' } }
    );
    const authDb = client.db('smarteats_auth');
    await authDb.collection('users').updateOne(
      { email: 'ajay.rider@smarteats.com' },
      { $set: { password: '$2b$10$hMaceja8Hp4AACCbX.PtiuADXK4gMlByoH7qaUXej/2ofHjjsJmwO' } }
    );
    console.log('ajay.rider@smarteats.com partner marked active & available and password set to admin123');

    console.log('Harmonization completed successfully without dropping any collections or documents.');

  } catch (err) {
    console.error('Harmonization error:', err.message);
  } finally {
    await client.close();
  }
}

harmonize();
