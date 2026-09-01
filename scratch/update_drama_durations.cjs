const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault').then(async () => {
  const db = mongoose.connection.db;
  const dramas = await db.collection('contents').find({ contentType: 'drama' }).toArray();
  let updatedCount = 0;
  for (const drama of dramas) {
    const episodes = await db.collection('episodes').find({ contentId: drama._id }).toArray();
    for (const ep of episodes) {
      const newDuration = Math.floor(Math.random() * 20) + 40;
      await db.collection('episodes').updateOne({ _id: ep._id }, { $set: { duration: newDuration } });
      updatedCount++;
    }
  }
  console.log('Updated episodes for dramas:', updatedCount);
  mongoose.disconnect();
}).catch(console.error);
