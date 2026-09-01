import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserWishlist extends Document {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  contentModelType: 'Content' | 'Movie'; // which collection contentId refers to
  profileId?: string | null; // OTT profile isolation (null = default/unscoped)
  createdAt: Date;
}

const UserWishlistSchema = new Schema<IUserWishlist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    contentModelType: { type: String, enum: ['Content', 'Movie'], required: true },
    profileId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

// Unique constraint: one wishlist item per user per content
UserWishlistSchema.index({ userId: 1, contentId: 1 }, { unique: true });

export const UserWishlistModel = mongoose.model<IUserWishlist>('UserWishlist', UserWishlistSchema);
