import { ListObjectsV2Command, PutObjectAclCommand } from '@aws-sdk/client-s3';
import { getDOSettings, getDOClient } from '../lib/s3';

export async function makeAllSpacesFilesPublic() {
  try {
    const settings = await getDOSettings();
    if (!settings.bucket || !settings.accessKeyId) {
      console.log('DigitalOcean Spaces credentials not configured.');
      return;
    }

    const client = await getDOClient();
    let continuationToken: string | undefined;
    let totalUpdated = 0;

    console.log(`Setting public-read ACL on all files in bucket: ${settings.bucket} (${settings.region})...`);

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: settings.bucket,
        ContinuationToken: continuationToken,
      });

      const response = await client.send(listCommand);
      for (const item of response.Contents || []) {
        if (!item.Key) continue;
        try {
          await client.send(new PutObjectAclCommand({
            Bucket: settings.bucket,
            Key: item.Key,
            ACL: 'public-read',
          }));
          totalUpdated += 1;
          console.log(`✓ Made public: ${item.Key}`);
        } catch (err: any) {
          console.warn(`✗ Failed to set ACL on ${item.Key}:`, err.message);
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`Finished! Total files updated to public-read: ${totalUpdated}`);
  } catch (error: any) {
    console.error('Error updating Spaces file permissions:', error);
  }
}
