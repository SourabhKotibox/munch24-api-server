import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { AdminUserModel } from './src/models/AdminUser.js';
import { TransactionModel } from './src/models/Transaction.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/triple-mindes');
  console.log('Connected to DB');

  const admins = await AdminUserModel.find({});
  console.log('Admins:', admins.map(a => ({ email: a.email, walletBalance: a.walletBalance, id: a._id })));

  const txs = await TransactionModel.find({});
  console.log('Total transactions:', txs.length);

  await mongoose.disconnect();
}
run().catch(console.error);
