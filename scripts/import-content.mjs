import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const dryRun = argSet.has('--dry-run');
const noStrict = argSet.has('--no-strict');

function getArgValue(name) {
  const key = `--${name}`;
  const withEquals = argv.find((item) => item.startsWith(`${key}=`));
  if (withEquals) {
    return withEquals.slice(key.length + 1);
  }

  const index = argv.findIndex((item) => item === key);
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1];
  }

  return undefined;
}

const strictMode = !noStrict;

const baseUrl = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
const token = process.env.STRAPI_CONTENT_TOKEN;
const contentDir = process.env.CONTENT_DIR || 'content/articles';
const singleFileArg = getArgValue('file');
const onlySlugArg = getArgValue('slug');
const reportFileArg = getArgValue('report');
const reportFile = reportFileArg || process.env.CONTENT_IMPORT_REPORT || 'reports/content-import-report.json';
const failFast = process.env.CONTENT_IMPORT_FAIL_FAST !== 'false';
const allowPlaintextPassword = process.env.ALLOW_PLAINTEXT_PASSWORD === 'true';
const isProduction = process.env.NODE_ENV === 'production';

const onlySlugs = new Set(
  String(onlySlugArg || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

if (!token && !dryRun) {
  console.error('[import-content] Missing STRAPI_CONTENT_TOKEN in environment.');
  process.exit(1);
}

const allowedContentTypes = new Set(['long', 'short', 'gallery', 'video', 'quiz', 'topic', 'wiki']);
const allowedAccessLevels = new Set(['public', 'password']);

const relationEndpointMap = {
  author: '/api/authors',
  category: '/api/categories',
  quizSet: '/api/quiz-sets',
  tags: '/api/tags',
  topicCollections: '/api/topic-collections',
  wikiNodes: '/api/knowledge-nodes',
};

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function walkMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
      files.push(fullPath);
    }
  }

  return files;
}

async function requestJson(url, options = {}) {
  if (!token) {
    throw new Error('STRAPI_CONTENT_TOKEN is required for API requests.');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const message = json?.error?.message || json?.message || text || response.statusText;
    throw new Error(`[${response.status}] ${message}`);
  }

  return json;
}

function normalizeManyRelation(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function createFileContext(filePath) {
  return {
    filePath,
    slug: '',
    action: 'UNKNOWN',
    valid: false,
    errors: [],
    warnings: [],
    payload: null,
    existingId: null,
    writtenId: null,
    diffSummary: null,
  };
}

function stableJson(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => JSON.parse(stableJson(item) || 'null')));
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const normalized = {};
    for (const key of keys) {
      normalized[key] = JSON.parse(stableJson(value[key]) || 'null');
    }
    return JSON.stringify(normalized);
  }

  return JSON.stringify(value);
}

function shorten(value, max = 180) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function extractId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'object') {
    if (typeof value.id === 'number') {
      return value.id;
    }

    if (value.data && typeof value.data.id === 'number') {
      return value.data.id;
    }
  }

  return null;
}

function extractManyIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => extractId(item))
    .filter((item) => Number.isInteger(item) && item > 0)
    .sort((a, b) => a - b);
}

function summarizeValueByField(field, value) {
  if (field === 'passwordHash') {
    return value ? '[REDACTED]' : null;
  }

  if (field === 'blocks') {
    const raw = stableJson(value);
    return {
      count: Array.isArray(value) ? value.length : 0,
      hash: crypto.createHash('sha1').update(raw).digest('hex').slice(0, 12),
    };
  }

  if (field === 'description' || field === 'excerpt' || field === 'title') {
    return shorten(value);
  }

  return value;
}

function getComparableExistingValue(entity, field) {
  if (!entity) {
    return undefined;
  }

  if (field === 'author' || field === 'category' || field === 'quizSet' || field === 'cover') {
    return extractId(entity[field]);
  }

  if (field === 'tags' || field === 'topicCollections' || field === 'wikiNodes') {
    return extractManyIds(entity[field]);
  }

  return entity[field];
}

