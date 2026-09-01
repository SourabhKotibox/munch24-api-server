import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const SettingsSchema = new mongoose.Schema({
  storageDriver: String,
  awsAccessKeyId: String,
  awsSecretAccessKey: String,
  awsRegion: String,
  awsBucket: String
}, { strict: false });

const SettingsModel = mongoose.model('Settings', SettingsSchema, 'settings');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const settings = await SettingsModel.findOne();
  console.log("storageDriver:", settings?.storageDriver);
  console.log("awsAccessKeyId exists:", !!settings?.awsAccessKeyId);
  console.log("awsBucket:", settings?.awsBucket);
  console.log("awsRegion:", settings?.awsRegion);
  process.exit(0);
}
check().catch(console.error);
