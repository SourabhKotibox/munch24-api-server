import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FAQModel } from './models/FAQ';

dotenv.config();

const FAQS_TO_SEED = [
  {
    question: "How do I subscribe to a plan?",
    answer: "Go to your Profile page by clicking your avatar in the navbar. Click 'Upgrade' or select any plan tier under Subscription details and follow the instructions.",
    status: true
  },
  {
    question: "Can I watch movies and dramas offline?",
    answer: "Offline downloading is currently supported on our official mobile app. Look for the download icon next to the episodes list.",
    status: true
  },
  {
    question: "What devices are supported?",
    answer: "You can stream content on smartphones, tablets, laptops, and smart TVs via any modern web browser.",
    status: true
  },
  {
    question: "How do I update my profile details?",
    answer: "Navigate to Account Settings via the profile dropdown. You can update your display name, email, phone number, and avatar image. Click save to persist changes.",
    status: true
  },
  {
    question: "How do I add a movie or drama to my wishlist?",
    answer: "Hover over or click on any title in the homepage and click the bookmark/plus icon to add it to your Watchlist. You can access it anytime from the profile dropdown menu.",
    status: true
  },
  {
    question: "Can I cancel my subscription at any time?",
    answer: "Yes, you can cancel your subscription plan at any time from your Account Settings. You will retain access until the end of your billing cycle.",
    status: true
  },
  {
    question: "Why is a lock icon showing on some episodes?",
    answer: "Some episodes require a specific premium subscription tier. If your current subscription plan is lower than required, you will see a lock icon and need to upgrade to play.",
    status: true
  },
  {
    question: "What video qualities are supported?",
    answer: "We support HD (720p), Full HD (1080p), and Ultra HD (4K) depending on the subscription plan you choose.",
    status: true
  },
  {
    question: "How do I reset my account password?",
    answer: "Click 'Sign In' in the navbar, select the 'Forgot Password' option, and follow the instructions sent to your registered email address.",
    status: true
  },
  {
    question: "How do I contact customer support?",
    answer: "If your issue isn't covered in these FAQs, feel free to email our customer support team directly at support@tripleminds.com or initiate a live chat.",
    status: true
  }
];

async function runSeed() {
  try {
    console.log('Connecting to database...');
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not set');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    console.log('Clearing existing FAQs...');
    await FAQModel.deleteMany({});
    
    console.log('Seeding 10 FAQs...');
    await FAQModel.insertMany(FAQS_TO_SEED);
    console.log('Seeding complete!');
    
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during seed process:', error);
    try {
      await mongoose.connection.close();
    } catch {}
    process.exit(1);
  }
}

runSeed();
