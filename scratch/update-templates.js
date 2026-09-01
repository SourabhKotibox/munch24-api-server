import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault';

const SettingsSchema = new mongoose.Schema({}, { strict: false });
const SettingsModel = mongoose.model('Settings', SettingsSchema);

const NotificationTemplateSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true },
    emailSubject: { type: String, required: true },
    emailTemplate: { type: String, required: true },
  },
  { strict: false }
);
const NotificationTemplateModel = mongoose.model('NotificationTemplate', NotificationTemplateSchema);

const NotificationSchema = new mongoose.Schema(
  {
    title: { type: String },
    body: { type: String },
  },
  { strict: false }
);
const NotificationModel = mongoose.model('Notification', NotificationSchema);

async function run() {
  console.log('Connecting to database:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected successfully!');

  // 1. Update Settings document
  console.log('Updating settings document...');
  const settingsUpdate = {
    platformName: 'Triple Minds',
    copyrightText: '© 2026 Triple Minds. All Rights Reserved.',
    mailFromName: 'Triple Minds',
    mailFrom: 'info@tripleminds.com',
    mailEmail: 'info@tripleminds.com'
  };
  
  const settingsResult = await SettingsModel.findOneAndUpdate(
    {},
    { $set: settingsUpdate },
    { new: true, upsert: true }
  );
  console.log('Settings document updated successfully:', settingsResult);

  // 2. Update notification templates (replace Kotibox or StreamVault with [[ platform_name ]])
  const templates = await NotificationTemplateModel.find({});
  console.log(`Found ${templates.length} templates in the database.`);

  let updatedTemplates = 0;
  for (const t of templates) {
    let changed = false;
    let newSubject = t.emailSubject;
    let newTemplate = t.emailTemplate;

    if (newSubject && (newSubject.includes('StreamVault') || newSubject.includes('Kotibox'))) {
      newSubject = newSubject.replace(/StreamVault|Kotibox/g, '[[ platform_name ]]');
      changed = true;
    }

    if (newTemplate && (newTemplate.includes('StreamVault') || newTemplate.includes('Kotibox'))) {
      newTemplate = newTemplate.replace(/StreamVault|Kotibox/g, '[[ platform_name ]]');
      changed = true;
    }

    if (changed) {
      t.emailSubject = newSubject;
      t.emailTemplate = newTemplate;
      await t.save();
      console.log(`Updated template: ${t.type}`);
      updatedTemplates++;
    }
  }
  console.log(`Updated ${updatedTemplates} templates in the database.`);

  // 3. Update past notifications (replace StreamVault or Kotibox with Triple Minds)
  const notifications = await NotificationModel.find({});
  console.log(`Found ${notifications.length} notifications in the database.`);

  let updatedNotifs = 0;
  for (const n of notifications) {
    let changed = false;
    let newTitle = n.title;
    let newBody = n.body;

    if (newTitle && (newTitle.includes('StreamVault') || newTitle.includes('Kotibox'))) {
      newTitle = newTitle.replace(/StreamVault|Kotibox/g, 'Triple Minds');
      changed = true;
    }

    if (newBody && (newBody.includes('StreamVault') || newBody.includes('Kotibox'))) {
      newBody = newBody.replace(/StreamVault|Kotibox/g, 'Triple Minds');
      changed = true;
    }

    if (changed) {
      n.title = newTitle;
      n.body = newBody;
      await n.save();
      console.log(`Updated notification ID: ${n._id}`);
      updatedNotifs++;
    }
  }
  console.log(`Updated ${updatedNotifs} notifications in the database.`);

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
