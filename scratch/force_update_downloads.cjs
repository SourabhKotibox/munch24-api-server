require('dotenv').config();
const mongoose = require('mongoose');

async function fixDownloads() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const mRes = await mongoose.connection.collection('movies').updateMany({}, { $set: { downloadAllowed: true } });
  console.log(`Updated ${mRes.modifiedCount} movies`);

  const eRes = await mongoose.connection.collection('episodes').updateMany({}, { $set: { downloadAllowed: true } });
  console.log(`Updated ${eRes.modifiedCount} episodes`);

  const m45 = await mongoose.connection.collection('movies').findOne({ _id: new mongoose.Types.ObjectId('6a3387222e358a4c3decdb45') });
  console.log('Movie 45 is now:', m45.downloadAllowed);

  const m51 = await mongoose.connection.collection('movies').findOne({ _id: new mongoose.Types.ObjectId('6a3387222e358a4c3decdb51') });
  console.log('Movie 51 is now:', m51.downloadAllowed);

  await mongoose.disconnect();
  console.log('Done');
}

fixDownloads().catch(console.error);
