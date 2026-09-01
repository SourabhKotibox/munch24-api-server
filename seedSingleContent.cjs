const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault').then(async () => {
  const db = mongoose.connection.db;
  const contentIdStr = '6a32d53968660bebcc052d66';
  const contentId = new mongoose.Types.ObjectId(contentIdStr);

  // Check if episodes already exist
  const existingCount = await db.collection('episodes').countDocuments({ contentId });
  
  if (existingCount === 0) {
    console.log('No episodes found for this content. Seeding 10 episodes...');
    
    const episodesToInsert = [];
    for (let i = 1; i <= 10; i++) {
      episodesToInsert.push({
        contentId: contentId,
        season: 1,
        episode: i,
        title: `Episode ${i}`,
        description: `This is the description for episode ${i}.`,
        thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop&q=80',
        duration: 120 + i * 10,
        isFree: i <= 3, // First 3 episodes are free
        hlsUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        trailerUrl: null,
        processingStatus: 'ready',
        airDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await db.collection('episodes').insertMany(episodesToInsert);
    console.log(`Successfully seeded 10 episodes for content ID ${contentIdStr}`);
  } else {
    console.log(`Content ID ${contentIdStr} already has ${existingCount} episodes.`);
  }

  mongoose.disconnect();
}).catch(e => console.error(e.message));
