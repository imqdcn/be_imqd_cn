import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  upload: {
    config: {
      provider: 'aws-s3',
      rootPath: env('CDN_ROOT_PATH'),
      providerOptions: {
        baseUrl: env('R2_CUSTOM_DOMAIN'),
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
      },
      security: {
        allowedTypes: ['image/*', 'video/*', 'application/*'],
      },
    },
  },
});

export default config;
