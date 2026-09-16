const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient } = require('mongodb');

async function inspectNotifications() {
  const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
  const uri = env.match(/MONGODB_URI=(.+)/)[1].trim();
  const client = new MongoClient(uri);
  await client.connect();

  const notifs = await client.db('smarteats_notification').collection('notifications').find().sort({ createdAt: -1 }).limit(10).toArray();
  console.log('--- RECENT NOTIFICATIONS IN ATLAS (smarteats_notification.notifications) ---');
  notifs.forEach(n => {
    console.log(`[${n.createdAt || n._id.getTimestamp()}] ${n.recipientEmail} (${n.type}): ${n.message} [Read: ${n.read}]`);
  });

  await client.close();
}

inspectNotifications().catch(console.error);
