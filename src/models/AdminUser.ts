import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import mongoose, { Schema, Document } from 'mongoose';

export interface IModulePermissions {
  movies: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  shows: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  shortDramas: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  genres: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  actors: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  directors: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  languages: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  categories: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  mediaLibrary: { canView: boolean; canUpload: boolean; canDelete: boolean };
  banners: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  promotions: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  influencers: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  ads: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  pages: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  faqs: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  subscriptions: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  subscriptionPlans: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  planLimits: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  notifications: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  notificationTemplates: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  settings: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
  reviews: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };
}

export interface IAdminUser extends Document {
  email: string;
  name: string;
  passwordHash: string;
  role: 'superadmin' | 'admin' | 'moderator' | 'influencer';
  avatar?: string;
  phone?: string;
  modulePermissions: IModulePermissions;
  isActive: boolean;
  lastLogin?: Date;
  loginCount: number;
  walletBalance: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const defaultModulePermissions: IModulePermissions = {
  movies: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  shows: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  shortDramas: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  genres: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  actors: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  directors: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  languages: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  categories: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  mediaLibrary: { canView: true, canUpload: false, canDelete: false },
  banners: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  promotions: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  influencers: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  ads: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  pages: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  faqs: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  subscriptions: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  subscriptionPlans: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  planLimits: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  notifications: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  notificationTemplates: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  settings: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  reviews: { canView: true, canCreate: false, canEdit: false, canDelete: false },
};

const AdminUserSchema = new Schema<IAdminUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'moderator', 'influencer'],
      default: 'influencer',
    },
    avatar: String,
    phone: String,
    modulePermissions: {
      type: {
        movies: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        shows: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        shortDramas: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        genres: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        actors: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        directors: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        languages: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        categories: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        mediaLibrary: { canView: Boolean, canUpload: Boolean, canDelete: Boolean },
        banners: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        promotions: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        influencers: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        ads: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        pages: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        faqs: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        subscriptions: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        subscriptionPlans: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        planLimits: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        notifications: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        notificationTemplates: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        settings: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
        reviews: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },
      },
      default: defaultModulePermissions,
    },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    loginCount: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

AdminUserSchema.plugin(adminAuditPlugin);
export const AdminUserModel = mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);
