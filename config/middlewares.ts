import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  // 自定义安全中间件配置，添加 R2 域名到 CSP
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            env('R2_CUSTOM_DOMAIN'), // 替换为你的 R2 公开域名
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            env('R2_CUSTOM_DOMAIN'), // 替换为你的 R2 公开域名
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
];

export default config;
function env(key: string): string {
  return process.env[key] || '';
}

