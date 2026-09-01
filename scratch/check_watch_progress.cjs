const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault';

async function checkWatchProgress() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const count = await mongoose.connection.db.collection('userwatchprogresses').countDocuments();
  console.log('Watch progress count:', count);

  if (count > 0) {
    const docs = await mongoose.connection.db.collection('userwatchprogresses').find().limit(5).toArray();
    console.log('Sample watch progress documents:', JSON.stringify(docs, null, 2));
  }

  await mongoose.disconnect();
}

checkWatchProgress();