function getComparablePayloadValue(payload, field) {
  if (field === 'tags' || field === 'topicCollections' || field === 'wikiNodes') {
    return (payload[field] || []).slice().sort((a, b) => a - b);
  }

  return payload[field];
}

function buildDiffSummary(existingEntity, payload) {
  if (!payload) {
    return null;
  }

  const changed = [];
  const fields = Object.keys(payload);

  for (const field of fields) {
    const oldValue = getComparableExistingValue(existingEntity, field);
    const newValue = getComparablePayloadValue(payload, field);

    if (stableJson(oldValue) !== stableJson(newValue)) {
      changed.push({
        field,
        from: summarizeValueByField(field, oldValue),
        to: summarizeValueByField(field, newValue),
      });
    }
  }

  return {
    type: existingEntity ? 'update' : 'create',
    changedCount: changed.length,
    changedFields: changed,
  };
}

function validateFrontmatterShape(frontmatter, context) {
  if (frontmatter.contentType && !allowedContentTypes.has(String(frontmatter.contentType))) {
    context.errors.push(`Invalid contentType: ${frontmatter.contentType}`);
  }

  if (frontmatter.accessLevel && !allowedAccessLevels.has(String(frontmatter.accessLevel))) {
    context.errors.push(`Invalid accessLevel: ${frontmatter.accessLevel}`);
  }

  const numericFields = ['author', 'category', 'cover', 'quizSet', 'readingTime', 'viewCount', 'likeCount', 'unlockTtlSeconds'];
  for (const field of numericFields) {
    if (frontmatter[field] !== undefined && frontmatter[field] !== null && Number.isNaN(Number(frontmatter[field]))) {
      context.errors.push(`${field} should be a number`);
    }
  }

  const arrayFields = ['tags', 'topicCollections', 'wikiNodes'];
  for (const field of arrayFields) {
    if (frontmatter[field] !== undefined && !Array.isArray(frontmatter[field])) {
      context.errors.push(`${field} should be an array of numeric ids`);
    }
  }

  if (frontmatter.excerpt && String(frontmatter.excerpt).length > 300) {
    context.errors.push('excerpt exceeds 300 characters');
  }

  if (frontmatter.unlockTtlSeconds && Number(frontmatter.unlockTtlSeconds) < 60) {
    context.errors.push('unlockTtlSeconds must be >= 60');
  }

  if (isProduction && frontmatter.password && !allowPlaintextPassword) {
    context.errors.push('plaintext password is blocked in production; provide passwordHash or enable ALLOW_PLAINTEXT_PASSWORD=true');
  }

  if (frontmatter.password && frontmatter.passwordHash) {
    context.warnings.push('both password and passwordHash provided; password takes precedence');
  }
}

function toArticlePayload(filePath, frontmatter, markdownBody, context) {
  const inferredSlug = path.basename(filePath).replace(/\.(md|markdown)$/i, '');
  const slug = String(frontmatter.slug || inferredSlug).trim();
  const title = String(frontmatter.title || '').trim();
  context.slug = slug;

  if (!title) {
    context.errors.push('Missing required frontmatter field: title');
  }

  if (!slug) {
    context.errors.push('Missing required frontmatter field: slug');
  }

  if (!markdownBody) {
    context.errors.push('Markdown body is empty');
  }

  validateFrontmatterShape(frontmatter, context);

  const description = frontmatter.description ? String(frontmatter.description) : undefined;
  const excerpt = frontmatter.excerpt ? String(frontmatter.excerpt) : undefined;

  const payload = {
    title,
    slug,
    description,
    excerpt,
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

  if (frontmatter.cover) {
    const coverId = Number(frontmatter.cover);
    if (Number.isInteger(coverId) && coverId > 0) {
      payload.cover = coverId;
    }
  }

  if (frontmatter.author) {
    const authorId = Number(frontmatter.author);
    if (Number.isInteger(authorId) && authorId > 0) {
      payload.author = authorId;
    }
  }

  if (frontmatter.category) {
    const categoryId = Number(frontmatter.category);
    if (Number.isInteger(categoryId) && categoryId > 0) {
      payload.category = categoryId;
    }
  }

  const tags = normalizeManyRelation(frontmatter.tags);
  if (tags.length) payload.tags = tags;

  const topicCollections = normalizeManyRelation(frontmatter.topicCollections);
  if (topicCollections.length) payload.topicCollections = topicCollections;

  const wikiNodes = normalizeManyRelation(frontmatter.wikiNodes);
  if (wikiNodes.length) payload.wikiNodes = wikiNodes;

  if (frontmatter.quizSet) {
    const quizSetId = Number(frontmatter.quizSet);
    if (Number.isInteger(quizSetId) && quizSetId > 0) {
      payload.quizSet = quizSetId;
    }
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
    if (payload[key] === undefined || Number.isNaN(payload[key])) {
      delete payload[key];
    }
  });

  return payload;
}

