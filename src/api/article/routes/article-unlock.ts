export default {
  routes: [
    {
      method: 'POST',
      path: '/articles/:id/unlock',
      handler: 'article.unlock',
      config: {
        auth: false,
      },
    },
  ],
};