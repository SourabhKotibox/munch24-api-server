require('dotenv').config();
const mongoose = require('mongoose');

// The Page schema from backend
const PageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: String,
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const PageModel = mongoose.models.Page || mongoose.model('Page', PageSchema);

const pagesToSeed = [
  {
    title: "Privacy Policy",
    slug: "privacy-policy",
    content: "<h1>Privacy Policy</h1><p>Welcome to our Privacy Policy page. Here we explain how we collect, use, and protect your data.</p>",
    status: "published",
    order: 1
  },
  {
    title: "Terms of Service",
    slug: "terms-of-service",
    content: "<h1>Terms of Service</h1><p>Welcome to our Terms of Service. Please read these terms carefully before using our platform.</p>",
    status: "published",
    order: 2
  },
  {
    title: "About Us",
    slug: "about-us",
    content: "<h1>About Us</h1><p>We are a premium OTT platform dedicated to bringing you the best movies, TV shows, and short dramas from around the world.</p>",
    status: "published",
    order: 3
  },
  {
    title: "Contact Us",
    slug: "contact",
    content: "<h1>Contact Us</h1><p>Have any questions or concerns? Reach out to us at support@example.com.</p>",
    status: "published",
    order: 4
  },
  {
    title: "Help",
    slug: "help",
    content: "<h1>Help Center</h1><p>Find answers to frequently asked questions and learn how to get the most out of your subscription.</p>",
    status: "published",
    order: 5
  },
  {
    title: "Cookie Policy",
    slug: "cookie-policy",
    content: "<h1>Cookie Policy</h1><p>We use cookies to improve your experience. By continuing to visit this site you agree to our use of cookies.</p>",
    status: "published",
    order: 6
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const page of pagesToSeed) {
      const existing = await PageModel.findOne({ slug: page.slug });
      if (!existing) {
        await PageModel.create(page);
        console.log(`Seeded page: ${page.title}`);
      } else {
        console.log(`Page already exists: ${page.title}`);
      }
    }

    console.log('Seeding pages complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding pages:', error);
    process.exit(1);
  }
}

seed();
