const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'src', 'models', 'AdminUser.ts');
let content = fs.readFileSync(filepath, 'utf8');

// 1. Add settings to IModulePermissions
if (!content.includes('settings: { canView: boolean;')) {
  content = content.replace(
    /notificationTemplates: \{ canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean \};/,
    'notificationTemplates: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };\n  settings: { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };'
  );
}

// 2. Add settings to defaultModulePermissions
if (!content.includes('settings: { canView: true, canCreate: false, canEdit: false, canDelete: false },')) {
  content = content.replace(
    /notificationTemplates: \{ canView: true, canCreate: false, canEdit: false, canDelete: false \},/,
    'notificationTemplates: { canView: true, canCreate: false, canEdit: false, canDelete: false },\n  settings: { canView: true, canCreate: false, canEdit: false, canDelete: false },'
  );
}

// 3. Add settings to AdminUserSchema
if (!content.includes('settings: { canView: Boolean,')) {
  content = content.replace(
    /notificationTemplates: \{ canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean \},/,
    'notificationTemplates: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },\n        settings: { canView: Boolean, canCreate: Boolean, canEdit: Boolean, canDelete: Boolean },'
  );
}

fs.writeFileSync(filepath, content, 'utf8');
console.log('Successfully updated AdminUser.ts for settings RBAC.');
