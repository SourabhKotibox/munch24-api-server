import { adminAuditPlugin } from '../middlewares/adminAuditPlugin';
import mongoose, { Schema, Document } from 'mongoose';

export interface IDirector extends Document {
  name: string;
  designation: string;
  image: string;
  dateOfBirth: Date;
  birthPlace: string;
  status: boolean;
  approvalStatus: 'published' | 'draft' | 'moderation' | 'rejected';
  rejectionReason?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DirectorSchema = new Schema<IDirector>(
  {
    name: { type: String, required: true, index: true },
    designation: { type: String, required: true },
    image: String,
    dateOfBirth: { type: Date, required: true },
    birthPlace: { type: String, required: true },
    status: { type: Boolean, default: true },
    approvalStatus: {
      type: String,
      enum: ['published', 'draft', 'moderation', 'rejected'],
      default: 'draft',
      index: true,
    },
    rejectionReason: String,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    approvedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    rejectedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

DirectorSchema.plugin(adminAuditPlugin);
export const DirectorModel = mongoose.model<IDirector>('Director', DirectorSchema);
