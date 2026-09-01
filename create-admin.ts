import { config } from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { AdminUserModel } from './src/models/AdminUser';
import { IModulePermissions } from './src/models/AdminUser';

const __dirname = new URL('.', import.meta.url).pathname;
config({ path: `${__dirname}.env` });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tripleminds.co';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

async function createAdmin() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB:', uri);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const existing = await AdminUserModel.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`Admin user already exists with email: ${ADMIN_EMAIL}`);
    console.log('ID:', ADMIN_EMAIL);
    console.log('Password:', ADMIN_PASSWORD);
    await mongoose.connection.close();
    process.exit(0);
  }

  const modulePermissions: IModulePermissions = {
    movies: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    shows: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    shortDramas: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    genres: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    actors: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    directors: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    languages: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    categories: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    mediaLibrary: { canView: true, canUpload: true, canDelete: true },
    banners: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    promotions: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    influencers: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    ads: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    pages: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    faqs: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    subscriptions: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    subscriptionPlans: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    planLimits: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    notifications: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    notificationTemplates: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    settings: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    reviews: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  };

  const admin = await AdminUserModel.create({
    email: ADMIN_EMAIL,
    name: 'Super Admin',
    passwordHash,
    role: 'superadmin',
    isActive: true,
    loginCount: 0,
    modulePermissions,
  });

  console.log('\nCreated successfully!');
  console.log('ID:', ADMIN_EMAIL);
  console.log('Password:', ADMIN_PASSWORD);
  console.log('Admin _id:', admin._id);

  await mongoose.connection.close();
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
