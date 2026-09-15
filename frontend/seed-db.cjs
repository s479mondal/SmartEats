const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch(e) {}
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

let envUri = '';
try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  const match = envContent.match(/MONGODB_URI=(.+)/);
  if (match) envUri = match[1].trim();
} catch (e) {}

if (!envUri) {
  throw new Error("MONGODB_URI environment variable must be set in .env");
}
const uri = envUri;
const client = new MongoClient(uri);

async function seedDatabase() {
  try {
    await client.connect();
    console.log(`Connected to MongoDB at ${uri.replace(/:([^@]+)@/, ':****@')}`);

    // 1. Auth Database (smarteats_auth)
    const authDb = client.db('smarteats_auth');
    const usersCol = authDb.collection('users');
    await usersCol.deleteMany({});
    
    await usersCol.insertMany([
      {
        _id: 'usr_cust_1',
        name: 'Raj Kumar',
        email: 'customer@smarteats.com',
        password: '$2a$10$J3Wqk..VYmpyucWSkbSLJOkTU0XBGzpWGO4fDA6mlsF2bD9fqNSn2',
        roles: ['CUSTOMER'],
        approved: true,
        status: 'APPROVED',
        createdAt: new Date()
      },
      {
        _id: 'usr_rest_1',
        name: 'Rajesh Sharma',
        email: 'restaurant@smarteats.com',
        password: '$2a$10$J3Wqk..VYmpyucWSkbSLJOkTU0XBGzpWGO4fDA6mlsF2bD9fqNSn2',
        roles: ['RESTAURANT_OWNER'],
        approved: true,
        status: 'APPROVED',
        createdAt: new Date()
      },
      {
        _id: 'usr_driver_1',
        name: 'Suresh Kumar',
        email: 'driver@smarteats.com',
        password: '$2a$10$J3Wqk..VYmpyucWSkbSLJOkTU0XBGzpWGO4fDA6mlsF2bD9fqNSn2',
        roles: ['DELIVERY_PARTNER'],
        approved: true,
        status: 'APPROVED',
        createdAt: new Date()
      },
      {
        _id: 'usr_ngo_1',
        name: 'Robin Hood Army',
        email: 'ngo@smarteats.com',
        password: '$2a$10$J3Wqk..VYmpyucWSkbSLJOkTU0XBGzpWGO4fDA6mlsF2bD9fqNSn2',
        roles: ['NGO'],
        approved: true,
        status: 'APPROVED',
        createdAt: new Date()
      },
      {
        _id: 'usr_admin_1',
        name: 'System Admin',
        email: 'admin@smarteats.com',
        password: '$2a$10$J3Wqk..VYmpyucWSkbSLJOkTU0XBGzpWGO4fDA6mlsF2bD9fqNSn2',
        roles: ['ADMIN'],
        approved: true,
        status: 'APPROVED',
        createdAt: new Date()
      }
    ]);
    console.log('✅ Seeded smarteats_auth.users collection!');

    // 2. Restaurant Database (smarteats_restaurant)
    const restDb = client.db('smarteats_restaurant');
    const restaurantsCol = restDb.collection('restaurants');
    const menuItemsCol = restDb.collection('menuItems');

    await restaurantsCol.deleteMany({});
    await menuItemsCol.deleteMany({});

    await restaurantsCol.insertMany([
      {
        _id: 'rest_101',
        name: 'Artisan Pizza Hub',
        ownerEmail: 'restaurant@smarteats.com',
        address: '42 Indiranagar 100ft Rd, Bengaluru',
        phone: '+91 9876543210',
        cuisineType: 'Italian',
        approved: true,
        createdAt: new Date()
      },
      {
        _id: 'rest_102',
        name: 'Spice Garden',
        ownerEmail: 'restaurant@smarteats.com',
        address: '15 Koramangala 5th Block, Bengaluru',
        phone: '+91 9123456789',
        cuisineType: 'North Indian',
        approved: true,
        createdAt: new Date()
      }
    ]);

    await menuItemsCol.insertMany([
      {
        _id: 'item_501',
        restaurantId: 'rest_101',
        name: 'Woodfired Margherita',
        description: 'Fresh mozzarella, basil & San Marzano tomatoes',
        price: 292,
        category: 'PIZZA',
        available: true,
        isSurplus: true
      },
      {
        _id: 'item_502',
        restaurantId: 'rest_101',
        name: 'Artisan Truffle Burger',
        description: 'Double wagyu patty with black truffle aioli on brioche',
        price: 299,
        category: 'BURGER',
        available: true,
        isSurplus: false
      },
      {
        _id: 'item_503',
        restaurantId: 'rest_102',
        name: 'Paneer Biryani Handi',
        description: 'Fragrant basmati rice dum cooked with paneer tikka',
        price: 190,
        category: 'MAIN_COURSE',
        available: true,
        isSurplus: true
      }
    ]);
    console.log('✅ Seeded smarteats_restaurant.restaurants & menuItems collections!');

  } catch (err) {
    console.error('Error seeding MongoDB:', err);
  } finally {
    await client.close();
  }
}

seedDatabase();
