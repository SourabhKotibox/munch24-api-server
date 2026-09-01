import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ContentModel } from './src/models/Content.js';
import { EpisodeModel } from './src/models/Episode.js';
dotenv.config();

const check = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    const content = await ContentModel.findOne({ title: 'Beach Romance' }).lean();
    if (!content) {
      console.log('Content not found');
      return;
    }
    const eps = await EpisodeModel.find({ contentId: content._id }).sort({ episode: 1 }).lean();
    for (const ep of eps) {
      console.log(`Episode ${ep.episode}: isFree=${ep.isFree}, isLocked=${ep.isLocked}, hlsUrl=${ep.hlsUrl}`);
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};
check();
