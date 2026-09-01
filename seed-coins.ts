import mongoose from 'mongoose';
import { CoinPackageModel } from './src/models/CoinPackage';

async function seedCoins() {
  const MONGO_URI = 'mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  await CoinPackageModel.deleteMany({});
  console.log('Cleared existing coin packages');

  const packages = [
    {
      price: 1.99,
      coins: 100,
      bonusCoins: 0,
      label: 'Starter Pack',
      isActive: true,
    },
    {
      price: 4.99,
      coins: 250,
      bonusCoins: 50,
      label: 'Most Popular',
      isActive: true,
    },
    {
      price: 9.99,
      coins: 500,
      bonusCoins: 150,
      label: 'Great Value',
      isActive: true,
    },
    {
      price: 19.99,
      coins: 1000,
      bonusCoins: 400,
      label: 'Best Deal',
      isActive: true,
    },
  ];

  await CoinPackageModel.insertMany(packages);
  console.log('Seed completed successfully!');
  
  await mongoose.disconnect();
}

seedCoins().catch(console.error);
