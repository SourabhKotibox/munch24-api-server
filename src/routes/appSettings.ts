import type { FastifyPluginAsync } from 'fastify';
import { getAppSettings, updateAppSettings, addAppSetting, deleteAppSetting, editAppSetting, getHomeTabs, updateHomeTabs } from '../controllers/appSettingController';

const appSettingsRoutes: FastifyPluginAsync = async (fastify, opts) => {
  fastify.get('/home-tabs', getHomeTabs);
  fastify.put('/home-tabs', updateHomeTabs);
  fastify.get('/', getAppSettings);
  fastify.put('/', updateAppSettings);
  fastify.post('/', addAppSetting);
  fastify.delete('/:id', deleteAppSetting);
  fastify.patch('/:id', editAppSetting);
};

export default appSettingsRoutes;
