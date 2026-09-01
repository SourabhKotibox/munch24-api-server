import mongoose from 'mongoose';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

import { MovieModel } from './models/Movie';
import { ContentModel } from './models/Content';
import { EpisodeModel } from './models/Episode';
import { GenreModel } from './models/Genre';
import { LanguageModel } from './models/Language';
import { connectMongoDB } from './lib/mongodb';

const demoHlsUrl = 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';

const movieData = [
  {
    title: "Shadows in the Mist",
    description: "A detective unravels a series of unexplained disappearances in a foggy coastal town, uncovering secrets the locals would prefer left buried.",
    shortDescription: "A dark mystery unfolds in a foggy coastal town.",
    genres: ["Thriller", "Mystery"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.4,
    thumbnail: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Neon Horizon",
    description: "In a cyberpunk metropolis, a rogue hacker discovers a hidden code that could collapse the city's virtual reality sky, putting her in the crosshairs of a ruthless corporation.",
    shortDescription: "A rogue hacker fights for reality in a cyberpunk city.",
    genres: ["Sci-Fi", "Action"],
    languages: ["English"],
    year: 2025,
    imdbRating: 8.1,
    thumbnail: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "The Last Sanctuary",
    description: "A group of wildlife researchers struggle to protect the last remaining untouched valley in the Amazon from a greedy logging corporation.",
    shortDescription: "Researchers fight to protect an Amazon sanctuary.",
    genres: ["Adventure", "Drama"],
    languages: ["English", "Spanish"],
    year: 2023,
    imdbRating: 6.9,
    thumbnail: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Echoes of Yesterday",
    description: "Two former high school sweethearts cross paths in Paris after ten years apart, forcing them to confront the choices that tore them away.",
    shortDescription: "Former lovers reunite in Paris after a decade.",
    genres: ["Romance", "Drama"],
    languages: ["English", "French"],
    year: 2024,
    imdbRating: 7.2,
    thumbnail: "https://images.unsplash.com/photo-1507504038482-7621c37c3f9d?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1507504038482-7621c37c3f9d?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1507504038482-7621c37c3f9d?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Silicon Valley Dream",
    description: "The dramatic rise and fall of a visionary software engineer who created a revolutionary AI startup, exploring the costs of success and greed.",
    shortDescription: "The rise and fall of a brilliant tech entrepreneur.",
    genres: ["Biography", "Drama"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.9,
    thumbnail: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Cabin 44",
    description: "A weekend getaway goes terribly wrong when college friends discover the dark, ritualistic history of their rented forest cabin.",
    shortDescription: "A weekend trip turns into a forest nightmare.",
    genres: ["Horror", "Mystery"],
    languages: ["English"],
    year: 2023,
    imdbRating: 6.1,
    thumbnail: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Quantum Paradox",
    description: "A physics lab experiment goes wrong, causing time to loop for the crew trapped inside. They must find the source before they vanish completely.",
    shortDescription: "Trapped in a repeating loop of time.",
    genres: ["Sci-Fi", "Thriller"],
    languages: ["English"],
    year: 2025,
    imdbRating: 7.6,
    thumbnail: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Undercover Gambit",
    description: "An FBI agent goes deep undercover to dismantle an international art smuggling ring, but finds himself falling for the ringleader's sister.",
    shortDescription: "An undercover agent faces a dangerous conflict of interest.",
    genres: ["Crime", "Action"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.0,
    thumbnail: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "The Comedy Club",
    description: "An aspiring stand-up comedian struggles to find her voice in local comedy clubs while balancing family expectations and a day job.",
    shortDescription: "A stand-up comedian's road to finding her voice.",
    genres: ["Comedy", "Drama"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.3,
    thumbnail: "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Legends of the Oasis",
    description: "A young explorer embarks on a high-stakes quest to locate a mythical fountain in the heart of the Sahara desert to cure his ailing father.",
    shortDescription: "A quest to find a healing oasis in the desert.",
    genres: ["Fantasy", "Adventure"],
    languages: ["English"],
    year: 2024,
    imdbRating: 6.8,
    thumbnail: "https://images.unsplash.com/photo-1539650116574-8efeb43e2750?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1539650116574-8efeb43e2750?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1539650116574-8efeb43e2750?w=600&h=900&fit=crop&q=80"
  }
];

const seriesData = [
  {
    title: "Chronicles of the Kingdom",
    description: "A massive political struggle for power and territorial control unfolds between three noble families following the sudden demise of the king.",
    shortDescription: "Three noble families clash for control of a kingdom.",
    genres: ["Fantasy", "Drama"],
    languages: ["English"],
    year: 2023,
    imdbRating: 8.8,
    thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Code Red",
    description: "A highly classified special operations team handles extreme global crises that international governments cannot officially acknowledge.",
    shortDescription: "A secret special ops team handles global crises.",
    genres: ["Action", "Thriller"],
    languages: ["English"],
    year: 2024,
    imdbRating: 8.3,
    thumbnail: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "The Chef's Table",
    description: "A talented head chef at a Michelin-star restaurant navigates daily kitchen drama, demanding food critics, and unexpected romance.",
    shortDescription: "Drama and romance in a high-end restaurant kitchen.",
    genres: ["Comedy", "Romance"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.9,
    thumbnail: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Gridlock",
    description: "A gritty look at the war between a dedicated local police task force and a powerful drug syndicate trying to take over the city.",
    shortDescription: "A police force goes head-to-head with a drug syndicate.",
    genres: ["Crime", "Drama"],
    languages: ["English"],
    year: 2023,
    imdbRating: 8.5,
    thumbnail: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Time Travelers",
    description: "A team of historians and physicists travel to different historical eras to prevent rogue temporal agents from altering human history.",
    shortDescription: "Protecting history from temporal interference.",
    genres: ["Sci-Fi", "Adventure"],
    languages: ["English"],
    year: 2025,
    imdbRating: 8.2,
    thumbnail: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Haunted Manor",
    description: "An estranged family inherits a sprawling, historic country estate, only to find that the house holds terrifying secrets.",
    shortDescription: "A historic estate haunted by terrifying secrets.",
    genres: ["Horror", "Mystery"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.7,
    thumbnail: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "The Art of Deception",
    description: "A master con artist teaches an intelligent young protégé the secrets of high-stakes corporate espionage and deception.",
    shortDescription: "A young protégé learns the trade of high-stakes conning.",
    genres: ["Thriller", "Crime"],
    languages: ["English"],
    year: 2024,
    imdbRating: 8.0,
    thumbnail: "https://images.unsplash.com/photo-1501139083538-0139883ac327?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1501139083538-0139883ac327?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1501139083538-0139883ac327?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Mind Games",
    description: "A brilliant criminal psychologist assists a city homicide division in understanding and profiling the city's most complex minds.",
    shortDescription: "A criminal psychologist profiles homicide suspects.",
    genres: ["Drama", "Mystery"],
    languages: ["English"],
    year: 2024,
    imdbRating: 8.4,
    thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Star Bound",
    description: "The exploratory crew of the starship Pathfinder faces the challenges of deep space exploration, technical failure, and first contact.",
    shortDescription: "A starship crew faces deep space challenges.",
    genres: ["Sci-Fi", "Adventure"],
    languages: ["English"],
    year: 2024,
    imdbRating: 8.1,
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "The Startup Life",
    description: "A satirical look at a group of chaotic tech startup founders as they try to launch their app while surviving San Francisco's tech scene.",
    shortDescription: "A satirical look at tech startup founders.",
    genres: ["Comedy", "Drama"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.6,
    thumbnail: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&h=900&fit=crop&q=80"
  }
];

const dramaData = [
  {
    title: "CEO's Hidden Love",
    description: "A billionaire CEO goes to great lengths to hide his relationship with a young intern to protect her from his family's strict social expectations.",
    shortDescription: "A billionaire CEO conceals his office relationship.",
    genres: ["Romance", "Drama"],
    languages: ["English", "Hindi"],
    year: 2024,
    imdbRating: 7.2,
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Rebirth of the Heiress",
    description: "After being betrayed and stripped of her inheritance, a wealthy heiress returns with a new identity to systematically dismantle her betrayers.",
    shortDescription: "A betrayed heiress returns under a new identity.",
    genres: ["Drama", "Romance"],
    languages: ["English", "Hindi"],
    year: 2024,
    imdbRating: 7.8,
    thumbnail: "https://images.unsplash.com/photo-1507504038482-7621c37c3f9d?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1507504038482-7621c37c3f9d?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1507504038482-7621c37c3f9d?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "The Billionaire's Double Life",
    description: "A prominent tech tycoon lives a double life as a simple gardener to find true love with someone who doesn't know about his net worth.",
    shortDescription: "A tech tycoon poses as a gardener to find real love.",
    genres: ["Romance", "Comedy"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.0,
    thumbnail: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Silent Echoes",
    description: "A mute witness to a high-level crime must navigate a dangerous game of survival to communicate the truth before she is silenced forever.",
    shortDescription: "A mute witness must communicate a dark secret.",
    genres: ["Thriller", "Drama"],
    languages: ["English"],
    year: 2024,
    imdbRating: 8.0,
    thumbnail: "https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Contract Marriage with the Tycoon",
    description: "An ordinary young woman enters into a contract marriage with a cold business tycoon, but their mock arrangement soon feels all too real.",
    shortDescription: "A contract marriage leads to genuine feelings.",
    genres: ["Romance", "Drama"],
    languages: ["English", "Hindi"],
    year: 2024,
    imdbRating: 7.5,
    thumbnail: "https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Vengeance After Dark",
    description: "A determined hacker carries out a calculated plan of digital vengeance against the politicians who framed her father for treason.",
    shortDescription: "A hacker seeks justice against corrupt politicians.",
    genres: ["Crime", "Thriller"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.9,
    thumbnail: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Accidental Soulmates",
    description: "A double-booking error forces two complete opposites to share a secluded forest cabin during a massive winter blizzard.",
    shortDescription: "Two opposites are forced to share a winter cabin.",
    genres: ["Romance", "Comedy"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.1,
    thumbnail: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Secret of the Boardroom",
    description: "A junior analyst discovers a conspiracy of corporate espionage within her company and is forced to decide where her loyalties lie.",
    shortDescription: "A junior analyst uncovers corporate espionage.",
    genres: ["Drama", "Thriller"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.4,
    thumbnail: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "Destined to Meet",
    description: "Two people who share a hidden link to a tragic incident keep crossing paths in the city, slowly discovering the truth behind their connection.",
    shortDescription: "Two strangers find they share a tragic past link.",
    genres: ["Romance", "Drama"],
    languages: ["English"],
    year: 2024,
    imdbRating: 7.6,
    thumbnail: "https://images.unsplash.com/photo-1478720568477-152d9b164e63?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1478720568477-152d9b164e63?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1478720568477-152d9b164e63?w=600&h=900&fit=crop&q=80"
  },
  {
    title: "The Masked Singer's Heart",
    description: "A famous pop star who performs under a mask falls for a music teacher who openly expresses her dislike for celebrities.",
    shortDescription: "A masked pop star falls for a music teacher.",
    genres: ["Romance", "Drama"],
    languages: ["English", "Hindi"],
    year: 2024,
    imdbRating: 7.3,
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=600&fit=crop&q=80",
    bannerImage: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&h=600&fit=crop&q=80",
    posterImage: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=900&fit=crop&q=80"
  }
];

async function addMediaSeed() {
  try {
    console.log('Connecting to database...');
    const connected = await connectMongoDB();
    if (!connected) {
      console.error('Failed to connect to MongoDB');
      process.exit(1);
    }

    // Load genres & languages from database
    const dbGenres = await GenreModel.find().lean();
    const genreMap = new Map(dbGenres.map(g => [g.name.toLowerCase(), g._id]));

    const dbLanguages = await LanguageModel.find().lean();
    const languageMap = new Map(dbLanguages.map(l => [l.name.toLowerCase(), l._id]));

    const getGenreIds = (genres: string[]) => genres.map(g => genreMap.get(g.toLowerCase())).filter(Boolean);
    const getLanguageIds = (langs: string[]) => langs.map(l => languageMap.get(l.toLowerCase())).filter(Boolean);

    console.log('Seeding 10 Movies...');
    for (const movie of movieData) {
      const gIds = getGenreIds(movie.genres);
      const lIds = getLanguageIds(movie.languages);

      await MovieModel.create({
        title: movie.title,
        description: movie.description,
        shortDescription: movie.shortDescription,
        genres: gIds,
        languages: lIds,
        subtitleLanguages: lIds,
        audioLanguages: lIds,
        year: movie.year,
        rating: 'PG-13',
        ageRating: 13,
        status: 'published',
        hlsUrl: demoHlsUrl,
        imdbRating: movie.imdbRating,
        thumbnail: movie.thumbnail,
        bannerImage: movie.bannerImage,
        posterImage: movie.posterImage,
        views: Math.floor(Math.random() * 50000) + 1000,
        likes: Math.floor(Math.random() * 5000) + 100,
        shares: Math.floor(Math.random() * 1000) + 10,
        tags: [...movie.genres.map(g => g.toLowerCase()), 'movie', 'premium'],
        planRequired: 'premium'
      });
    }

    console.log('Seeding 10 TV Series and their episodes...');
    for (const series of seriesData) {
      const gIds = getGenreIds(series.genres);
      const lIds = getLanguageIds(series.languages);

      const content = await ContentModel.create({
        title: series.title,
        type: 'series',
        contentType: 'series',
        description: series.description,
        shortDescription: series.shortDescription,
        genres: gIds,
        languages: lIds,
        subtitleLanguages: lIds,
        audioLanguages: lIds,
        year: series.year,
        rating: 'TV-14',
        ageRating: 14,
        status: 'published',
        hlsUrl: demoHlsUrl,
        imdbRating: series.imdbRating,
        thumbnail: series.thumbnail,
        bannerImage: series.bannerImage,
        posterImage: series.posterImage,
        views: Math.floor(Math.random() * 80000) + 2000,
        likes: Math.floor(Math.random() * 8000) + 200,
        shares: Math.floor(Math.random() * 2000) + 20,
        tags: [...series.genres.map(g => g.toLowerCase()), 'series', 'premium'],
        seasons: 1,
        planRequired: 'premium'
      });

      // Create 3 episodes for this series
      for (let epNum = 1; epNum <= 3; epNum++) {
        await EpisodeModel.create({
          contentId: content._id,
          season: 1,
          episode: epNum,
          title: epNum === 1 ? 'Pilot' : epNum === 2 ? 'The Plot Thickens' : 'Season Finale',
          description: `This is the exciting episode ${epNum} of the hit series ${series.title}.`,
          thumbnail: series.thumbnail,
          hlsUrl: demoHlsUrl,
          duration: 2400, // 40 minutes
          views: Math.floor(Math.random() * 10000) + 500,
          likes: Math.floor(Math.random() * 1000) + 50,
          isFree: epNum === 1, // Episode 1 is free, others require plan
          isLocked: epNum !== 1,
          processingStatus: 'ready'
        });
      }
    }

    console.log('Seeding 10 Short Dramas and their episodes...');
    for (const drama of dramaData) {
      const gIds = getGenreIds(drama.genres);
      const lIds = getLanguageIds(drama.languages);

      const content = await ContentModel.create({
        title: drama.title,
        type: 'series',
        contentType: 'drama',
        description: drama.description,
        shortDescription: drama.shortDescription,
        genres: gIds,
        languages: lIds,
        subtitleLanguages: lIds,
        audioLanguages: lIds,
        year: drama.year,
        rating: 'TV-14',
        ageRating: 14,
        status: 'published',
        hlsUrl: demoHlsUrl,
        imdbRating: drama.imdbRating,
        thumbnail: drama.thumbnail,
        bannerImage: drama.bannerImage,
        posterImage: drama.posterImage,
        views: Math.floor(Math.random() * 150000) + 5000,
        likes: Math.floor(Math.random() * 15000) + 500,
        shares: Math.floor(Math.random() * 5000) + 50,
        tags: [...drama.genres.map(g => g.toLowerCase()), 'drama', 'short-drama', 'popular'],
        seasons: 1,
        planRequired: 'premium'
      });

      // Create 3 episodes for this short drama
      for (let epNum = 1; epNum <= 3; epNum++) {
        await EpisodeModel.create({
          contentId: content._id,
          season: 1,
          episode: epNum,
          title: epNum === 1 ? 'The Secret Encounter' : epNum === 2 ? 'Tensions Rise' : 'The Climax',
          description: `This is the exciting episode ${epNum} of the drama ${drama.title}.`,
          thumbnail: drama.thumbnail,
          hlsUrl: demoHlsUrl,
          duration: 120, // 2 minutes (short dramas are usually 1-3 mins per episode)
          views: Math.floor(Math.random() * 30000) + 1000,
          likes: Math.floor(Math.random() * 3000) + 100,
          isFree: epNum === 1, // Episode 1 is free, others are locked
          isLocked: epNum !== 1,
          processingStatus: 'ready'
        });
      }
    }

    console.log('All 30 media items seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

addMediaSeed();
