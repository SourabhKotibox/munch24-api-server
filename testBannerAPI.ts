import mongoose from 'mongoose';
import { BannerModel } from './src/models/Banner';
import { MovieModel } from './src/models/Movie';
import { ContentModel } from './src/models/Content';

const populateBannersContent = async (banners: any[]) => {
  const contentIds = banners.map((b) => b.contentId).filter(Boolean);
  if (contentIds.length === 0) return banners;

  const [movies, contents] = await Promise.all([
    MovieModel.find({ _id: { $in: contentIds } }).lean(),
    ContentModel.find({ _id: { $in: contentIds } }).lean(),
  ]);

  const contentMap = new Map();
  for (const movie of movies) {
    contentMap.set(movie._id.toString(), { ...movie, type: 'movie' });
  }
  for (const content of contents) {
    contentMap.set(content._id.toString(), { ...content, type: content.type || 'series' });
  }

  for (const banner of banners) {
    if (banner.contentId) {
      banner.contentId = contentMap.get(banner.contentId.toString()) || null;
    }
  }

  return banners;
};

async function main() {
  await mongoose.connect('mongodb://localhost:27017/triple-mindes');
  
  const tab = 'drama';
  const contentTypeFilter = tab === 'both'
    ? { contentType: { $in: ['drama', 'movie', 'both'] as const } }
    : { contentType: { $in: [tab, 'both'] as const } };

  const bannersRaw = await BannerModel.find({
    isActive: true,
    ...contentTypeFilter
  }).lean();

  let banners = await populateBannersContent(bannersRaw);

  if (tab === 'drama') {
    banners = banners.filter(b => {
      if (!b.contentId) return true;
      return (b.contentId as any).contentType === 'drama';
    });
  }

  console.log(JSON.stringify(banners.map(b => ({
    id: b._id,
    title: b.title,
    contentId: b.contentId ? { id: b.contentId._id, contentType: b.contentId.contentType, type: b.contentId.type } : null
  })), null, 2));
  
  process.exit(0);
}

main().catch(console.error);
