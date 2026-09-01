import mongoose from 'mongoose';
import { ContentModel } from '../src/models/Content.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  
  const manualCount = await ContentModel.countDocuments({ _id: { $in: ["6a3387222e358a4c3decdb01", "6a3387222e358a4c3decda00"] } });
  console.log("Manual items for CEO Billionaire:", manualCount);

  const loveAffairsCount = await ContentModel.countDocuments({ sections: "love-affairs" });
  console.log("Items for Love Affairs:", loveAffairsCount);
  
  process.exit(0);
}
run();
