import mongoose, { Schema, Document } from 'mongoose';

export type MediaUploadSessionStatus =
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'transcoding'
  | 'ready'
  | 'failed'
  | 'aborted';

export interface IUploadedPart {
  partNumber: number;
  etag: string;
  size: number;
}

export interface IMediaUploadSession extends Document {
  mediaFileId: mongoose.Types.ObjectId;
  folderId?: mongoose.Types.ObjectId;
  originalName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  key: string;
  uploadId: string;
  partSize: number;
  resumeToken: string;
  uploadedParts: IUploadedPart[];
  status: MediaUploadSessionStatus;
  uploadError?: string;
  source?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UploadedPartSchema = new Schema<IUploadedPart>(
  {
    partNumber: { type: Number, required: true },
    etag: { type: String, required: true },
    size: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const MediaUploadSessionSchema = new Schema<IMediaUploadSession>(
  {
    mediaFileId: { type: Schema.Types.ObjectId, ref: 'MediaFile', required: true, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'MediaFolder', required: false, index: true },
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    key: { type: String, required: true },
    uploadId: { type: String, required: true },
    partSize: { type: Number, required: true },
    resumeToken: { type: String, required: true, index: true },
    uploadedParts: { type: [UploadedPartSchema], default: [] },
    status: {
      type: String,
      enum: ['uploading', 'uploaded', 'processing', 'transcoding', 'ready', 'failed', 'aborted'],
      default: 'uploading',
      index: true,
    },
    uploadError: { type: String, required: false },
    source: { type: String, required: false },
    expiresAt: { type: Date, required: false, index: true },
  },
  { timestamps: true }
);

MediaUploadSessionSchema.index({ resumeToken: 1, status: 1 });

export const MediaUploadSessionModel = mongoose.model<IMediaUploadSession>(
  'MediaUploadSession',
  MediaUploadSessionSchema
);
