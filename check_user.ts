import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserModel } from './src/models/User.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/triple-mindes');
  
  const user = await UserModel.findById('6a561ce8e7ef0eea6c5e17be');
  console.log(user ? { email: user.email, walletBalance: user.walletBalance, id: user._id } : 'Not found');

  await mongoose.disconnect();
}
run().catch(console.error);
