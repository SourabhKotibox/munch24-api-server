require('dotenv').config();
const mongoose = require('mongoose');

const CountrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
const CountryModel = mongoose.models.Country || mongoose.model('Country', CountrySchema);

const ActorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    designation: { type: String, required: true },
    image: String,
    dateOfBirth: { type: Date, required: true },
    birthPlace: { type: String, required: true },
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
const ActorModel = mongoose.models.Actor || mongoose.model('Actor', ActorSchema);

const DirectorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    designation: { type: String, required: true },
    image: String,
    dateOfBirth: { type: Date, required: true },
    birthPlace: { type: String, required: true },
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
const DirectorModel = mongoose.models.Director || mongoose.model('Director', DirectorSchema);

const COUNTRIES = [
  { name: 'United States', code: 'US' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'India', code: 'IN' },
  { name: 'Canada', code: 'CA' },
  { name: 'Australia', code: 'AU' },
  { name: 'Germany', code: 'DE' },
  { name: 'France', code: 'FR' },
  { name: 'Japan', code: 'JP' },
  { name: 'South Korea', code: 'KR' },
  { name: 'China', code: 'CN' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Italy', code: 'IT' },
  { name: 'Spain', code: 'ES' },
  { name: 'Russia', code: 'RU' }
];

const ACTORS = [
  {
    name: 'Leonardo DiCaprio',
    designation: 'Actor',
    image: 'https://image.tmdb.org/t/p/w500/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg',
    dateOfBirth: new Date('1974-11-11'),
    birthPlace: 'Los Angeles, California, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Tom Hanks',
    designation: 'Actor',
    image: 'https://image.tmdb.org/t/p/w500/xndWFsBlClOJFRdhStHQYiaUNjM.jpg',
    dateOfBirth: new Date('1956-07-09'),
    birthPlace: 'Concord, California, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Shah Rukh Khan',
    designation: 'Actor',
    image: 'https://image.tmdb.org/t/p/w500/m1ZkAwHhO4B37667T0Hk9dmsL7C.jpg',
    dateOfBirth: new Date('1965-11-02'),
    birthPlace: 'New Delhi, India',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Scarlett Johansson',
    designation: 'Actress',
    image: 'https://image.tmdb.org/t/p/w500/mODcczqNBM09w0K4mN8G8O4A2E7.jpg',
    dateOfBirth: new Date('1984-11-22'),
    birthPlace: 'New York City, New York, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Brad Pitt',
    designation: 'Actor',
    image: 'https://image.tmdb.org/t/p/w500/cckcYc2v0yh1tc9QjRelptcOBko.jpg',
    dateOfBirth: new Date('1963-12-18'),
    birthPlace: 'Shawnee, Oklahoma, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Denzel Washington',
    designation: 'Actor',
    image: 'https://image.tmdb.org/t/p/w500/jj2GcqobuASYsyVcA00y501h14A.jpg',
    dateOfBirth: new Date('1954-12-28'),
    birthPlace: 'Mount Vernon, New York, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Morgan Freeman',
    designation: 'Actor',
    image: 'https://image.tmdb.org/t/p/w500/jPsLqiYGSofU4s6SjkA19A2x270.jpg',
    dateOfBirth: new Date('1937-06-01'),
    birthPlace: 'Memphis, Tennessee, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Johnny Depp',
    designation: 'Actor',
    image: 'https://image.tmdb.org/t/p/w500/kbWValB1vYfBqOQkEIfJ54pSopM.jpg',
    dateOfBirth: new Date('1963-06-09'),
    birthPlace: 'Owensboro, Kentucky, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Al Pacino',
    designation: 'Actor',
    image: 'https://image.tmdb.org/t/p/w500/fMDFeVf0pjopTJbyRSLFwNDm8Wr.jpg',
    dateOfBirth: new Date('1940-04-25'),
    birthPlace: 'New York City, New York, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Christian Bale',
    designation: 'Actor',
    image: 'https://image.tmdb.org/t/p/w500/qCpZncsGzKYTqDheg1h91k8wDMo.jpg',
    dateOfBirth: new Date('1974-01-30'),
    birthPlace: 'Haverfordwest, Wales, UK',
    approvalStatus: 'published',
    status: true
  }
];

const DIRECTORS = [
  {
    name: 'Christopher Nolan',
    designation: 'Director',
    image: 'https://image.tmdb.org/t/p/w500/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg',
    dateOfBirth: new Date('1970-07-30'),
    birthPlace: 'London, England, UK',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Steven Spielberg',
    designation: 'Director',
    image: 'https://image.tmdb.org/t/p/w500/tZxcg19YQ3e8fJ0pOs7hjlnpfB6.jpg',
    dateOfBirth: new Date('1946-12-18'),
    birthPlace: 'Cincinnati, Ohio, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Martin Scorsese',
    designation: 'Director',
    image: 'https://image.tmdb.org/t/p/w500/9U9Y5GQuWX3EZy39B8nkk4NY01S.jpg',
    dateOfBirth: new Date('1942-11-17'),
    birthPlace: 'New York City, New York, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Quentin Tarantino',
    designation: 'Director',
    image: 'https://image.tmdb.org/t/p/w500/1gjcpAa99FAOWGnrUvHEXXsRsLS.jpg',
    dateOfBirth: new Date('1963-03-27'),
    birthPlace: 'Knoxville, Tennessee, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'James Cameron',
    designation: 'Director',
    image: 'https://image.tmdb.org/t/p/w500/9NAZnQZPeQELkKmL6yG5S6b3Gk4.jpg',
    dateOfBirth: new Date('1954-08-16'),
    birthPlace: 'Kapuskasing, Ontario, Canada',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'David Fincher',
    designation: 'Director',
    image: 'https://image.tmdb.org/t/p/w500/nKzomH1fD9mDkM6N6Gj58rYFp8F.jpg',
    dateOfBirth: new Date('1962-08-28'),
    birthPlace: 'Denver, Colorado, USA',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'S. S. Rajamouli',
    designation: 'Director',
    image: 'https://image.tmdb.org/t/p/w500/sYjF0Hw0T2Bq8Bf4FfX4Z0hY2cI.jpg',
    dateOfBirth: new Date('1973-10-10'),
    birthPlace: 'Amareshwara Camp, Raichur, Karnataka, India',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Peter Jackson',
    designation: 'Director',
    image: 'https://image.tmdb.org/t/p/w500/2L2HpxKxYg0wZJ6h2Bw9bT8hEwE.jpg',
    dateOfBirth: new Date('1961-10-31'),
    birthPlace: 'Pukerua Bay, New Zealand',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Ridley Scott',
    designation: 'Director',
    image: 'https://image.tmdb.org/t/p/w500/mXQy5P0T2L2b3YfWk1u9P9IeK8H.jpg',
    dateOfBirth: new Date('1937-11-30'),
    birthPlace: 'South Shields, Tyne and Wear, England, UK',
    approvalStatus: 'published',
    status: true
  },
  {
    name: 'Stanley Kubrick',
    designation: 'Director',
    image: 'https://image.tmdb.org/t/p/w500/k2A0A1Fm8z8K92X1l1l3Z3H9d9Q.jpg',
    dateOfBirth: new Date('1928-07-26'),
    birthPlace: 'Manhattan, New York City, New York, USA',
    approvalStatus: 'published',
    status: true
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Seed Countries
    let countryCount = 0;
    for (const country of COUNTRIES) {
      const existing = await CountryModel.findOne({ code: country.code });
      if (!existing) {
        await CountryModel.create(country);
        countryCount++;
      }
    }
    console.log(`Seeded ${countryCount} countries.`);

    // Seed Actors
    let actorCount = 0;
    for (const actor of ACTORS) {
      const existing = await ActorModel.findOne({ name: actor.name });
      if (!existing) {
        await ActorModel.create(actor);
        actorCount++;
      }
    }
    console.log(`Seeded ${actorCount} actors.`);

    // Seed Directors
    let directorCount = 0;
    for (const director of DIRECTORS) {
      const existing = await DirectorModel.findOne({ name: director.name });
      if (!existing) {
        await DirectorModel.create(director);
        directorCount++;
      }
    }
    console.log(`Seeded ${directorCount} directors.`);

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed();
