const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault').then(async () => {
  const db = mongoose.connection.db;
  
  // Find episodes with old hlsUrl
  const eps = await db.collection('episodes').updateMany(
    { hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
    { $set: { hlsUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8' } }
  );
  console.log('Updated episodes:', eps.modifiedCount);

  // Find movies with old hlsUrl
  const movies = await db.collection('movies').updateMany(
    { $or: [
      { hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
      { 'videoQualities.url': 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }
    ]},
    { 
      $set: { 
        hlsUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        'videoQualities.$[].url': 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8'
      } 
    }
  );
  console.log('Updated movies:', movies.modifiedCount);

  mongoose.disconnect();
}).catch(e => console.error(e.message));
