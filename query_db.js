const mongoose = require('mongoose');
const uri = "mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const sections = await db.collection('sections').find({}).toArray();
  const movies = await db.collection('movies').countDocuments();
  const contents = await db.collection('contents').countDocuments();
  console.log('Sections:', sections.length);
  console.log('Movies:', movies);
  console.log('Contents:', contents);
  console.log('Web-Home Sections Content:', JSON.stringify(sections.map(s => s.title)));
  process.exit(0);
}
run();
