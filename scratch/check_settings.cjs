const mongoose = require('mongoose');

async function checkSettings() {
  await mongoose.connect('mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault');
  
  const AppSetting = mongoose.model('AppSetting', new mongoose.Schema({}, { strict: false }));
  const settings = await AppSetting.find({}).lean();
  console.log(JSON.stringify(settings, null, 2));

  await mongoose.disconnect();
}

checkSettings();
