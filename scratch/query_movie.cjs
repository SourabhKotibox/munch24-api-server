require('dotenv').config();
const mongoose = require('mongoose');

async function queryMovie() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const Movie = mongoose.model('Movie', new mongoose.Schema({ downloadAllowed: Boolean }, { strict: false }));
  
  const movie1 = await Movie.findById('6a3387222e358a4c3decdb51');
  console.log('Movie 51 downloadAllowed:', movie1?.downloadAllowed);
  
  const movie2 = await Movie.findById('6a3387222e358a4c3decdb45');
  console.log('Movie 45 downloadAllowed:', movie2?.downloadAllowed);

  await mongoose.disconnect();
}

queryMovie().catch(console.error);
