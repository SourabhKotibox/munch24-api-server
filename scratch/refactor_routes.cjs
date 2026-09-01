const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'src', 'routes');

const map = {
  'episodes.ts': 'shows', // We'll map episodes to shows
  'genres.ts': 'genres',
  'actors.ts': 'actors',
  'directors.ts': 'directors',
  'languages.ts': 'languages',
  'categories.ts': 'categories',
  'media.ts': 'mediaLibrary',
  'banners.ts': 'banners',
  'promotions.ts': 'promotions',
  'adminUsers.ts': 'influencers',
  'ad.ts': 'ads',
  'pages.ts': 'pages',
  'faqs.ts': 'faqs',
  'subscriptions.ts': 'subscriptions',
  'subscriptionPlans.ts': 'subscriptionPlans',
  'planLimits.ts': 'planLimits',
  'notificationTemplates.ts': 'notificationTemplates',
  'settings.ts': 'superadmin',
  'countries.ts': 'categories', // Or we could use genres, maybe superadmin
  'crews.ts': 'directors',
  'notificationLogs.ts': 'notifications',
  'contents.ts': 'shows'
};

const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.ts'));

for (const file of routeFiles) {
  const moduleName = map[file];
  if (!moduleName) continue; // Skip files not in the map

  const filepath = path.join(ROUTES_DIR, file);
  let content = fs.readFileSync(filepath, 'utf8');

  // Replace import
  if (content.includes(`import { authenticate } from '../middlewares/auth';`)) {
    content = content.replace(
      `import { authenticate } from '../middlewares/auth';`,
      `import { requirePermission } from '../middlewares/rbac';`
    );
  } else if (!content.includes(`requirePermission`)) {
    // Inject import
    content = `import { requirePermission } from '../middlewares/rbac';\n` + content;
  }

  // Find all fastify.(get|post|put|patch|delete) and inject onRequest: [requirePermission(moduleName, action)]
  // fastify.get('/...', handler) -> fastify.get('/...', { onRequest: [requirePermission(moduleName, 'canView')] }, handler)
  // Need to be careful not to double inject or mess up existing options.

  // Regex to match `fastify.METHOD('PATH', HANDLER)`
  // Or `fastify.METHOD('PATH', { ...options }, HANDLER)`
  const regex = /fastify\.(get|post|put|patch|delete)\s*\(\s*('[^']+'|"[^"]+")\s*,\s*(?:\{\s*onRequest\s*:\s*\[authenticate\]\s*\}\s*,\s*)?([a-zA-Z0-9_]+)\s*\);/g;

  content = content.replace(regex, (match, method, routePath, handler) => {
    let action = '';
    if (method === 'get') action = 'canView';
    else if (method === 'post') action = 'canCreate';
    else if (method === 'put' || method === 'patch') action = 'canEdit';
    else if (method === 'delete') action = 'canDelete';

    if (moduleName === 'superadmin') action = '';

    const actionStr = action ? `, '${action}'` : '';
    return `fastify.${method}(${routePath}, { onRequest: [requirePermission('${moduleName}'${actionStr})] }, ${handler});`;
  });

  // What about `fastify.get('/', { onRequest: [authenticate] }, ...)`
  const regex2 = /fastify\.(get|post|put|patch|delete)\s*\(\s*('[^']+'|"[^"]+")\s*,\s*\{\s*(.*?)\s*\}\s*,\s*([a-zA-Z0-9_]+)\s*\);/gs;
  content = content.replace(regex2, (match, method, routePath, optionsObj, handler) => {
    if (optionsObj.includes('requirePermission')) return match; // Already processed
    let action = '';
    if (method === 'get') action = 'canView';
    else if (method === 'post') action = 'canCreate';
    else if (method === 'put' || method === 'patch') action = 'canEdit';
    else if (method === 'delete') action = 'canDelete';

    if (moduleName === 'superadmin') action = '';

    const actionStr = action ? `, '${action}'` : '';

    if (optionsObj.includes('authenticate')) {
      return `fastify.${method}(${routePath}, { onRequest: [requirePermission('${moduleName}'${actionStr})] }, ${handler});`;
    }
    return match;
  });

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Refactored ${file} with moduleName=${moduleName}`);
}
