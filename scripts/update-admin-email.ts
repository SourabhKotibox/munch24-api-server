import mongoose from 'mongoose';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

import { AdminUserModel } from '../src/models/AdminUser';

async function updateAdminEmail() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Update existing admin user email
    const result = await AdminUserModel.updateOne(
      { email: 'admin@streamvault.com' },
      { $set: { email: 'admin@streamit.com', name: 'Admin User' } }
    );

    console.log('Update result:', result);

    // Check if user exists
    const admin = await AdminUserModel.findOne({ email: 'admin@streamit.com' });
    console.log('Admin user:', admin ? 'Found' : 'Not found');

    await mongoose.disconnect();
    console.log('Done');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateAdminEmail();
