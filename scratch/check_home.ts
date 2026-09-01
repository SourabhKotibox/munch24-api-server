import mongoose from 'mongoose';
import { SectionModel } from '../src/models/Section.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const sections = await SectionModel.find().lean();
  console.log(JSON.stringify(sections, null, 2));
  process.exit(0);
}
run();
