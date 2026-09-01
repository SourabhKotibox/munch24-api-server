require('dotenv').config();
const mongoose = require('mongoose');

async function checkContent() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const content = await mongoose.connection.collection('contents').findOne({ _id: new mongoose.Types.ObjectId('6a343d13ac2398c3caeacc40') });
  console.log('Content:', content ? { _id: content._id, title: content.title, status: content.status } : 'Not found');

  const movie = await mongoose.connection.collection('movies').findOne({ _id: new mongoose.Types.ObjectId('6a343d13ac2398c3caeacc40') });
  console.log('Movie:', movie ? { _id: movie._id, title: movie.title, status: movie.status } : 'Not found');

  await mongoose.disconnect();
}

checkContent().catch(console.error);
