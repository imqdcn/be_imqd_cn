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

5. 单文件导入（只处理一篇）
- node scripts/import-content.mjs --file content/articles/hello-markdown.md --dry-run
- node scripts/import-content.mjs --file content/articles/hello-markdown.md

6. 按 slug 过滤（处理部分文章）
- node scripts/import-content.mjs --slug markdown-import-demo --dry-run
- node scripts/import-content.mjs --slug slug-a,slug-b,slug-c

7. 自定义报告输出路径
- node scripts/import-content.mjs --dry-run --report reports/review-2026-04-12.json
- node scripts/import-content.mjs --slug slug-a,slug-b --report reports/batch-a.json

3. 按 slug 自动更新
- 若 slug 已存在：更新 Article
- 若 slug 不存在：创建 Article

4. 单篇创建
- 准备新文件，例如 content/articles/new-post.md
- frontmatter 里给一个新 slug（数据库中不存在）
- 先 dry-run，再正式导入：
	- node scripts/import-content.mjs --file content/articles/new-post.md --dry-run
	- node scripts/import-content.mjs --file content/articles/new-post.md

5. 单篇修改
- 修改已有文章对应的 markdown（slug 不变）
- 执行单文件导入：
	- node scripts/import-content.mjs --file content/articles/exist-post.md --dry-run
	- node scripts/import-content.mjs --file content/articles/exist-post.md

6. 批量创建
- 在 content/articles 下新增多篇 markdown，保证每篇 slug 都是新的
- 执行批量导入：
	- npm run content:import:dry
	- npm run content:import:safe

7. 批量修改
- 批量修改已存在文章的 markdown（保持原 slug）
- 全量执行或 slug 定向执行：
	- npm run content:import:dry
	- npm run content:import:safe
	- 或 node scripts/import-content.mjs --slug slug-a,slug-b --dry-run
	- 或 node scripts/import-content.mjs --slug slug-a,slug-b

4. 导入报告
- 每次执行会输出 JSON 报告，默认路径：reports/content-import-report.json
- 报告包含：校验结果、创建/更新统计、失败原因。
- 报告包含字段差异摘要：changedCount + changedFields(from/to)，便于发布审批。
- 可通过 `--report` 为本次执行指定独立报告文件，方便归档。

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

## 8. 升级后回归
- Strapi 升级后请执行快速回归清单：
- `Docs/Strapi升级后10分钟导入回归清单.md`

## 9. 生产环境手工发布流（无 CI）
适用：部署到自有云服务器，手工执行发布。

1. 登录服务器并进入项目目录
- `cd /path/to/be_imqd_cn`

2. 拉取代码并安装依赖
- `git pull`
- `npm ci`

3. 预检（不写库）
- `node scripts/import-content.mjs --dry-run --report reports/review-YYYYMMDD-HHmm.json`
- 检查报告中的 `summary.failed`、`items[].errors`、`diffSummary`

4. 正式发布（写库）
- 全量：`node scripts/import-content.mjs --report reports/release-YYYYMMDD-HHmm.json`
- 定向：`node scripts/import-content.mjs --slug slug-a,slug-b --report reports/release-partial-YYYYMMDD-HHmm.json`

5. 发布后抽检
- 在 Strapi 后台或 Postman 抽检关键文章
- 至少验证：标题、slug、正文 blocks、标签/分类、是否受保护

6. 留档与回滚
- 保留本次 review/release 报告文件用于审计
- 若发布异常，先回滚 markdown 内容（git revert），再重新执行一次导入覆盖

推荐环境变量（生产）：
- `CONTENT_IMPORT_FAIL_FAST=true`
- `ALLOW_PLAINTEXT_PASSWORD=false`
- `CONTENT_IMPORT_REPORT=reports/content-import-report.json`
