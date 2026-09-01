require('dotenv').config();
const mongoose = require('mongoose');

const NotificationTemplateSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, unique: true },
    userType: { type: String, enum: ['user', 'admin', 'all'], default: 'user' },
    recipients: [{ type: String }],
    status: { type: Boolean, default: true },
    notifSubject: { type: String, required: true },
    notifTemplate: { type: String, required: true },
    emailSubject: { type: String, required: true },
    emailTemplate: { type: String, required: true },
  },
  { timestamps: true }
);

const NotificationTemplateModel = mongoose.models.NotificationTemplate || mongoose.model('NotificationTemplate', NotificationTemplateSchema);

const ADMIN_CREDENTIALS_TEMPLATE = {
  type: 'Admin Credentials',
  userType: 'admin',
  status: true,
  notifSubject: 'Welcome to [[ site_url ]]!',
  notifTemplate: 'Your new account has been created. ID: [[ user_id ]]',
  emailSubject: 'Your Administrator Credentials for [[ site_url ]]',
  emailTemplate: `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #e50914;">Welcome to the Team, [[ user_name ]]!</h2>
      <p>We are thrilled to have you on board. Your administrator account has been successfully created.</p>
      
      <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #555;">Your Login Credentials</h3>
        <p><strong>Email (ID):</strong> [[ user_id ]]</p>
        <p><strong>Password:</strong> [[ user_password ]]</p>
      </div>

      <p style="background-color: #ffebee; border-left: 4px solid #f44336; padding: 10px; font-size: 14px;">
        <strong>Important:</strong> Please log in to your dashboard and change your password immediately for security purposes.
      </p>

      <div style="text-align: center; margin-top: 30px;">
        <a href="[[ site_url ]]" style="background-color: #e50914; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Go to Admin Dashboard
        </a>
      </div>

      <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
        If you have any issues logging in, please contact your superadmin.
      </p>
    </div>
  `
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existing = await NotificationTemplateModel.findOne({ type: 'Admin Credentials' });
    if (!existing) {
      await NotificationTemplateModel.create(ADMIN_CREDENTIALS_TEMPLATE);
      console.log('Seeded Admin Credentials template.');
    } else {
      await NotificationTemplateModel.updateOne({ type: 'Admin Credentials' }, ADMIN_CREDENTIALS_TEMPLATE);
      console.log('Updated Admin Credentials template.');
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed();
