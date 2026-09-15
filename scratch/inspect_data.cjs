const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient } = require('mongodb');

const envPath = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envPath, 'utf8');
const match = env.match(/MONGODB_URI=(.+)/);
const uri = match[1].trim();

async function inspectData() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    
    // Auth DB
    const authDb = client.db('smarteats_auth');
    const users = await authDb.collection('users').find({}, { projection: { password: 0 } }).toArray();
    console.log('=== USERS IN ATLAS (smarteats_auth) ===');
    console.log(users.map(u => ({ id: u._id, email: u.email, role: u.role, isApproved: u.isApproved, status: u.status })));

    // Restaurant DB
    const restDb = client.db('smarteats_restaurant');
    const rests = await restDb.collection('restaurants').find({}).toArray();
    console.log('=== RESTAURANTS IN ATLAS (smarteats_restaurant) ===');
    console.log(rests.map(r => ({ id: r._id, name: r.name, ownerEmail: r.ownerEmail || r.email, active: r.active || r.status })));
    const items = await restDb.collection('menuItems').find({}).toArray();
    console.log('=== MENU ITEMS IN ATLAS ===');
    console.log(items.map(i => ({ id: i._id, name: i.name, restaurantId: i.restaurantId, price: i.price })));

    // Delivery DB
    const delDb = client.db('smarteats_delivery');
    const delPartners = await delDb.collection('delivery_partners').find({}).toArray();
    console.log('=== DELIVERY PARTNERS IN ATLAS ===');
    console.log(delPartners);
    const partners = await delDb.collection('partners').find({}).toArray();
    console.log('=== PARTNERS IN ATLAS ===');
    console.log(partners);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}
inspectData();
