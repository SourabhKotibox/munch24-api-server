require('dotenv').config();
const mongoose = require('mongoose');

const CrewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    designation: { type: String, required: true },
    image: String,
    status: { type: Boolean, default: true },
    approvalStatus: {
      type: String,
      enum: ['published', 'draft', 'moderation', 'rejected'],
      default: 'draft',
      index: true,
    },
  },
  { timestamps: true }
);
const CrewModel = mongoose.models.Crew || mongoose.model('Crew', CrewSchema);

const CREWS = [
  {
    name: 'Hans Zimmer',
    designation: 'Composer',
    image: 'https://image.tmdb.org/t/p/w500/tpQnDeHY15szIXiqJ4x1b4BmM29.jpg',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Roger Deakins',
    designation: 'Cinematographer',
    image: 'https://image.tmdb.org/t/p/w500/usZqBq82R8Xm14Yx6B7E1iX7h7y.jpg',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Kathleen Kennedy',
    designation: 'Producer',
    image: 'https://image.tmdb.org/t/p/w500/w0q9yM7tGjQ2x2tK1lI7R4r7dO5.jpg',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Aaron Sorkin',
    designation: 'Writer',
    image: 'https://image.tmdb.org/t/p/w500/t9J7Q3oY3L1Q0Qy4y5v7U0O5K3O.jpg',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'John Williams',
    designation: 'Composer',
    image: 'https://image.tmdb.org/t/p/w500/pA5x1tG5Xwz6B8nKx0Y9W1V9q8b.jpg',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Kevin Feige',
    designation: 'Producer',
    image: 'https://image.tmdb.org/t/p/w500/x5O7v4T1v0Y7kX0v8U7A3k7R6wE.jpg',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Emmanuel Lubezki',
    designation: 'Cinematographer',
    image: 'https://image.tmdb.org/t/p/w500/e9Q3d4l7t2cO5K2c8h3P1g5d4m.jpg',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Ennio Morricone',
    designation: 'Composer',
    image: 'https://image.tmdb.org/t/p/w500/y6x3k5p4X5A4H1Z0V8Z5J8h4N1x.jpg',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Thelma Schoonmaker',
    designation: 'Editor',
    image: 'https://image.tmdb.org/t/p/w500/s9Y1E7x8O1L5h4D1E5w7K7M8c9U.jpg',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Michael Kahn',
    designation: 'Editor',
    image: 'https://image.tmdb.org/t/p/w500/8d8K5b5K7k9Y9w7D9n4l7O4Q3T6.jpg',
    approvalStatus: 'published',
    status: true
  }
];

async function seedCrew() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    let count = 0;
    for (const crew of CREWS) {
      const existing = await CrewModel.findOne({ name: crew.name });
      if (!existing) {
        await CrewModel.create(crew);
        count++;
      }
    }
    console.log(`Seeded ${count} crew members.`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedCrew();
