import type { Core } from '@strapi/strapi';
import path from 'path';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'markdown-import': {
    enabled: true,
    resolve: path.resolve(__dirname, '../src/plugins/markdown-import'),
  },
  upload: {
    config: {
      provider: env('UPLOAD_PROVIDER'), // 默认使用 local
      providerOptions: env('UPLOAD_PROVIDER') === 'aws-s3' ? {
        baseUrl: env('R2_CUSTOM_DOMAIN'),
        rootPath: env('CDN_ROOT_PATH'),
        s3Options: {
          credentials: {
            accessKeyId: env('R2_ACCESS_KEY_ID'),
            secretAccessKey: env('R2_ACCESS_SECRET'),
          },
          region: 'auto',
          endpoint: env('R2_ENDPOINT'), // 例如 "https://<account-id>.r2.cloudflarestorage.com"
          params: {
            Bucket: env('R2_BUCKET'),
            // 不要设置 ACL - R2 不支持 ACL
          },
        },
      } : {},
      security: {
        allowedTypes: ['image/*', 'video/*', 'application/*'],
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
});

export default config;
