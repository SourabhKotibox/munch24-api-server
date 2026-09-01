import mongoose, { Document, Schema } from 'mongoose';

export interface IAppSettingItem {
  id: string;
  name: string;
  enabled: boolean;
  type: 'simple' | 'select';
  selectedItems?: string[];
  availableItems?: string[];
}

interface IAppSetting extends Document {
  key: string;
  value: IAppSettingItem[];
  createdAt: Date;
  updatedAt: Date;
}

const AppSettingItemSchema = new Schema<IAppSettingItem>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  type: { type: String, enum: ['simple', 'select'], required: true },
  selectedItems: [{ type: String }],
  availableItems: [{ type: String }],
});

const AppSettingSchema = new Schema<IAppSetting>(
  {
    key: { type: String, required: true, unique: true, default: 'mobile-settings' },
    value: { type: [AppSettingItemSchema], required: true },
  },
  { timestamps: true }
);

export const AppSettingModel = mongoose.model<IAppSetting>('AppSetting', AppSettingSchema);
