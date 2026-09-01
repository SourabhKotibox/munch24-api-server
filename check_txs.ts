import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { TransactionModel } from './src/models/Transaction.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/triple-mindes');
  
  const txs = await TransactionModel.find().sort({createdAt: -1}).limit(10);
  console.log(txs.map(t => ({ id: t._id, type: t.type, amount: t.amount, coins: t.coins, userId: t.userId })));

  await mongoose.disconnect();
}
run().catch(console.error);
