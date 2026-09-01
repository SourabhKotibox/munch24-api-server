import { FastifyInstance } from 'fastify';
import {
  getSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from '../controllers/sectionController';

export default async function sectionsRoutes(fastify: FastifyInstance) {
  fastify.get('/', getSections);
  fastify.get('/:id', getSectionById);
  fastify.post('/', createSection);
  fastify.put('/reorder', reorderSections);
  fastify.put('/:id', updateSection);
  fastify.delete('/:id', deleteSection);
}
