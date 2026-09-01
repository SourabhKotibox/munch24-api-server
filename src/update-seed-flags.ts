import { connectMongoDB } from './lib/mongodb';
import { ContentModel } from './models/Content';
import { MovieModel } from './models/Movie';
import { BannerModel } from './models/Banner';
import 'dotenv/config';

async function update() {
  await connectMongoDB();

  console.log('Updating movies flags...');
  const movies = await MovieModel.find().limit(10);
  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    if (i < 3) {
      movie.featured = true;
      movie.trending = true;
    } else if (i < 6) {
      movie.isNewContent = true;
    } else {
      movie.trending = true;
    }
    await movie.save();
  }

  console.log('Updating TV series flags...');
  const seriesList = await ContentModel.find({ contentType: 'series' }).limit(10);
  for (let i = 0; i < seriesList.length; i++) {
    const series = seriesList[i];
    if (i < 3) {
      series.featured = true;
      series.trending = true;
    } else if (i < 6) {
      series.isNewContent = true;
    } else {
      series.trending = true;
    }
    await series.save();
  }

  console.log('Updating short dramas flags...');
  const dramas = await ContentModel.find({ contentType: 'drama' }).limit(10);
  for (let i = 0; i < dramas.length; i++) {
    const drama = dramas[i];
    if (i < 4) {
      drama.featured = true;
      drama.trending = true;
    } else if (i < 8) {
      drama.isNewContent = true;
    } else {
      drama.featured = true;
    }
    await drama.save();
  }

  console.log('Adding short drama banners to BannerModel...');
  // Let's create some banners for the seeded short dramas to showcase them in the Hero slider!
  // First, clean up old hero banners that are duplicate or mock
  // Let's find some dramas we just flagged as featured
  const featuredDramas = await ContentModel.find({ contentType: 'drama', featured: true }).limit(3);
  for (let i = 0; i < featuredDramas.length; i++) {
    const drama = featuredDramas[i];
    
    // Check if banner already exists for this contentId
    const existing = await BannerModel.findOne({ contentId: drama._id });
    if (!existing) {
      await BannerModel.create({
        title: drama.title,
        subtitle: 'Watch the popular short drama',
        description: drama.description || drama.shortDescription,
        imageUrl: drama.bannerImage || drama.thumbnail,
        mobileImageUrl: drama.thumbnail,
        ctaText: 'Watch Episode 1',
        ctaLink: `/drama/${drama._id}/episode/1`,
        contentId: drama._id,
        type: 'hero',
        contentType: 'drama',
        position: i + 1,
        isActive: true,
        targetPlatforms: ['web', 'mobile']
      });
      console.log(`Created banner for Short Drama: ${drama.title}`);
    }
  }

  console.log('All flags and short drama banners updated successfully!');
  process.exit(0);
}

update();
