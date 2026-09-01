import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedDatabase } from './lib/seed';

dotenv.config();

async function runSeed() {
  try {
    console.log('Connecting to database...');
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    console.log('Starting seed process...');
    await seedDatabase();
    console.log('Seed process complete!');
    
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during seed process:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

runSeed();
