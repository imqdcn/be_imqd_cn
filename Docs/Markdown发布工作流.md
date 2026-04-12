# Markdown 发布工作流

## 1. 目标
用 Markdown + Frontmatter 发布文章，避免在 Strapi 后台逐个编辑大量字段。

## 2. 文件位置
- 内容目录：content/articles
- 导入脚本：scripts/import-content.mjs

## 3. 环境变量
在 .env 中至少配置：
- STRAPI_BASE_URL=http://localhost:1337
- STRAPI_CONTENT_TOKEN=你的 Strapi API Token
- CONTENT_DIR=content/articles（可选）

生产建议额外配置：
- CONTENT_IMPORT_REPORT=reports/content-import-report.json
- CONTENT_IMPORT_FAIL_FAST=true
- ALLOW_PLAINTEXT_PASSWORD=false

## 4. Frontmatter 字段映射
支持字段（常用）：
- title, slug, description, excerpt, contentType
- author, category, tags
- topicCollections, wikiNodes, quizSet
- featured, pinned, readingTime, viewCount, likeCount
- isProtected, accessLevel, passwordHint, unlockTtlSeconds
- password（明文，仅导入时转 passwordHash）
- passwordHash
- seo
- cover
- publish（true 时自动设置 publishedAt）

正文内容：
- Markdown 正文将写入 blocks[0] => shared.rich-text.body。

## 5. 使用命令
1. 预览导入动作（不写库）
- npm run content:import:dry

2. 正式导入
- npm run content:import

3. 生产推荐（严格模式，默认）
- npm run content:import:safe

4. 非严格模式（仅排障临时使用）
- npm run content:import:lenient

3. 按 slug 自动更新
- 若 slug 已存在：更新 Article
- 若 slug 不存在：创建 Article

4. 导入报告
- 每次执行会输出 JSON 报告，默认路径：reports/content-import-report.json
- 报告包含：校验结果、创建/更新统计、失败原因。
- 报告包含字段差异摘要：changedCount + changedFields(from/to)，便于发布审批。

5. 两阶段执行（近似事务）
- 阶段1：全量解析 + 校验（字段、重复 slug、关联存在性）
- 阶段2：仅在阶段1通过后才执行写入
- 严格模式下若校验失败，不会写入任何内容

6. 差异摘要说明
- Dry-run 且配置 STRAPI_CONTENT_TOKEN 时，会拉取线上旧数据并生成字段差异。
- 未配置 STRAPI_CONTENT_TOKEN 的 dry-run 只做本地校验，不生成差异摘要。

## 6. 安全建议
- 不要把 STRAPI_CONTENT_TOKEN 提交到仓库。
- 不建议在长期存放的 markdown 中保留 password 明文。
- 建议导入后将 password 字段删除，保留 passwordHash。
- 生产环境默认拦截明文 password（除非显式设置 ALLOW_PLAINTEXT_PASSWORD=true）。

## 7. 常见问题
1. 401 Unauthorized
- 检查 STRAPI_CONTENT_TOKEN 是否有效。

2. 400 Bad Request
- 检查 frontmatter 字段类型，例如 author/category/tags 是否为数字 ID。

3. 导入成功但内容显示不全
- 确认 Article 的 blocks 渲染逻辑已支持 shared.rich-text。

4. 导入直接失败并提示 Validation failed
- 打开 reports/content-import-report.json 查看每个文件的 errors。
