const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });
const mongoose = require('mongoose');

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  // List databases
  const admin = mongoose.connection.db.admin();
  const dbList = await admin.listDatabases();
  console.log('\n--- Databases on Cluster ---');
  console.log(dbList.databases);

  // Current database collections
  console.log('\n--- Collections in Current DB (' + mongoose.connection.db.databaseName + ') ---');
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const col of collections) {
    const count = await mongoose.connection.db.collection(col.name).countDocuments();
    console.log(`Collection: ${col.name}, Count: ${count}`);
  }

  await mongoose.disconnect();
  console.log('\nDisconnected.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