async function findArticleIdBySlug(slug) {
  const url = `${baseUrl}/api/articles?filters[slug][$eq]=${encodeURIComponent(slug)}&fields[0]=slug`;
  const result = await requestJson(url, { method: 'GET' });
  const first = result?.data?.[0];
  return first?.id;
}

async function fetchArticleForDiff(id) {
  const url = `${baseUrl}/api/articles/${id}?populate[0]=author&populate[1]=category&populate[2]=tags&populate[3]=topicCollections&populate[4]=wikiNodes&populate[5]=quizSet&populate[6]=cover&populate[7]=seo&populate[8]=blocks`;
  const result = await requestJson(url, { method: 'GET' });
  return result?.data || null;
}

async function entityExists(endpoint, id) {
  const url = `${baseUrl}${endpoint}/${id}?fields[0]=id`;
  try {
    await requestJson(url, { method: 'GET' });
    return true;
  } catch {
    return false;
  }
}

async function validateRelations(context) {
  const payload = context.payload;
  const checks = [];

  if (payload.author) checks.push(['author', payload.author]);
  if (payload.category) checks.push(['category', payload.category]);
  if (payload.quizSet) checks.push(['quizSet', payload.quizSet]);

  for (const id of payload.tags || []) checks.push(['tags', id]);
  for (const id of payload.topicCollections || []) checks.push(['topicCollections', id]);
  for (const id of payload.wikiNodes || []) checks.push(['wikiNodes', id]);

  for (const [field, id] of checks) {
    const endpoint = relationEndpointMap[field];
    const exists = await entityExists(endpoint, id);
    if (!exists) {
      context.errors.push(`Relation ${field} id=${id} does not exist`);
      if (failFast) {
        break;
      }
    }
  }
}

async function writeReport(report) {
  const target = path.resolve(process.cwd(), reportFile);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(report, null, 2), 'utf8');
  return target;
}

async function createArticle(data) {
  const url = `${baseUrl}/api/articles`;
  return requestJson(url, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}

async function updateArticle(id, data) {
  const url = `${baseUrl}/api/articles/${id}`;
  return requestJson(url, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });
}

