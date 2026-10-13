import type { FastifyPluginAsync } from 'fastify';
import {
  getUpcomingContent,
  toggleUpcomingReminder,
  getUserUpcomingReminders,
  getAdminUpcomingList,
  getAdminUpcomingCandidates,
  setAdminUpcoming,
} from '../controllers/upcomingController';

const upcomingRoutes: FastifyPluginAsync = async (fastify) => {
  // Mobile App / Public Upcoming feed
  fastify.get('/upcoming', getUpcomingContent);
  fastify.get('/app/upcoming', getUpcomingContent);

  // Remind Me toggle (supports :id param or JSON body)
  fastify.post('/app/upcoming/:id/remind', toggleUpcomingReminder);
  fastify.post('/upcoming/:id/remind', toggleUpcomingReminder);
  fastify.post('/app/upcoming/remind', toggleUpcomingReminder);
  fastify.post('/upcoming/remind', toggleUpcomingReminder);

  // User's reminded upcoming items
  fastify.get('/app/upcoming/reminders', getUserUpcomingReminders);
  fastify.get('/upcoming/reminders', getUserUpcomingReminders);

  // Admin management routes
  fastify.get('/admin/upcoming', getAdminUpcomingList);
  fastify.get('/admin/upcoming/candidates', getAdminUpcomingCandidates);
  fastify.post('/admin/upcoming/toggle', setAdminUpcoming);
};

export default upcomingRoutes;
