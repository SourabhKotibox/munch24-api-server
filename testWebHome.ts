import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MovieModel } from './src/models/Movie';
import { ContentModel } from './src/models/Content';
import { GenreModel } from './src/models/Genre';
import { EpisodeModel } from './src/models/Episode';
import { getWebHome } from './src/controllers/webHomeController';

dotenv.config();

const check = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to DB');

    // Create a mock request/reply object
    const mockRequest = {} as any;
    const mockReply = {
      send: (data: any) => {
        console.log('API RESPONSE SUCCESS');
        console.log('Keys:', Object.keys(data.data));
        console.log('Hero items:', data.data.heroContent.length);
        console.log('Trending items:', data.data.trendingNow.length);
        console.log('New Releases items:', data.data.newReleases.length);
        console.log('Short Dramas:', data.data.featuredDramas.length);
        console.log('First Hero Item Example:', data.data.heroContent[0]);
        console.log('First Drama Item Example:', data.data.featuredDramas[0]);
      },
      status: (code: number) => {
        console.log('Status set to:', code);
        return mockReply;
      }
    } as any;

    await getWebHome(mockRequest, mockReply);
  } catch (err) {
    console.error('Error during check:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB');
  }
};

check();
