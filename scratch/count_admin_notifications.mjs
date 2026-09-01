import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { AdminNotificationModel } from '../src/models/AdminNotification.ts';

dotenv.config({ path: './.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log("Connected to database:", mongoose.connection.name);
  
  const count = await AdminNotificationModel.countDocuments({});
  console.log("Found", count, "admin notifications:");
  
  const notifications = await AdminNotificationModel.find({}).sort({ createdAt: -1 }).limit(10).lean();
  for (const n of notifications) {
    console.log(JSON.stringify(n, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(console.error);
