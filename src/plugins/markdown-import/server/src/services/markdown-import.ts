import matter from 'gray-matter';
import path from 'node:path';
import crypto from 'node:crypto';

type ImportInputItem = {
  fileName?: string;
  content?: string;
};

type ImportResultItem = {
  fileName: string;
  slug: string;
  inputDocumentId: string | null;
  action: 'create' | 'update' | 'skip';
  status: 'success' | 'failed';
  id?: number;
  documentId?: string;
  message?: string;
  errors: string[];
};

type ImportReport = {
  generatedAt: string;
  summary: {
    total: number;
    created: number;
    updated: number;
    failed: number;
    skipped: number;
  };
  items: ImportResultItem[];
};

const ARTICLE_UID = 'api::article.article';
const allowedContentTypes = new Set(['long', 'short', 'gallery', 'video', 'quiz', 'topic', 'wiki']);
const allowedAccessLevels = new Set(['public', 'password']);

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function normalizeManyRelation(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as number[];
  }

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function toPayload(fileName: string, frontmatter: Record<string, unknown>, markdownBody: string, errors: string[]) {
  const baseName = path.basename(fileName).replace(/\.(md|markdown)$/i, '');
  const slug = String(frontmatter.slug || baseName).trim();
  const title = String(frontmatter.title || '').trim();

  if (!title) {
    errors.push('Missing required field: title');
  }

  if (!slug) {
    errors.push('Missing required field: slug');
  }

  if (!markdownBody) {
    errors.push('Markdown body is empty');
  }

  if (frontmatter.contentType && !allowedContentTypes.has(String(frontmatter.contentType))) {
    errors.push(`Invalid contentType: ${String(frontmatter.contentType)}`);
  }

  if (frontmatter.accessLevel && !allowedAccessLevels.has(String(frontmatter.accessLevel))) {
    errors.push(`Invalid accessLevel: ${String(frontmatter.accessLevel)}`);
  }

  const payload: Record<string, unknown> = {
    title,
    slug,
    description: frontmatter.description ? String(frontmatter.description) : undefined,
    excerpt: frontmatter.excerpt ? String(frontmatter.excerpt) : undefined,
    contentType: String(frontmatter.contentType || 'long'),
    featured: Boolean(frontmatter.featured),
    pinned: Boolean(frontmatter.pinned),
    readingTime: frontmatter.readingTime ? Number(frontmatter.readingTime) : undefined,
    viewCount: frontmatter.viewCount ? Number(frontmatter.viewCount) : 0,
    likeCount: frontmatter.likeCount ? Number(frontmatter.likeCount) : 0,
    isProtected: Boolean(frontmatter.isProtected),
    accessLevel: String(frontmatter.accessLevel || 'public'),
    passwordHint: frontmatter.passwordHint ? String(frontmatter.passwordHint) : undefined,
    unlockTtlSeconds: frontmatter.unlockTtlSeconds ? Number(frontmatter.unlockTtlSeconds) : 1800,
    seo: frontmatter.seo || undefined,
    blocks: [
      {
        __component: 'shared.rich-text',
        body: markdownBody,
      },
    ],
  };

  const authorId = Number(frontmatter.author);
  if (Number.isInteger(authorId) && authorId > 0) {
    payload.author = authorId;
  }

  const categoryId = Number(frontmatter.category);
  if (Number.isInteger(categoryId) && categoryId > 0) {
    payload.category = categoryId;
  }

  const coverId = Number(frontmatter.cover);
  if (Number.isInteger(coverId) && coverId > 0) {
    payload.cover = coverId;
  }

  const quizSetId = Number(frontmatter.quizSet);
  if (Number.isInteger(quizSetId) && quizSetId > 0) {
    payload.quizSet = quizSetId;
  }

  const tags = normalizeManyRelation(frontmatter.tags);
  if (tags.length > 0) {
    payload.tags = tags;
  }

  const topicCollections = normalizeManyRelation(frontmatter.topicCollections);
  if (topicCollections.length > 0) {
    payload.topicCollections = topicCollections;
  }

  const wikiNodes = normalizeManyRelation(frontmatter.wikiNodes);
  if (wikiNodes.length > 0) {
    payload.wikiNodes = wikiNodes;
  }

  if (frontmatter.password) {
    payload.isProtected = true;
    payload.accessLevel = 'password';
    payload.passwordHash = hashPassword(String(frontmatter.password));
  } else if (frontmatter.passwordHash) {
    payload.passwordHash = String(frontmatter.passwordHash);
  }

  if (frontmatter.publish === true) {
    payload.publishedAt = new Date().toISOString();
  }

  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if (value === undefined || Number.isNaN(value)) {
      delete payload[key];
    }
  });

  const inputDocumentId = String(frontmatter.documentId || frontmatter.documentID || '').trim() || null;

  return {
    slug,
    payload,
    inputDocumentId,
  };
}

