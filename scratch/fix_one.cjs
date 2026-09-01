require('dotenv').config();
const mongoose = require('mongoose');

async function fixOne() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const res = await mongoose.connection.collection('movies').updateOne(
    { _id: new mongoose.Types.ObjectId('6a3387222e358a4c3decdb35') },
    { $set: { downloadAllowed: true } }
  );
  console.log('Update result:', res);

  const doc = await mongoose.connection.collection('movies').findOne({ _id: new mongoose.Types.ObjectId('6a3387222e358a4c3decdb35') });
  console.log('Doc after update:', doc.downloadAllowed);

  await mongoose.disconnect();
}

fixOne().catch(console.error);
