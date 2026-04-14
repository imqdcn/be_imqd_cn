export default ({ strapi }: { strapi: any }) => ({
  async importMarkdown(ctx: any) {
    const items = Array.isArray(ctx.request.body?.items) ? ctx.request.body.items : [];

    if (items.length === 0) {
      return ctx.badRequest('Request body must include a non-empty items array');
    }

    const report = await strapi.plugin('markdown-import').service('markdownImport').importMarkdownItems(items);
    ctx.body = report;
  },
});
