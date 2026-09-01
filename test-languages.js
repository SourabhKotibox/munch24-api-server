import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kotiboxserver_db_user:pS4U8tbfpRGZcPRz@cluster0.7opughx.mongodb.net/streamvault';
const BASE_URL = 'http://localhost:3000/api';

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const db = mongoose.connection.db;

  const usersCollection = db.collection('users');
  const languagesCollection = db.collection('languages');

  const langs = await languagesCollection.find({}).toArray();
  console.log('Available languages in DB:');
  langs.forEach(l => console.log(` - ID: ${l._id}, Name: ${l.name}, Code: ${l.code}`));

  const hindiLang = langs.find(l => l.name === 'Hindi');
  if (!hindiLang) {
    console.error('Hindi language not found in DB! Please seed it.');
    process.exit(1);
  }

  const mobileNumber = `99${Math.floor(10000000 + Math.random() * 90000000)}`;

  console.log(`\nRegistering user with mobile: ${mobileNumber}`);
  const regRes = await axios.post(`${BASE_URL}/app/auth/verify-otp`, {
    mobileNumber,
    otp: '1234'
  }, { headers: { 'Content-Type': 'application/json' } });

  const { userId, accessToken } = regRes.data;
  console.log(`Registered user. userId: ${userId}`);

  let userDoc = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
  console.log(`Initial state in DB -> preferredLanguage: ${userDoc.preferredLanguage}, skipped: ${userDoc.languageSelectionSkipped}`);

  console.log(`\nTesting Skip Language endpoint...`);
  const skipRes = await axios.post(`${BASE_URL}/app/auth/language/${userId}/skip`, {}, { headers: { 'Content-Type': 'application/json' } });
  console.log('Skip response:', skipRes.data);

  userDoc = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
  console.log(`After Skip state in DB -> preferredLanguage: ${userDoc.preferredLanguage}, skipped: ${userDoc.languageSelectionSkipped}`);

  console.log(`\nTesting Set Language endpoint with code 'hi'...`);
  const setHiRes = await axios.post(`${BASE_URL}/app/auth/language/${userId}`, {
    language: 'hi'
  }, { headers: { 'Content-Type': 'application/json' } });
  console.log('Set Hi response:', setHiRes.data);

  userDoc = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
  console.log(`After Set Hi state in DB -> preferredLanguage: ${userDoc.preferredLanguage}, skipped: ${userDoc.languageSelectionSkipped}`);

  const targetIdStr = hindiLang._id.toString();
  console.log(`\nTesting Set Language endpoint with ObjectId '${targetIdStr}'...`);
  const setIdRes = await axios.post(`${BASE_URL}/app/auth/language/${userId}`, {
    language: targetIdStr
  }, { headers: { 'Content-Type': 'application/json' } });
  console.log('Set ID response:', setIdRes.data);

  userDoc = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
  console.log(`After Set ID state in DB -> preferredLanguage: ${userDoc.preferredLanguage}, skipped: ${userDoc.languageSelectionSkipped}`);

  await usersCollection.deleteOne({ _id: new mongoose.Types.ObjectId(userId) });
  console.log('\nCleaned up test user.');

  await mongoose.disconnect();
}

run().catch(async err => {
  console.error('Error:', err.message, err.response?.data);
  await mongoose.disconnect();
});
