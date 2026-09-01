const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault';

async function main() {
  await mongoose.connect(MONGODB_URI);

  const Page = mongoose.model('Page', new mongoose.Schema({
    title: String, slug: String, status: String, content: String
  }));

  const Settings = mongoose.model('Settings', new mongoose.Schema({
    platformName: String, contactEmail: String, supportEmail: String,
    websiteUrl: String, privacyPolicyUrl: String, termsUrl: String, contactUrl: String
  }));

  const pages = await Page.find({}).select('title slug status').lean();
  console.log('=== PAGES IN DB ===');
  console.log(JSON.stringify(pages, null, 2));

  const settings = await Settings.findOne().lean();
  console.log('\n=== SETTINGS ===');
  console.log(JSON.stringify(settings, null, 2));

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
