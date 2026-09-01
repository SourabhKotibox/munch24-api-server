require('dotenv').config();
const mongoose = require('mongoose');

async function forceAll() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const mRes = await mongoose.connection.collection('movies').updateMany(
    { downloadAllowed: { $ne: true } },
    { $set: { downloadAllowed: true } }
  );
  console.log('Movies update result:', mRes);

  const eRes = await mongoose.connection.collection('episodes').updateMany(
    { downloadAllowed: { $ne: true } },
    { $set: { downloadAllowed: true } }
  );
  console.log('Episodes update result:', eRes);

  const falseMovies = await mongoose.connection.collection('movies').countDocuments({ downloadAllowed: { $ne: true } });
  console.log('Remaining false movies:', falseMovies);

  await mongoose.disconnect();
}

forceAll().catch(console.error);
