import type { FastifyReply, FastifyRequest } from 'fastify';
import { UserModel } from '../models/User';
import { SubscriptionModel } from '../models/Subscription';
import { TransactionModel } from '../models/Transaction';
import { ContentModel } from '../models/Content';
import { MovieModel } from '../models/Movie';
import { GenreModel } from '../models/Genre';
import { UserWatchProgressModel } from '../models/UserWatchProgress';
import { ReviewModel } from '../models/Review';
import { SettingsModel } from '../models/Settings';
import mongoose from 'mongoose';

// Helper to determine date range
const getDateFilter = (query: any) => {
  const { period, startDate, endDate } = query;
  
  if (startDate && endDate) {
    return {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const now = new Date();
  const start = new Date();
  
  if (period === 'week') {
    start.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    start.setMonth(now.getMonth() - 1);
  } else {
    // Default to year
    start.setFullYear(now.getFullYear() - 1);
  }

  return {
    $gte: start,
    $lte: now,
  };
};

const getGroupingFormat = (dateFilter: any) => {
  const start = dateFilter.$gte.getTime();
  const end = dateFilter.$lte.getTime();
  const days = (end - start) / (1000 * 60 * 60 * 24);
  
  if (days <= 31) {
    return { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  } else {
    return { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
  }
};

export const getDashboardStats = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as any;
    const dateFilter = getDateFilter(query);

    const [
      totalUsers,
      activeSubscriptions,
      totalContent,
      totalMovies,
      totalWalletTransactions,
    ] = await Promise.all([
      UserModel.countDocuments(),
      SubscriptionModel.countDocuments({ status: 'active' }),
      ContentModel.countDocuments(),
      MovieModel.countDocuments(),
      TransactionModel.countDocuments(),
    ]);

    const soonToExpire = await SubscriptionModel.countDocuments({
      endDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const [totalSubscriptionRevenue, coinRevenueResult] = await Promise.all([
      SubscriptionModel.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      TransactionModel.aggregate([
        { $match: { type: 'coin_topup', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const subscriptionRevenue = totalSubscriptionRevenue[0]?.total || 0;
    const totalCoinRevenue = coinRevenueResult[0]?.total || 0;
    const totalCoinTransactions = coinRevenueResult[0]?.count || 0;
    const totalRevenue = subscriptionRevenue + totalCoinRevenue;
    const totalReviews = await ReviewModel.countDocuments();

    // Fetch dynamic currency settings
    const settings = await SettingsModel.findOne().lean();
    const symbol = settings?.currencySymbol || '₹';
    const position = settings?.currencyPosition || 'before';
    const decimals = settings?.decimalPlaces ?? 2;
    const formatValue = (val: number) => position === 'before' ? `${symbol}${val.toFixed(decimals)}` : `${val.toFixed(decimals)} ${symbol}`;

    return reply.send({
      success: true,
      data: {
        totalUsers,
        totalSubscribers: activeSubscriptions,
        soonToExpire,
        totalReviews,
        totalStorageUsage: 'Dynamic MB', // Placeholder for actual S3 calculation if needed
        restContent: totalContent + totalMovies,
        subscriptionRevenue: formatValue(subscriptionRevenue),
        coinRevenue: formatValue(totalCoinRevenue),
        rentRevenue: formatValue(0), // Update if implementing rentals
        totalRevenue: formatValue(totalRevenue),
        totalCoinTransactions,
        totalWalletTransactions,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getRevenueData = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as any;
    const dateFilter = getDateFilter(query);
    const groupFormat = getGroupingFormat(dateFilter);

    const revenueByPeriod = await SubscriptionModel.aggregate([
      { $match: { createdAt: dateFilter, status: 'active' } },
      { $group: { _id: groupFormat, total: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } }
    ]);

    const revenueData = revenueByPeriod.map(r => ({
      name: r._id,
      value: r.total,
    }));

    return reply.send({ success: true, data: revenueData });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getNewSubscribersData = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as any;
    const dateFilter = getDateFilter(query);
    const groupFormat = getGroupingFormat(dateFilter);

    const subscribersByPeriod = await SubscriptionModel.aggregate([
      { $match: { createdAt: dateFilter } },
      { 
        $group: { 
          _id: { date: groupFormat, plan: '$plan' }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Format the grouped data into the expected format
    const formattedData: Record<string, any> = {};
    for (const sub of subscribersByPeriod) {
      const date = sub._id.date;
      const plan = String(sub._id.plan).toLowerCase().includes('premium') ? 'premium' : 'basic';
      
      if (!formattedData[date]) formattedData[date] = { name: date, basic: 0, premium: 0 };
      formattedData[date][plan] += sub.count;
    }

    return reply.send({
      success: true,
      data: Object.values(formattedData),
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getMostWatchedData = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const query = request.query as any;
    const dateFilter = getDateFilter(query);
    // UserWatchProgress uses updated at to track recent views
    const dateFilterForWatch = {
      $gte: dateFilter.$gte,
      $lte: dateFilter.$lte
    };

    // Calculate dynamic format based on updatedAt
    const start = dateFilter.$gte.getTime();
    const end = dateFilter.$lte.getTime();
    const days = (end - start) / (1000 * 60 * 60 * 24);
    const groupFormat = days <= 31 
      ? { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } } 
      : { $dateToString: { format: '%Y-%m', date: '$updatedAt' } };

    const watchData = await UserWatchProgressModel.aggregate([
      { $match: { updatedAt: dateFilterForWatch } },
      { 
        $group: { 
          _id: { date: groupFormat, type: '$contentModelType' }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { '_id.date': 1 } }
    ]);

    const formattedData: Record<string, any> = {};
    for (const wd of watchData) {
      const date = wd._id.date;
      const type = wd._id.type === 'Movie' ? 'movies' : 'tvShows';
      
      if (!formattedData[date]) formattedData[date] = { name: date, movies: 0, tvShows: 0 };
      formattedData[date][type] += wd.count;
    }

    return reply.send({
      success: true,
      data: Object.values(formattedData),
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getTopGenresData = async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    const genres = await GenreModel.find().lean();
    
    // In a perfectly optimized DB, we would aggregate MovieModel views by genre array.
    // For simplicity, we'll aggregate Movies and sum their views by genre.
    const movies = await MovieModel.find({ status: 'published' }).select('genres views').lean();
    const contents = await ContentModel.find({ status: 'published' }).select('genres views').lean();
    
    const genreViews: Record<string, number> = {};
    
    for (const m of [...movies, ...contents]) {
      for (const gId of m.genres || []) {
        const idStr = gId.toString();
        genreViews[idStr] = (genreViews[idStr] || 0) + (m.views || 0);
      }
    }

    const topGenresData = genres.map(g => ({
      name: g.name,
      value: genreViews[g._id.toString()] || 0
    })).sort((a, b) => b.value - a.value).slice(0, 5);

    // If all views are zero, return empty array so chart shows empty state
    if (topGenresData.every(g => g.value === 0)) {
       return reply.send({
         success: true,
         data: []
       });
    }

    return reply.send({
      success: true,
      data: topGenresData,
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getReviews = async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    const reviews = await ReviewModel.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('userId', 'name avatar')
      .lean();

    const reviewsData = reviews.map((r: any) => ({
      name: r.userId?.name || 'Anonymous User',
      date: new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      category: r.contentModelType === 'Movie' ? 'Movies' : 'TV Shows',
      rating: r.rating,
      avatar: r.userId?.name ? r.userId.name.charAt(0).toUpperCase() : 'U',
      comment: r.comment
    }));

    return reply.send({
      success: true,
      data: reviewsData,
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getTransactions = async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Fetch dynamic currency settings
    const settings = await SettingsModel.findOne().lean();
    const symbol = settings?.currencySymbol || '₹';
    const position = settings?.currencyPosition || 'before';
    const decimals = settings?.decimalPlaces ?? 2;
    const formatValue = (val: number) => position === 'before' ? `${symbol}${val.toFixed(decimals)}` : `${val.toFixed(decimals)} ${symbol}`;

    const [subscriptions, coinTransactions] = await Promise.all([
      SubscriptionModel.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'name')
        .lean(),
      TransactionModel.find({ type: { $in: ['coin_topup'] } })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'name')
        .lean(),
    ]);

    const subscriptionRows = subscriptions.map((t: any) => ({
      name: t.userId?.name || 'Deleted User',
      date: new Date(t.createdAt).toISOString().split('T')[0],
      type: 'subscription' as const,
      plan: t.plan,
      amount: formatValue(t.totalAmount || 0),
      method: t.paymentMethod || '-',
      avatar: t.userId?.name ? t.userId.name.charAt(0).toUpperCase() : 'D',
      _createdAt: new Date(t.createdAt).getTime(),
    }));

    const coinRows = coinTransactions.map((t: any) => ({
      name: t.userId?.name || 'Deleted User',
      date: new Date(t.createdAt).toISOString().split('T')[0],
      type: 'coin_purchase' as const,
      plan: `${t.coins} Coins`,
      amount: formatValue(t.amount || 0),
      method: 'Razorpay',
      avatar: t.userId?.name ? t.userId.name.charAt(0).toUpperCase() : 'D',
      _createdAt: new Date(t.createdAt).getTime(),
    }));

    const merged = [...subscriptionRows, ...coinRows]
      .sort((a, b) => b._createdAt - a._createdAt)
      .slice(0, 15)
      .map(({ _createdAt, ...rest }) => rest);

    return reply.send({
      success: true,
      data: merged,
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};
