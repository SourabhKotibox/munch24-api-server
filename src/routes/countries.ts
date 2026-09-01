import { requirePermission, authenticateAndAttach } from '../middlewares/rbac';
import type { FastifyPluginAsync } from 'fastify';
import {
  listCountries,
  getCountryById,
  createCountry,
  updateCountry,
  deleteCountry,
} from '../controllers/countryController';

const countriesRoutes: FastifyPluginAsync = async (fastify) => {
  // List all countries with pagination — allow any authenticated user so dropdowns work across forms
  fastify.get('/', { onRequest: [authenticateAndAttach] }, listCountries);

  // Get country by ID — allow any authenticated user
  fastify.get('/:id', { onRequest: [authenticateAndAttach] }, getCountryById);

  // Create new country — require settings permission
  fastify.post('/', { onRequest: [requirePermission('settings', 'canCreate')] }, createCountry);

  // Update country — require settings permission
  fastify.put('/:id', { onRequest: [requirePermission('settings', 'canEdit')] }, updateCountry);

  // Delete country — require settings permission
  fastify.delete('/:id', { onRequest: [requirePermission('settings', 'canDelete')] }, deleteCountry);
};

export default countriesRoutes;
