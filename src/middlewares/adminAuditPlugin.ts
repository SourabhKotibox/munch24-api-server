import { Schema } from 'mongoose';
import { AdminNotificationModel } from '../models/AdminNotification';
import { requestContext } from '../lib/context';

export const adminAuditPlugin = (schema: Schema) => {
  schema.pre('save', function (this: any) {
    this.$locals.wasNew = this.isNew;
  });

  schema.post('save', async function (doc: any) {
    try {
      const modelName = (doc.constructor as any).modelName || 'Document';
      const identifier = doc.title || doc.name || doc.email || doc.phone || doc._id?.toString();
      
      const isNew = doc.$locals?.wasNew !== false;

      let type: 'user_registered' | 'content_created' | 'content_updated' = 'content_created';
      let title = `New ${modelName} Created`;
      let action: 'created' | 'updated' = 'created';
      let messageDetails = '';

      if (!isNew) {
        type = 'content_updated';
        title = `${modelName} Updated`;
        action = 'updated';
        
        const modifiedPaths = doc.modifiedPaths ? doc.modifiedPaths().filter((p: string) => !['updatedAt', 'createdAt'].includes(p)) : [];
        if (modifiedPaths.length > 0) {
          messageDetails = ` (Modified: ${modifiedPaths.join(', ')})`;
          if (modifiedPaths.includes('status')) messageDetails = ` (Status changed to ${doc.status})`;
          else if (modifiedPaths.includes('subscriptionPlan')) messageDetails = ` (Plan changed to ${doc.subscriptionPlan})`;
          else if (modifiedPaths.includes('role')) messageDetails = ` (Role changed to ${doc.role})`;
        }
      } else {
        if (modelName === 'User' || modelName === 'AdminUser') {
          type = 'user_registered';
          title = `New ${modelName === 'User' ? 'App User' : 'Admin'} Registered`;
        }
      }

      const store = requestContext.getStore();
      const creatorName = store?.user?.name || store?.user?.email || 'System';
      const actionVerb = isNew ? 'created' : 'updated';

      await AdminNotificationModel.create({
        title,
        message: `${modelName} "${identifier}" was ${actionVerb} by ${creatorName}.${messageDetails}`,
        type,
        modelName,
        action,
      });
    } catch (err) {
      console.error('Audit plugin error on save:', err);
    }
  });

  schema.post('findOneAndUpdate', async function (this: any, doc: any) {
    if (!doc) return;
    try {
      const modelName = this.model?.modelName || (doc.constructor as any).modelName || 'Document';
      const identifier = doc.title || doc.name || doc.email || doc.phone || doc._id?.toString();
      
      const store = requestContext.getStore();
      const updaterName = store?.user?.name || store?.user?.email || 'System';

      const updateObj: any = this.getUpdate();
      let updateDetails = '';
      
      if (updateObj) {
        const modifiedKeys = new Set<string>();
        for (const [key, value] of Object.entries(updateObj)) {
          if (key === '$set' || key === '$unset') {
            Object.keys(value as any).forEach(k => modifiedKeys.add(k));
          } else if (!key.startsWith('$')) {
            modifiedKeys.add(key);
          }
        }
        modifiedKeys.delete('updatedAt');
        modifiedKeys.delete('createdAt');
        const keys = Array.from(modifiedKeys);
        
        if (keys.length > 0) {
          updateDetails = ` (Modified: ${keys.join(', ')})`;
          const setSource = updateObj.$set || updateObj;
          if (keys.includes('status') && setSource.status) updateDetails = ` (Status changed to ${setSource.status})`;
          else if (keys.includes('subscriptionPlan') && setSource.subscriptionPlan) updateDetails = ` (Plan changed to ${setSource.subscriptionPlan})`;
          else if (keys.includes('role') && setSource.role) updateDetails = ` (Role changed to ${setSource.role})`;
          else if (keys.includes('password')) updateDetails = ` (Password was reset)`;
        }
      }

      await AdminNotificationModel.create({
        title: `${modelName} Updated`,
        message: `${modelName} "${identifier}" was updated by ${updaterName}.${updateDetails}`,
        type: 'content_updated',
        modelName,
        action: 'updated',
      });
    } catch (err) {
      console.error('Audit plugin error on findOneAndUpdate:', err);
    }
  });

  schema.post('findOneAndDelete', async function (this: any, doc: any) {
    if (!doc) return;
    try {
      const modelName = this.model?.modelName || (doc.constructor as any).modelName || 'Document';
      const identifier = doc.title || doc.name || doc.email || doc.phone || doc._id?.toString();
      
      const store = requestContext.getStore();
      const deleterName = store?.user?.name || store?.user?.email || 'System';

      await AdminNotificationModel.create({
        title: `${modelName} Deleted`,
        message: `${modelName} "${identifier}" was deleted by ${deleterName}.`,
        type: 'content_deleted',
        modelName,
        action: 'deleted',
      });
    } catch (err) {
      console.error('Audit plugin error on findOneAndDelete:', err);
    }
  });
};
