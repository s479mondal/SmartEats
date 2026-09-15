import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
const match = env.match(/MONGODB_URI_AUTH=(.+)/) || env.match(/MONGODB_URI=(.+)/);
if (!match) throw new Error('No MONGODB_URI_AUTH found in .env');
const uri = match[1].trim();
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
