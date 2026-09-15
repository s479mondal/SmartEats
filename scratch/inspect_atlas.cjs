const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient } = require('mongodb');

const envPath = path.resolve(__dirname, '../.env');
const env = fs.readFileSync(envPath, 'utf8');
const match = env.match(/MONGODB_URI=(.+)/);
if (!match) {
  console.error('No MONGODB_URI found in .env');
  process.exit(1);
}
const uri = match[1].trim();

async function check() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Successfully connected to MongoDB Atlas!');
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    console.log('Databases in Atlas:', dbs.databases.map(d => d.name));
    for (const dbInfo of dbs.databases) {
      if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      console.log('Database:', dbInfo.name, '-> Collections:', collections.map(c => c.name));
      for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log('   -', coll.name + ':', count, 'documents');
      }
    }
  } catch (err) {
    console.error('Atlas connection error:', err.message);
  } finally {
    await client.close();
  }
}
check();
