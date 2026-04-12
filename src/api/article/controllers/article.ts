/**
 * article controller
 */

import { factories } from '@strapi/strapi';
import crypto from 'crypto';

const UNLOCK_SECRET = process.env.ARTICLE_UNLOCK_SECRET ?? process.env.JWT_SECRET ?? 'article-unlock-secret';

function base64Url(input: string) {
	return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signUnlockToken(payload: { articleId: number; expiresAt: string }) {
	const body = base64Url(JSON.stringify(payload));
	const signature = crypto.createHmac('sha256', UNLOCK_SECRET).update(body).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

	return `${body}.${signature}`;
}

function hashPassword(password: string) {
	return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyUnlockToken(token: string, articleId: number) {
	const [body, signature] = token.split('.');

	if (!body || !signature) {
		return false;
	}

	const expectedSignature = crypto.createHmac('sha256', UNLOCK_SECRET).update(body).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

	if (signature.length !== expectedSignature.length) {
		return false;
	}

	if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
		return false;
	}

	try {
		const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as { articleId?: number; expiresAt?: string };

		if (payload.articleId !== articleId) {
			return false;
		}

		if (!payload.expiresAt || Number.isNaN(Date.parse(payload.expiresAt))) {
			return false;
		}

		return Date.now() <= Date.parse(payload.expiresAt);
	} catch {
		return false;
	}
}

function isUnlockedArticle(article: { isProtected?: boolean; accessLevel?: string }, token?: string, articleId?: number) {
	if (!article.isProtected && article.accessLevel !== 'password') {
		return true;
	}

	if (!token || !articleId) {
		return false;
	}

	return verifyUnlockToken(token, articleId);
}

function buildArticlePopulate() {
	return {
		author: { populate: ['avatar'] },
		category: true,
		tags: true,
		topicCollections: true,
		wikiNodes: true,
		quizSet: true,
		quizItems: {
			populate: ['quizSet'],
		},
		cover: true,
		blocks: true,
		seo: true,
	};
}

function buildSafeArticle(article: any) {
	return {
		id: article.id,
		title: article.title,
		slug: article.slug,
		excerpt: article.excerpt ?? article.description ?? null,
		contentType: article.contentType,
		cover: article.cover,
		author: article.author,
		category: article.category,
		tags: article.tags,
		publishedAt: article.publishedAt,
		updatedAt: article.updatedAt,
		readingTime: article.readingTime,
		viewCount: article.viewCount,
		likeCount: article.likeCount,
		isProtected: article.isProtected,
		accessLevel: article.accessLevel,
		passwordHint: article.passwordHint,
		seo: article.seo,
	};
}

export default factories.createCoreController('api::article.article', ({ strapi }) => ({
	async findOne(ctx) {
		const articleId = Number(ctx.params.id);
		if (!Number.isInteger(articleId) || articleId <= 0) {
			return ctx.badRequest('Invalid article id');
		}

		const article = await strapi.entityService.findOne('api::article.article', articleId, {
			populate: buildArticlePopulate(),
		});

		if (!article) {
			return ctx.notFound('Article not found');
		}

		const unlockToken = String(ctx.query.unlockToken ?? '').trim();
		const unlocked = isUnlockedArticle(article, unlockToken, articleId);

		if (!unlocked) {
			return {
				data: buildSafeArticle(article),
				meta: {
					locked: true,
				},
			};
		}

		return {
			data: article,
			meta: {
				locked: false,
			},
		};
	},

	async unlock(ctx) {
		const articleId = Number(ctx.params.id);
		const password = String(ctx.request.body?.password ?? '').trim();

		if (!Number.isInteger(articleId) || articleId <= 0) {
			return ctx.badRequest('Invalid article id');
		}

		if (!password) {
			return ctx.badRequest('Password is required');
		}

		const article = await strapi.entityService.findOne('api::article.article', articleId, {
			fields: ['id', 'isProtected', 'accessLevel', 'passwordHash', 'unlockTtlSeconds'],
		});

		if (!article) {
			return ctx.notFound('Article not found');
		}

		const protectedByPassword = Boolean(article.isProtected) || article.accessLevel === 'password';

		if (!protectedByPassword) {
			const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
			return {
				unlocked: true,
				unlockToken: signUnlockToken({ articleId, expiresAt }),
				expiresAt,
			};
		}

		if (!article.passwordHash) {
			return ctx.badRequest('Password is not configured for this article');
		}

		if (hashPassword(password) !== article.passwordHash) {
			return ctx.unauthorized('Invalid password');
		}

		const unlockTtlSeconds = Number(article.unlockTtlSeconds ?? 1800);
		const expiresAt = new Date(Date.now() + unlockTtlSeconds * 1000).toISOString();
		const unlockToken = signUnlockToken({ articleId, expiresAt });

		const fullArticle = await strapi.entityService.findOne('api::article.article', articleId, {
			populate: buildArticlePopulate(),
		});

		return {
			unlocked: true,
			unlockToken,
			expiresAt,
			article: fullArticle,
		};
	},
}));
