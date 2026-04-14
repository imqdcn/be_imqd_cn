export default {
  admin: {
    type: 'admin',
    routes: [
      {
        method: 'POST',
        path: '/import',
        handler: 'import.importMarkdown',
        config: {
          policies: ['admin::isAuthenticatedAdmin'],
        },
      },
    ],
  },
};
