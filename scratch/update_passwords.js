import { MongoClient } from 'mongodb';

const uri = 'mongodb://smarteats-mongodb:27017';
const client = new MongoClient(uri);

async function updatePasswords() {
  try {
    await client.connect();
    const hash = '$2b$10$hMaceja8Hp4AACCbX.PtiuADXK4gMlByoH7qaUXej/2ofHjjsJmwO';
    const db = client.db('smarteats_auth');
    const result = await db.collection('users').updateMany({}, { $set: { password: hash } });
    console.log(`Successfully updated ${result.modifiedCount} user passwords to 'admin123' hash.`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

updatePasswords();
