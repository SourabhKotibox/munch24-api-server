import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

import { UserModel as User } from './src/models/User.js';
import { SettingsModel as Settings } from './src/models/Settings.js';
import { CoinPackageModel as CoinPackage } from './src/models/CoinPackage.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';

async function runTest() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/munch24');
  console.log('Connected to MongoDB');

  // 1. Update Settings with dummy PhonePe credentials
  const settings = await Settings.findOne() || new Settings();
  settings.phonepeEnabled = true;
  settings.phonepeTestMode = true;
  settings.phonepeMerchantId = 'PGTESTPAYUAT';
  settings.phonepeClientId = 'dummy-client-id';
  settings.phonepeClientSecret = 'dummy-client-secret';
  settings.phonepeClientVersion = 1;
  await settings.save();
  console.log('Settings updated for PhonePe');

  // 2. Create or Get User
  let user = await User.findOne({ email: 'test@example.com' });
  if (!user) {
    user = new User({
      email: 'test@example.com',
      name: 'Test User',
      password: 'password123',
    });
    await user.save();
  }

  // 3. Generate JWT Token
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'fallback-secret-key',
    { expiresIn: '1h' }
  );
  console.log('Generated JWT Token');

  // 4. Create a Dummy Coin Package if doesn't exist
  let pkg = await CoinPackage.findOne();
  if (!pkg) {
    pkg = new CoinPackage({
      coins: 100,
      price: 99,
      label: 'Test Package'
    });
    await pkg.save();
  }

  // 5. Test create order API
  try {
    console.log('Calling POST /api/wallet/phonepe/order');
    const res = await axios.post('http://127.0.0.1:3000/api/wallet/phonepe/order', {
      packageId: pkg._id.toString()
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Response:', res.data);
  } catch (error: any) {
    console.error('API Error:', error.response?.data || error.message);
  }

  process.exit(0);
}

runTest().catch(console.error);
