/**
 * seed-ads.ts
 * Seeds the database with test ads for all placements:
 * - Home Page (Banner)
 * - Player (Pre-roll)
 * 
 * Run with: npx ts-node -e "require('./src/seed-ads')"
 * Or: npx tsx src/seed-ads.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { AdModel } from './models/Ad';

dotenv.config();

const TEST_ADS = [
  // ─── HOME PAGE BANNER ADS ───
  {
    adName: '🧪 [TEST] Home Banner - Premium Movies',
    adType: 'Image' as const,
    urlType: 'URL' as const,
    mediaUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&h=300&fit=crop&auto=format',
    placement: 'Home Page',
    redirectUrl: 'https://example.com',
    targetContentType: 'Movie',
    status: 'active' as const,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    impressions: 0,
    clicks: 0,
  },
  {
    adName: '🧪 [TEST] Home Banner - Netflix Style',
    adType: 'Custom' as const,
    urlType: 'URL' as const,
    mediaUrl: `
      <div style="background: linear-gradient(135deg, #e50914 0%, #b81d24 50%, #0c0c14 100%); padding: 28px 32px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; gap: 24px; font-family: sans-serif;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="background: rgba(255,255,255,0.15); color: white; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px; letter-spacing: 1.5px; text-transform: uppercase;">SPONSORED</span>
          </div>
          <h3 style="color: white; font-size: 22px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.3px;">Unlimited Entertainment</h3>
          <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 0 0 16px 0; line-height: 1.5;">Watch thousands of movies & shows. Start your free trial today!</p>
          <button onclick="window.open('https://example.com','_blank')" style="background: white; color: #e50914; font-size: 13px; font-weight: 800; padding: 10px 24px; border-radius: 8px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            Start Free Trial →
          </button>
        </div>
        <div style="flex-shrink: 0; font-size: 80px;">🎬</div>
      </div>
    `,
    placement: 'Home Page',
    redirectUrl: 'https://example.com',
    targetContentType: 'All',
    status: 'active' as const,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    impressions: 0,
    clicks: 0,
  },

  // ─── PLAYER PRE-ROLL ADS ───
  {
    adName: '🧪 [TEST] Player Pre-roll - Image Ad',
    adType: 'Image' as const,
    urlType: 'URL' as const,
    mediaUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop&auto=format',
    placement: 'Player',
    redirectUrl: 'https://example.com',
    targetContentType: 'All',
    status: 'active' as const,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    impressions: 0,
    clicks: 0,
  },
  {
    adName: '🧪 [TEST] Player Pre-roll - Custom HTML Ad',
    adType: 'Custom' as const,
    urlType: 'URL' as const,
    mediaUrl: `
      <div style="width:100%; height:100%; background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; font-family:sans-serif; min-height:200px;">
        <div style="text-align:center; padding: 0 24px;">
          <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(229,9,20,0.15); border:1px solid rgba(229,9,20,0.3); color:#e50914; font-size:11px; font-weight:800; padding:4px 14px; border-radius:20px; letter-spacing:1px; text-transform:uppercase; margin-bottom:20px;">📢 Advertisement</div>
          <h2 style="color:white; font-size:clamp(18px,4vw,36px); font-weight:900; margin:0 0 12px 0; letter-spacing:-0.5px;">The Streaming Revolution<br/>is Here.</h2>
          <p style="color:rgba(255,255,255,0.7); font-size:clamp(12px,2vw,15px); max-width:480px; line-height:1.6; margin:0 auto 24px auto;">Millions of movies. Thousands of TV shows. Unlimited short dramas. All in one place.</p>
          <button onclick="window.open('https://example.com','_blank')" style="background:linear-gradient(135deg,#e50914,#b81d24); color:white; font-size:14px; font-weight:800; padding:12px 32px; border-radius:12px; border:none; cursor:pointer; box-shadow:0 8px 24px rgba(229,9,20,0.4); letter-spacing:0.3px;">
            Get Started Free →
          </button>
        </div>
      </div>
    `,
    placement: 'Player',
    redirectUrl: 'https://example.com',
    targetContentType: 'All',
    status: 'active' as const,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    impressions: 0,
    clicks: 0,
  },
];

async function seedAds() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('❌ MONGODB_URI not set in .env');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 Checking for existing test ads...');
    const existingTestAds = await AdModel.find({ adName: /^\🧪 \[TEST\]/ });

    if (existingTestAds.length > 0) {
      console.log(`⚠️  Found ${existingTestAds.length} existing test ads — removing them first...`);
      await AdModel.deleteMany({ adName: /^\🧪 \[TEST\]/ });
      console.log('   Removed existing test ads.\n');
    }

    console.log('📦 Inserting test ads...');
    for (const adData of TEST_ADS) {
      const ad = new AdModel(adData);
      await ad.save();
      console.log(`   ✅ Created: "${adData.adName}" → placement: "${adData.placement}"`);
    }

    const totalAds = await AdModel.countDocuments({ status: 'active' });

    console.log('\n🎉 Done! Test ads seeded successfully.');
    console.log(`📊 Total active ads in database: ${totalAds}`);
    console.log('\n💡 To verify:\n   1. Open Admin Panel → Ads section\n   2. You should see 4 test ads with 🧪 emoji prefix\n   3. Open the streaming home page to see Home Page banners\n   4. Click any movie/show to trigger Player pre-roll ad');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding ads:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedAds();