async function run() {
  const absoluteDir = path.resolve(process.cwd(), contentDir);
  const singleFilePath = singleFileArg ? path.resolve(process.cwd(), singleFileArg) : null;
  const targetPath = singleFilePath || absoluteDir;

  const exists = await fs
    .access(targetPath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    console.error(`[import-content] Content path not found: ${targetPath}`);
    process.exit(1);
  }

  const files = singleFilePath ? [singleFilePath] : await walkMarkdownFiles(absoluteDir);
  if (!files.length) {
    console.log('[import-content] No markdown files found.');
    return;
  }

  console.log(`[import-content] Found ${files.length} markdown file(s). strict=${strictMode}`);

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
    strictMode,
    contentDir: singleFilePath ? path.dirname(singleFilePath) : absoluteDir,
    summary: {
      total: files.length,
      validated: 0,
      created: 0,
      updated: 0,
      failed: 0,
    },
    items: [],
  };

  const contexts = [];
  const slugSet = new Set();

  for (const filePath of files) {
    const context = createFileContext(filePath);
    contexts.push(context);

    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const { data: frontmatter, content } = matter(raw);
      context.payload = toArticlePayload(filePath, frontmatter, content.trim(), context);

      if (onlySlugs.size > 0 && !onlySlugs.has(context.slug)) {
        context.action = 'SKIP';
        context.warnings.push('Skipped by --slug filter');
        continue;
      }

      if (context.slug && slugSet.has(context.slug)) {
        context.errors.push(`Duplicated slug in this batch: ${context.slug}`);
      }
      slugSet.add(context.slug);

      if (strictMode && context.errors.length) {
        if (failFast) {
          break;
        }
        continue;
      }

      report.summary.validated += 1;
      if (dryRun) {
        context.action = 'VALIDATE';
        if (token) {
          context.existingId = await findArticleIdBySlug(context.slug);
          const existingEntity = context.existingId ? await fetchArticleForDiff(context.existingId) : null;
          context.diffSummary = buildDiffSummary(existingEntity, context.payload);
        } else {
          context.warnings.push('STRAPI_CONTENT_TOKEN not set in dry-run; diff summary skipped');
        }
        console.log(`[DRY-RUN] VALID ${context.slug}`);
        continue;
      }

      context.existingId = await findArticleIdBySlug(context.slug);
      context.action = context.existingId ? 'UPDATE' : 'CREATE';
      const existingEntity = context.existingId ? await fetchArticleForDiff(context.existingId) : null;
      context.diffSummary = buildDiffSummary(existingEntity, context.payload);

      await validateRelations(context);
      if (strictMode && context.errors.length && failFast) {
        break;
      }
    } catch (error) {
      context.errors.push(error.message);
      if (failFast) {
        break;
      }
    }
  }

  const hasValidationErrors = contexts.some((ctx) => ctx.errors.length > 0);
  if (!dryRun && strictMode && hasValidationErrors) {
    for (const ctx of contexts) {
      report.items.push({
        filePath: ctx.filePath,
        slug: ctx.slug,
        action: ctx.action,
        errors: ctx.errors,
        warnings: ctx.warnings,
      });
      if (ctx.errors.length > 0) {
        report.summary.failed += 1;
      }
    }

    const saved = await writeReport(report);
    console.error(`[import-content] Validation failed. Report written: ${saved}`);
    process.exit(1);
  }

  if (!dryRun) {
    for (const context of contexts) {
      if (context.errors.length > 0 || !context.payload) {
        report.summary.failed += 1;
        continue;
      }

      try {
        if (context.existingId) {
          await updateArticle(context.existingId, context.payload);
          context.writtenId = context.existingId;
          report.summary.updated += 1;
          console.log(`[UPDATED] ${context.slug} (#${context.existingId})`);
        } else {
          const created = await createArticle(context.payload);
          context.writtenId = created?.data?.id ?? null;
          report.summary.created += 1;
          console.log(`[CREATED] ${context.slug} (#${context.writtenId ?? 'unknown'})`);
        }
      } catch (error) {
        context.errors.push(error.message);
        report.summary.failed += 1;
        console.error(`[FAILED] ${context.slug}: ${error.message}`);

        if (failFast) {
          break;
        }
      }
    }
  }

  for (const context of contexts) {
    if (context.action === 'SKIP') {
      continue;
    }

    context.valid = context.errors.length === 0;
    report.items.push({
      filePath: context.filePath,
      slug: context.slug,
      action: context.action,
      existingId: context.existingId,
      writtenId: context.writtenId,
      valid: context.valid,
      diffSummary: context.diffSummary,
      errors: context.errors,
      warnings: context.warnings,
    });
  }

  const savedReportPath = await writeReport(report);
  console.log(`[import-content] Report written: ${savedReportPath}`);
  console.log('[import-content] Done.');

  if (report.summary.failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('[import-content] Failed:', error.message);
  process.exit(1);
});