export default ({ strapi }: { strapi: any }) => ({
  async importMarkdownItems(items: ImportInputItem[]) {
    const report: ImportReport = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: items.length,
        created: 0,
        updated: 0,
        failed: 0,
        skipped: 0,
      },
      items: [],
    };

    for (let index = 0; index < items.length; index += 1) {
      const input = items[index] || {};
      const fileName = String(input.fileName || `item-${index + 1}.md`);
      const content = String(input.content || '');
      const errors: string[] = [];

      if (!content.trim()) {
        errors.push('Content is empty');
        report.summary.failed += 1;
        report.items.push({
          fileName,
          slug: '',
          inputDocumentId: null,
          action: 'skip',
          status: 'failed',
          errors,
        });
        continue;
      }

      let parsed;
      try {
        parsed = matter(content);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Invalid markdown/frontmatter');
        report.summary.failed += 1;
        report.items.push({
          fileName,
          slug: '',
          inputDocumentId: null,
          action: 'skip',
          status: 'failed',
          errors,
        });
        continue;
      }

      const { slug, payload, inputDocumentId } = toPayload(fileName, parsed.data || {}, parsed.content.trim(), errors);
      if (errors.length > 0) {
        report.summary.failed += 1;
        report.items.push({
          fileName,
          slug,
          inputDocumentId,
          action: 'skip',
          status: 'failed',
          errors,
        });
        continue;
      }

      try {
        const byDocumentId = inputDocumentId
          ? await strapi.db.query(ARTICLE_UID).findOne({ where: { documentId: inputDocumentId }, select: ['id', 'slug', 'documentId'] })
          : null;

        const bySlug = await strapi.db.query(ARTICLE_UID).findOne({ where: { slug }, select: ['id', 'slug', 'documentId'] });

        if (byDocumentId && bySlug && byDocumentId.id !== bySlug.id) {
          throw new Error(`Conflict: documentId=${inputDocumentId} and slug=${slug} match different articles`);
        }

        const target = byDocumentId || bySlug;

        if (target) {
          const updated = await strapi.entityService.update(ARTICLE_UID, target.id, { data: payload });
          report.summary.updated += 1;
          report.items.push({
            fileName,
            slug,
            inputDocumentId,
            action: 'update',
            status: 'success',
            id: updated.id,
            documentId: updated.documentId,
            message: target === byDocumentId ? 'Updated by documentId' : 'Updated by slug',
            errors: [],
          });
        } else {
          const created = await strapi.entityService.create(ARTICLE_UID, { data: payload });
          report.summary.created += 1;
          report.items.push({
            fileName,
            slug,
            inputDocumentId,
            action: 'create',
            status: 'success',
            id: created.id,
            documentId: created.documentId,
            message: 'Created new article',
            errors: [],
          });
        }
      } catch (error) {
        report.summary.failed += 1;
        report.items.push({
          fileName,
          slug,
          inputDocumentId,
          action: 'skip',
          status: 'failed',
          errors: [error instanceof Error ? error.message : 'Import failed'],
        });
      }
    }

    return report;
  },
});
