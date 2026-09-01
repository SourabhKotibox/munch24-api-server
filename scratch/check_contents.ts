import mongoose from 'mongoose';
import { ContentModel } from '../src/models/Content.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const counts = await ContentModel.aggregate([
    { $group: { _id: { type: "$type", contentType: "$contentType", status: "$status" }, count: { $sum: 1 } } }
  ]);
  console.log("Content Counts:", JSON.stringify(counts, null, 2));

  // Check how many match the exact filter for dramas:
  const dramaCount = await ContentModel.countDocuments({ type: 'drama', status: 'published', contentType: 'drama' });
  console.log("Dramas matching filter:", dramaCount);
  
  process.exit(0);
}
run();
