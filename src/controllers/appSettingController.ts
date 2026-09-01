import type { FastifyRequest, FastifyReply } from 'fastify';
import mongoose from 'mongoose';
import { AppSettingModel } from '../models/AppSetting';
import { CategoryModel } from '../models/Category';
import { ContentModel } from '../models/Content';
import { GenreModel } from '../models/Genre';
import { LanguageModel } from '../models/Language';
import { ActorModel } from '../models/Actor';
import { DirectorModel } from '../models/Director';
import { BannerModel } from '../models/Banner';
import { LiveChannelModel } from '../models/LiveChannel';

const DEFAULT_SETTINGS = [
  { id: 'banner', name: 'Banner', enabled: true, type: 'simple' as const, order: 0 },
  { id: 'continue-watching', name: 'Continue Watching', enabled: true, type: 'simple' as const, order: 1 },
  { id: 'top-10', name: 'Top 10', enabled: true, type: 'select' as const, selectedItems: [], availableItems: [], order: 2 },
  { id: 'advertisement', name: 'Advertisement', enabled: true, type: 'simple' as const, order: 3 },
  { id: 'new-released-movies', name: 'New Released Movies', enabled: true, type: 'select' as const, selectedItems: [], availableItems: [], order: 4 },
  { id: 'popular-language', name: 'Popular Language', enabled: true, type: 'select' as const, selectedItems: [], availableItems: [], order: 5 },
  { id: 'top-channels', name: 'Top Channels', enabled: true, type: 'select' as const, selectedItems: [], availableItems: [], order: 6 },
  { id: 'popular-personalities', name: 'Popular Personalities', enabled: true, type: 'select' as const, selectedItems: [], availableItems: [], order: 7 },
  { id: 'free-movies', name: 'Free Movies', enabled: true, type: 'select' as const, selectedItems: [], availableItems: [], order: 8 },
  { id: 'genres', name: 'Genres', enabled: true, type: 'select' as const, selectedItems: [], availableItems: [], order: 9 },
  { id: 'popular-categories', name: 'Popular Categories', enabled: true, type: 'select' as const, selectedItems: [], availableItems: [], order: 10 },
  { id: 'rate-our-app', name: 'Rate our app', enabled: true, type: 'simple' as const, order: 11 },
  { id: 'popular-tv-show', name: 'Popular TV Show', enabled: true, type: 'select' as const, selectedItems: [], availableItems: [], order: 12 },
  { id: 'most-watched-videos', name: 'Most Watched Videos', enabled: true, type: 'select' as const, selectedItems: [], availableItems: [], order: 13 },
];

export const getAppSettings = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    let appSetting = await AppSettingModel.findOne({ key: 'mobile-settings' });
    
    if (!appSetting) {
      appSetting = await AppSettingModel.create({
        key: 'mobile-settings',
        value: DEFAULT_SETTINGS,
      });
    }

    const settings = appSetting.value.map(async (item: any) => {
      const updatedItem = { ...(item.toObject ? item.toObject() : item) };
      
      if (updatedItem.type === 'select') {
        if (updatedItem.id === 'genres') {
          const genres = await GenreModel.find().lean();
          updatedItem.availableItems = genres.map((g: any) => g.name);
        } else if (updatedItem.id === 'popular-language') {
          const languages = await LanguageModel.find().lean();
          updatedItem.availableItems = languages.map((l: any) => l.name);
        } else if (['new-released-movies', 'free-movies', 'popular-tv-show', 'most-watched-videos'].includes(updatedItem.id)) {
          const contents = await ContentModel.find().lean();
          updatedItem.availableItems = contents.map((c: any) => c.title);
        } else if (updatedItem.id === 'popular-personalities') {
          const actors = await ActorModel.find().lean();
          const directors = await DirectorModel.find().lean();
          const personalities = [...actors.map(a => a.name), ...directors.map(d => d.name)];
          updatedItem.availableItems = personalities;
        } else if (updatedItem.id === 'top-channels') {
          const channels = await LiveChannelModel.find().lean();
          updatedItem.availableItems = channels.map((c: any) => c.name);
        } else if (updatedItem.id === 'popular-categories') {
          const categories = await CategoryModel.find().lean();
          updatedItem.availableItems = categories.map((c: any) => c.name);
        }
      }
      return updatedItem;
    });

    const resolvedSettings = await Promise.all(settings);
    resolvedSettings.sort((a, b) => (a.order || 0) - (b.order || 0));

    return reply.send({
      success: true,
      data: resolvedSettings,
    });
  } catch (error: any) {
    console.error('Error in getAppSettings:', error);
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateAppSettings = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { settings } = request.body as { settings: any[] };
    
    const appSetting = await AppSettingModel.findOneAndUpdate(
      { key: 'mobile-settings' },
      { value: settings },
      { returnDocument: 'after', upsert: true }
    );

    return reply.send({
      success: true,
      data: appSetting.value,
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const addAppSetting = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { name, type } = request.body as { name: string; type: 'simple' | 'select' };
    
    let appSetting = await AppSettingModel.findOne({ key: 'mobile-settings' });
    
    if (!appSetting) {
      appSetting = await AppSettingModel.create({
        key: 'mobile-settings',
        value: DEFAULT_SETTINGS,
      });
    }

    const newSetting = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      enabled: true,
      type,
      selectedItems: [],
      availableItems: [],
      order: appSetting.value.length,
    };

    appSetting.value.push(newSetting);
    await appSetting.save();

    return reply.status(201).send({
      success: true,
      data: newSetting,
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const deleteAppSetting = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    
    const appSetting = await AppSettingModel.findOne({ key: 'mobile-settings' });
    if (!appSetting) {
      return reply.status(404).send({ success: false, error: 'App settings not found' });
    }

    appSetting.value = appSetting.value.filter((item: any) => item.id !== id);
    await appSetting.save();

    return reply.send({ success: true, message: 'Setting deleted' });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const editAppSetting = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const { name, type } = request.body as { name?: string; type?: 'simple' | 'select' };
    
    const appSetting = await AppSettingModel.findOne({ key: 'mobile-settings' });
    if (!appSetting) {
      return reply.status(404).send({ success: false, error: 'App settings not found' });
    }

    const settingIndex = appSetting.value.findIndex((item: any) => item.id === id);
    if (settingIndex === -1) {
      return reply.status(404).send({ success: false, error: 'Setting not found' });
    }

    if (name) {
      appSetting.value[settingIndex].name = name;
    }
    if (type) {
      appSetting.value[settingIndex].type = type;
    }

    await appSetting.save();

    return reply.send({
      success: true,
      data: appSetting.value[settingIndex],
    });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const getHomeTabs = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const appSetting = await AppSettingModel.findOne({ key: 'home-tabs-config' });
    const tabs = appSetting?.value || [
      { id: 'drama', name: 'Short Dramas' },
      { id: 'movie', name: 'Movies & Series' },
    ];
    return reply.send({ success: true, data: tabs });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};

export const updateHomeTabs = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { tabs } = request.body as { tabs: { id: string; name: string }[] };
    const appSetting = await AppSettingModel.findOneAndUpdate(
      { key: 'home-tabs-config' },
      { value: tabs as any },
      { returnDocument: 'after', upsert: true }
    );
    return reply.send({ success: true, data: appSetting.value });
  } catch (error: any) {
    return reply.status(500).send({ success: false, error: error.message });
  }
};
