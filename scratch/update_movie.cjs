require('dotenv').config();
const mongoose = require('mongoose');

async function fixMovie() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const Movie = mongoose.model('Movie', new mongoose.Schema({ downloadAllowed: Boolean }, { strict: false }));
  
  const res = await Movie.updateOne({ _id: '6a3387222e358a4c3decdb45' }, { $set: { downloadAllowed: true } });
  console.log('Update Result:', res);

  const movie = await Movie.findById('6a3387222e358a4c3decdb45');
  console.log('Movie now has downloadAllowed:', movie.downloadAllowed);

  await mongoose.disconnect();
}

fixMovie().catch(console.error);
