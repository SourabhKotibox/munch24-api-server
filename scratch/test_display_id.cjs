const mongoose = require('mongoose');

async function testUserDisplayId() {
  await mongoose.connect('mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault');
  
  const User = mongoose.model('User', new mongoose.Schema({
    createdAt: Date
  }, { strict: false }));
  
  const Settings = mongoose.model('Settings', new mongoose.Schema({
    platformName: String
  }, { strict: false }));

  const users = await User.find().sort({ _id: 1 }).limit(3).lean();
  const settings = await Settings.findOne().lean();
  
  const appName = settings?.platformName || 'XOTO';
  const prefix = appName.substring(0, 4).toUpperCase();
  
  for (const user of users) {
    const userNumber = await User.countDocuments({ _id: { $lte: user._id } });
    const displayId = `${prefix}${String(userNumber).padStart(4, '0')}`;
    console.log(`User ID: ${user._id}, Display ID: ${displayId}`);
  }

  await mongoose.disconnect();
}

testUserDisplayId();
