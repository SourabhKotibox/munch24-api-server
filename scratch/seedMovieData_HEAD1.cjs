/**
 * Full Movie Data Seeder
 * Seeds genres, actors, directors, then patches ALL 30 movies with proper data.
 * Run: node scripts/seedMovieData.cjs
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// ── Seed Data ──────────────────────────────────────────────────────────────────

const GENRES_TO_CREATE = [
  { name: 'Action' },
  { name: 'Drama' },
  { name: 'Thriller' },
  { name: 'Romance' },
  { name: 'Comedy' },
  { name: 'Sci-Fi' },
  { name: 'Horror' },
  { name: 'Adventure' },
  { name: 'Family' },
  { name: 'Mystery' },
];

const ACTORS_TO_CREATE = [
  { name: 'Rajesh Kumar', image: 'https://i.pravatar.cc/300?img=1', designation: 'Lead Actor' },
  { name: 'Priya Sharma', image: 'https://i.pravatar.cc/300?img=5', designation: 'Lead Actress' },
  { name: 'Arjun Singh', image: 'https://i.pravatar.cc/300?img=8', designation: 'Supporting Actor' },
  { name: 'Meera Nair', image: 'https://i.pravatar.cc/300?img=9', designation: 'Supporting Actress' },
  { name: 'Vikram Patel', image: 'https://i.pravatar.cc/300?img=12', designation: 'Character Actor' },
  { name: 'Sunita Reddy', image: 'https://i.pravatar.cc/300?img=16', designation: 'Lead Actress' },
  { name: 'Anil Kapoor Jr.', image: 'https://i.pravatar.cc/300?img=18', designation: 'Lead Actor' },
  { name: 'Deepa Menon', image: 'https://i.pravatar.cc/300?img=20', designation: 'Supporting Actress' },
];

const DIRECTORS_TO_CREATE = [
  { name: 'Rohit Shetty Kumar', image: 'https://i.pravatar.cc/300?img=33', designation: 'Director' },
  { name: 'Anurag Bose', image: 'https://i.pravatar.cc/300?img=36', designation: 'Director' },
  { name: 'Zoya Akhtar Patel', image: 'https://i.pravatar.cc/300?img=44', designation: 'Director' },
  { name: 'Kabir Khan Singh', image: 'https://i.pravatar.cc/300?img=50', designation: 'Director' },
];

// Per-movie detail overrides for all 30 movies
const MOVIE_DETAILS = [
  {
    title: 'Neon Prophecy',
    genres: ['Sci-Fi', 'Thriller'],
    languages: ['Hindi', 'English'],
    cast: [
      { actorName: 'Rajesh Kumar', character: 'Agent Neon', role: 'Lead Actor' },
      { actorName: 'Priya Sharma', character: 'Dr. Aanya', role: 'Lead Actress' },
      { actorName: 'Arjun Singh', character: 'Commander Vex', role: 'Supporting Actor' },
    ],
    director: 'Rohit Shetty Kumar',
  },
  {
    title: 'The Last Heist',
    genres: ['Action', 'Thriller'],
    languages: ['Hindi'],
    cast: [
      { actorName: 'Vikram Patel', character: 'Marco', role: 'Lead Actor' },
      { actorName: 'Meera Nair', character: 'Elena', role: 'Lead Actress' },
      { actorName: 'Anil Kapoor Jr.', character: 'Don', role: 'Villain' },
    ],
    director: 'Anurag Bose',
  },
  {
    title: 'Echoes of Tomorrow',
    genres: ['Drama', 'Romance'],
    languages: ['Tamil', 'Telugu'],
    cast: [
      { actorName: 'Arjun Singh', character: 'Aryan', role: 'Lead Actor' },
      { actorName: 'Sunita Reddy', character: 'Zara', role: 'Lead Actress' },
      { actorName: 'Deepa Menon', character: 'Mother', role: 'Supporting Actress' },
    ],
    director: 'Zoya Akhtar Patel',
  },
  {
    title: 'Brave Heart Warriors',
    genres: ['Action', 'Adventure'],
    languages: ['Hindi', 'Malayalam'],
    cast: [
      { actorName: 'Rajesh Kumar', character: 'Captain Veer', role: 'Lead Actor' },
      { actorName: 'Arjun Singh', character: 'Lt. Dev', role: 'Supporting Actor' },
      { actorName: 'Meera Nair', character: 'Kavya', role: 'Lead Actress' },
    ],
    director: 'Kabir Khan Singh',
  },
  {
    title: 'Love in Tokyo',
    genres: ['Romance', 'Drama'],
    languages: ['Hindi', 'Bengali'],
    cast: [
      { actorName: 'Anil Kapoor Jr.', character: 'Rohan', role: 'Lead Actor' },
      { actorName: 'Priya Sharma', character: 'Sakura', role: 'Lead Actress' },
      { actorName: 'Deepa Menon', character: 'Aunt Rina', role: 'Supporting Actress' },
    ],
    director: 'Zoya Akhtar Patel',
  },
  {
    title: 'Shadow Protocol',
    genres: ['Thriller', 'Mystery'],
    languages: ['Hindi', 'Marathi'],
    cast: [
      { actorName: 'Vikram Patel', character: 'Agent X', role: 'Lead Actor' },
      { actorName: 'Sunita Reddy', character: 'Dr. Preethi', role: 'Lead Actress' },
      { actorName: 'Arjun Singh', character: 'Handler', role: 'Supporting Actor' },
    ],
    director: 'Anurag Bose',
  },
  {
    title: 'The Comedy Club',
    genres: ['Comedy', 'Drama'],
    languages: ['Hindi', 'Gujarati'],
    cast: [
      { actorName: 'Rajesh Kumar', character: 'Raju Bhai', role: 'Lead Actor' },
      { actorName: 'Deepa Menon', character: 'Simran', role: 'Lead Actress' },
      { actorName: 'Meera Nair', character: 'Boss Lady', role: 'Supporting Actress' },
    ],
    director: 'Rohit Shetty Kumar',
  },
  {
    title: 'Family Adventure',
    genres: ['Family', 'Adventure'],
    languages: ['Hindi', 'Kannada'],
    cast: [
      { actorName: 'Anil Kapoor Jr.', character: 'Papa', role: 'Lead Actor' },
      { actorName: 'Priya Sharma', character: 'Mama', role: 'Lead Actress' },
      { actorName: 'Arjun Singh', character: 'Uncle Raj', role: 'Supporting Actor' },
    ],
    director: 'Kabir Khan Singh',
  },
  {
    title: 'Midnight Detective',
    genres: ['Mystery', 'Thriller'],
    languages: ['Tamil', 'Telugu'],
    cast: [
      { actorName: 'Vikram Patel', character: 'Inspector Roy', role: 'Lead Actor' },
      { actorName: 'Sunita Reddy', character: 'Witness Maya', role: 'Lead Actress' },
      { actorName: 'Rajesh Kumar', character: 'Suspect Khan', role: 'Supporting Actor' },
    ],
    director: 'Anurag Bose',
  },
  {
    title: 'Galaxy Quest II',
    genres: ['Sci-Fi', 'Adventure'],
    languages: ['Hindi', 'Punjabi'],
    cast: [
      { actorName: 'Arjun Singh', character: 'Capt. Starr', role: 'Lead Actor' },
      { actorName: 'Meera Nair', character: 'Navigator Lyra', role: 'Lead Actress' },
      { actorName: 'Vikram Patel', character: 'Alien Chief', role: 'Villain' },
    ],
    director: 'Rohit Shetty Kumar',
  },
  {
    title: 'Summer Romance',
    genres: ['Romance', 'Drama'],
    languages: ['Hindi', 'Kannada'],
    cast: [
      { actorName: 'Priya Sharma', character: 'Sofia', role: 'Lead Actress' },
      { actorName: 'Rajesh Kumar', character: 'Kabir', role: 'Lead Actor' },
      { actorName: 'Sunita Reddy', character: 'Maya', role: 'Supporting Actress' },
    ],
    director: 'Zoya Akhtar Patel',
  },
  {
    title: 'Dark Forest',
    genres: ['Horror', 'Thriller'],
    languages: ['Tamil', 'Telugu'],
    cast: [
      { actorName: 'Arjun Singh', character: 'Rohan', role: 'Lead Actor' },
      { actorName: 'Meera Nair', character: 'Pooja', role: 'Lead Actress' },
      { actorName: 'Vikram Patel', character: 'Forest Guard', role: 'Supporting Actor' },
    ],
    director: 'Anurag Bose',
  },
  {
    title: 'Iron Fist',
    genres: ['Action', 'Thriller'],
    languages: ['Hindi', 'Punjabi'],
    cast: [
      { actorName: 'Rajesh Kumar', character: 'Tiger', role: 'Lead Actor' },
      { actorName: 'Arjun Singh', character: 'Inspector Rana', role: 'Supporting Actor' },
      { actorName: 'Anil Kapoor Jr.', character: 'Vikram', role: 'Lead Actor' },
    ],
    director: 'Rohit Shetty Kumar',
  },
  {
    title: 'Moon Landing',
    genres: ['Sci-Fi', 'Adventure'],
    languages: ['Hindi', 'English'],
    cast: [
      { actorName: 'Priya Sharma', character: 'Astronaut Riya', role: 'Lead Actress' },
      { actorName: 'Vikram Patel', character: 'Dr. Sen', role: 'Supporting Actor' },
      { actorName: 'Deepa Menon', character: 'Command Center voice', role: 'Supporting Actress' },
    ],
    director: 'Kabir Khan Singh',
  },
  {
    title: 'Secret Files',
    genres: ['Mystery', 'Thriller'],
    languages: ['Tamil', 'Malayalam'],
    cast: [
      { actorName: 'Sunita Reddy', character: 'Agent Ananya', role: 'Lead Actress' },
      { actorName: 'Meera Nair', character: 'Journalist Diya', role: 'Lead Actress' },
      { actorName: 'Rajesh Kumar', character: 'Minister Rawat', role: 'Supporting Actor' },
    ],
    director: 'Anurag Bose',
  },
  {
    title: 'Wedding Chaos',
    genres: ['Comedy', 'Romance'],
    languages: ['Hindi', 'Gujarati'],
    cast: [
      { actorName: 'Anil Kapoor Jr.', character: 'Groom Sid', role: 'Lead Actor' },
      { actorName: 'Priya Sharma', character: 'Bride Simran', role: 'Lead Actress' },
      { actorName: 'Deepa Menon', character: 'Dadi', role: 'Supporting Actress' },
    ],
    director: 'Zoya Akhtar Patel',
  },
  {
    title: 'Mountain Warriors',
    genres: ['Action', 'Adventure'],
    languages: ['Hindi', 'Marathi'],
    cast: [
      { actorName: 'Arjun Singh', character: 'Major Samar', role: 'Lead Actor' },
      { actorName: 'Rajesh Kumar', character: 'Havildar Pal', role: 'Supporting Actor' },
      { actorName: 'Vikram Patel', character: 'Sherpa', role: 'Supporting Actor' },
    ],
    director: 'Kabir Khan Singh',
  },
  {
    title: 'Timeless Love',
    genres: ['Romance', 'Drama'],
    languages: ['Tamil', 'Telugu'],
    cast: [
      { actorName: 'Sunita Reddy', character: 'Sneha', role: 'Lead Actress' },
      { actorName: 'Anil Kapoor Jr.', character: 'Dev', role: 'Lead Actor' },
      { actorName: 'Meera Nair', character: 'Asha', role: 'Supporting Actress' },
    ],
    director: 'Zoya Akhtar Patel',
  },
  {
    title: 'The Conspiracy',
    genres: ['Thriller', 'Mystery'],
    languages: ['Hindi', 'English'],
    cast: [
      { actorName: 'Vikram Patel', character: 'RAW Agent Kabir', role: 'Lead Actor' },
      { actorName: 'Priya Sharma', character: 'Analyst Sarah', role: 'Lead Actress' },
      { actorName: 'Arjun Singh', character: 'Target X', role: 'Supporting Actor' },
    ],
    director: 'Anurag Bose',
  },
  {
    title: 'Happy Family',
    genres: ['Family', 'Comedy'],
    languages: ['Hindi', 'Gujarati'],
    cast: [
      { actorName: 'Rajesh Kumar', character: 'Chacha ji', role: 'Lead Actor' },
      { actorName: 'Deepa Menon', character: 'Chachi ji', role: 'Lead Actress' },
      { actorName: 'Sunita Reddy', character: 'Pinky', role: 'Supporting Actress' },
    ],
    director: 'Rohit Shetty Kumar',
  },
  {
    title: 'Godfather Chronicles',
    genres: ['Drama', 'Thriller'],
    languages: ['Hindi', 'Marathi'],
    cast: [
      { actorName: 'Anil Kapoor Jr.', character: 'Don Shekhar', role: 'Lead Actor' },
      { actorName: 'Vikram Patel', character: 'Underboss Tony', role: 'Supporting Actor' },
      { actorName: 'Meera Nair', character: 'Nisha', role: 'Lead Actress' },
    ],
    director: 'Anurag Bose',
  },
  {
    title: 'Space Pirates',
    genres: ['Sci-Fi', 'Adventure'],
    languages: ['Hindi', 'English'],
    cast: [
      { actorName: 'Arjun Singh', character: 'Captain Hook', role: 'Lead Actor' },
      { actorName: 'Priya Sharma', character: 'Siren', role: 'Lead Actress' },
      { actorName: 'Rajesh Kumar', character: 'First Mate', role: 'Supporting Actor' },
    ],
    director: 'Rohit Shetty Kumar',
  },
  {
    title: 'Love Triangle',
    genres: ['Romance', 'Comedy'],
    languages: ['Hindi', 'Kannada'],
    cast: [
      { actorName: 'Sunita Reddy', character: 'Anjali', role: 'Lead Actress' },
      { actorName: 'Anil Kapoor Jr.', character: 'Rahul', role: 'Lead Actor' },
      { actorName: 'Priya Sharma', character: 'Tina', role: 'Lead Actress' },
    ],
    director: 'Zoya Akhtar Patel',
  },
  {
    title: 'The Assassin',
    genres: ['Action', 'Thriller'],
    languages: ['Tamil', 'Telugu'],
    cast: [
      { actorName: 'Vikram Patel', character: 'Shadow', role: 'Lead Actor' },
      { actorName: 'Arjun Singh', character: 'Target', role: 'Supporting Actor' },
      { actorName: 'Meera Nair', character: 'Handler', role: 'Supporting Actress' },
    ],
    director: 'Kabir Khan Singh',
  },
  {
    title: 'Comedy Nights',
    genres: ['Comedy', 'Drama'],
    languages: ['Hindi', 'Punjabi'],
    cast: [
      { actorName: 'Rajesh Kumar', character: 'Kapil', role: 'Lead Actor' },
      { actorName: 'Deepa Menon', character: 'Aishwarya', role: 'Lead Actress' },
      { actorName: 'Anil Kapoor Jr.', character: 'Guest Star', role: 'Special Appearance' },
    ],
    director: 'Rohit Shetty Kumar',
  },
  {
    title: 'Lost Paradise',
    genres: ['Adventure', 'Drama'],
    languages: ['Hindi', 'Malayalam'],
    cast: [
      { actorName: 'Priya Sharma', character: 'Explorer Lisa', role: 'Lead Actress' },
      { actorName: 'Sunita Reddy', character: 'Guide Neha', role: 'Supporting Actress' },
      { actorName: 'Arjun Singh', character: 'Hunter Jack', role: 'Supporting Actor' },
    ],
    director: 'Kabir Khan Singh',
  },
  {
    title: 'Cyber Storm',
    genres: ['Sci-Fi', 'Thriller'],
    languages: ['Hindi', 'English'],
    cast: [
      { actorName: 'Vikram Patel', character: 'Hacker Neo', role: 'Lead Actor' },
      { actorName: 'Rajesh Kumar', character: 'Agent Smith', role: 'Villain' },
      { actorName: 'Deepa Menon', character: 'Operator Trinity', role: 'Supporting Actress' },
    ],
    director: 'Anurag Bose',
  },
  {
    title: 'Heart of Gold',
    genres: ['Drama', 'Family'],
    languages: ['Hindi', 'Gujarati'],
    cast: [
      { actorName: 'Sunita Reddy', character: 'Gauri', role: 'Lead Actress' },
      { actorName: 'Meera Nair', character: 'Radha', role: 'Supporting Actress' },
      { actorName: 'Anil Kapoor Jr.', character: 'Shyam', role: 'Lead Actor' },
    ],
    director: 'Zoya Akhtar Patel',
  },
  {
    title: 'Street Justice',
    genres: ['Action', 'Thriller'],
    languages: ['Tamil', 'Telugu'],
    cast: [
      { actorName: 'Rajesh Kumar', character: 'Inspector Vijay', role: 'Lead Actor' },
      { actorName: 'Vikram Patel', character: 'Crime Lord Shetty', role: 'Villain' },
      { actorName: 'Arjun Singh', character: 'Sub-Inspector Dev', role: 'Supporting Actor' },
    ],
    director: 'Kabir Khan Singh',
  },
  {
    title: 'Killer Instinct',
    genres: ['Thriller', 'Horror'],
    languages: ['Hindi', 'English'],
    cast: [
      { actorName: 'Priya Sharma', character: 'Dr. Jane', role: 'Lead Actress' },
      { actorName: 'Meera Nair', character: 'Detective Miller', role: 'Supporting Actress' },
      { actorName: 'Deepa Menon', character: 'Victim Sarah', role: 'Supporting Actress' },
    ],
    director: 'Anurag Bose',
  },
];

// ── Main Seeder ────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('✅ Connected to MongoDB\n');

  // ── 0. Upsert English Language if not existing ───────────────────────────
  console.log('🌐 Checking English language...');
  const englishLang = await db.collection('languages').findOne({ name: 'English' });
  if (!englishLang) {
    await db.collection('languages').insertOne({
      name: 'English',
      code: 'en',
      image: 'languages/english.jpeg',
      isActive: true,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('  ✅ Created English language');
  } else {
    console.log('  ↩  English language already exists');
  }

  // ── 1. Upsert Genres ─────────────────────────────────────────────────────
  console.log('📂 Seeding genres...');
  const genreMap = {}; // name → _id
  for (const g of GENRES_TO_CREATE) {
    const existing = await db.collection('genres').findOne({ name: g.name });
    if (existing) {
      genreMap[g.name] = existing._id;
      console.log(`  ↩  Genre already exists: ${g.name}`);
    } else {
      const result = await db.collection('genres').insertOne({
        ...g,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      genreMap[g.name] = result.insertedId;
      console.log(`  ✅ Created genre: ${g.name}`);
    }
  }

  // ── 2. Upsert Actors ─────────────────────────────────────────────────────
  console.log('\n🎭 Seeding actors...');
  const actorMap = {}; // name → _id
  for (const a of ACTORS_TO_CREATE) {
    const existing = await db.collection('actors').findOne({ name: a.name });
    if (existing) {
      actorMap[a.name] = existing._id;
      console.log(`  ↩  Actor already exists: ${a.name}`);
    } else {
      const result = await db.collection('actors').insertOne({
        ...a,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      actorMap[a.name] = result.insertedId;
      console.log(`  ✅ Created actor: ${a.name}`);
    }
  }

  // ── 3. Upsert Directors ──────────────────────────────────────────────────
  console.log('\n🎬 Seeding directors...');
  const directorMap = {}; // name → _id
  for (const d of DIRECTORS_TO_CREATE) {
    const existing = await db.collection('directors').findOne({ name: d.name });
    if (existing) {
      directorMap[d.name] = existing._id;
      console.log(`  ↩  Director already exists: ${d.name}`);
    } else {
      const result = await db.collection('directors').insertOne({
        ...d,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      directorMap[d.name] = result.insertedId;
      console.log(`  ✅ Created director: ${d.name}`);
    }
  }

  // ── 4. Fetch language map ────────────────────────────────────────────────
  console.log('\n🌐 Loading languages...');
  const langs = await db.collection('languages').find({}).toArray();
  const langMap = {}; // name → _id
  langs.forEach(l => { langMap[l.name] = l._id; });
  console.log('  Languages available:', Object.keys(langMap).join(', '));

  // ── 5. Fetch all movies ──────────────────────────────────────────────────
  console.log('\n🎥 Fetching all movies...');
  const allMovies = await db.collection('movies').find({}).toArray();
  console.log(`  Found ${allMovies.length} movies in database\n`);

  // ── 6. Patch each movie ──────────────────────────────────────────────────
  for (const movie of allMovies) {
    const details = MOVIE_DETAILS.find(d => d.title.toLowerCase() === movie.title.toLowerCase());

    if (!details) {
      console.log(`  ⚠️ No hardcoded details found for movie: "${movie.title}". Skipping patch...`);
      continue;
    }

    // Build genre IDs
    const genreIds = details.genres.map(g => genreMap[g]).filter(Boolean);

    // Build language IDs
    const langIds = details.languages.map(l => langMap[l]).filter(Boolean);

    // Build cast array
    const cast = details.cast.map(c => ({
      actor: actorMap[c.actorName],
      character: c.character,
      role: c.role,
    })).filter(c => c.actor);

    // Build crew array
    const crew = details.director && directorMap[details.director]
      ? [{ director: directorMap[details.director], role: 'Director' }]
      : [];

    // Default video qualities if empty
    const videoQualities = [
      { quality: '1080p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 120000000 },
      { quality: '720p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 80000000 },
      { quality: '360p', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', size: 30000000 },
    ];

    await db.collection('movies').updateOne(
      { _id: movie._id },
      {
        $set: {
          genres: genreIds,
          languages: langIds,
          cast,
          crew,
          videoQualities,
          updatedAt: new Date(),
        },
      }
    );

    const genreNames = details.genres.join(', ');
    const langNames = details.languages.join(', ');
    console.log(`  ✅ Patched: "${movie.title}"`);
    console.log(`     Genres: ${genreNames}`);
    console.log(`     Languages: ${langNames}`);
    console.log(`     Cast: ${cast.length} actors | Crew: ${crew.length} directors\n`);
  }

  console.log('🎉 Seeding complete! All 30 movies now have proper genres, cast, crew, and video qualities.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seeder failed:', err);
  process.exit(1);
});
