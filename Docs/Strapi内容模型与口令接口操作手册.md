# Strapi 内容模型与口令接口操作手册

## 1. 文档目的
本手册用于沉淀当前项目的内容建模改造、口令解锁接口定制、Postman 测试方式与 Strapi 升级指南，便于后续开发、联调和版本迭代。

适用项目：be_imqd_cn  
最后更新：2026-04-12（含 Markdown 发布工作流）

---

## 2. 本次改造总览

### 2.1 核心目标
- 从基础博客模型扩展到多内容形态（长文、短文、图集、视频、试题、专题、知识库）。
- 引入口令访问能力，支持受保护文章的解锁与详情分级返回。
- 提供可导入 Postman 的联调资产，方便前端搭建前进行字段验证。

### 2.2 已完成能力
- 扩展 Article 字段与关系（内容类型、统计、保护访问、SEO、扩展 blocks）。
- 新增 5 个内容类型：Tag、Topic Collection、Knowledge Node、Quiz Set、Quiz Item。
- 新增 3 个组件：shared.video-embed、shared.code-snippet、quiz.option。
- 新增解锁接口：POST /api/articles/:id/unlock。
- 覆盖文章详情返回逻辑：未解锁返回安全摘要，解锁后返回完整内容。
- 新增 Postman Collection + Environment。
- 新增 Markdown 发布工作流（Frontmatter 自动映射 Article 字段）。
- 新增后台插件导入方式：`/admin/plugins/markdown-import`。
- 导入能力支持 create/update、结果报告与失败明细展示。

---

## 3. 文件变更清单

### 3.1 重点业务文件
- src/api/article/content-types/article/schema.json
- src/api/article/controllers/article.ts
- src/api/article/routes/article-unlock.ts
- src/api/author/content-types/author/schema.json

### 3.2 新增内容类型
- src/api/tag/content-types/tag/schema.json
- src/api/tag/controllers/tag.ts
- src/api/tag/routes/tag.ts
- src/api/tag/services/tag.ts

- src/api/topic-collection/content-types/topic-collection/schema.json
- src/api/topic-collection/controllers/topic-collection.ts
- src/api/topic-collection/routes/topic-collection.ts
- src/api/topic-collection/services/topic-collection.ts

- src/api/knowledge-node/content-types/knowledge-node/schema.json
- src/api/knowledge-node/controllers/knowledge-node.ts
- src/api/knowledge-node/routes/knowledge-node.ts
- src/api/knowledge-node/services/knowledge-node.ts

- src/api/quiz-set/content-types/quiz-set/schema.json
- src/api/quiz-set/controllers/quiz-set.ts
- src/api/quiz-set/routes/quiz-set.ts
- src/api/quiz-set/services/quiz-set.ts

- src/api/quiz-item/content-types/quiz-item/schema.json
- src/api/quiz-item/controllers/quiz-item.ts
- src/api/quiz-item/routes/quiz-item.ts
- src/api/quiz-item/services/quiz-item.ts

### 3.3 新增组件
- src/components/shared/video-embed.json
- src/components/shared/code-snippet.json
- src/components/quiz/option.json

### 3.4 联调资产
- postman/strapi-blog.postman_collection.json
- postman/strapi-blog.local.postman_environment.json

### 3.5 Markdown 发布相关
- content/articles/hello-markdown.md
- Docs/Markdown发布工作流.md
- package.json（保留 gray-matter 依赖，导入命令已迁移为插件入口）

### 3.6 构建生成类型文件（由 Strapi 生成）
- types/generated/contentTypes.d.ts
- types/generated/components.d.ts

---

## 4. 数据模型说明（摘要）

### 4.1 Article（核心）
新增关键字段：
- contentType: long, short, gallery, video, quiz, topic, wiki
- excerpt
- featured, pinned
- readingTime, viewCount, likeCount
- isProtected, accessLevel, passwordHint, passwordHash, unlockTtlSeconds
- seo 组件

新增关键关系：
- tags <-> Tag
- topicCollections <-> Topic Collection
- wikiNodes <-> Knowledge Node
- quizSet -> Quiz Set
- quizItems <- Quiz Item

blocks 新增组件支持：
- shared.video-embed
- shared.code-snippet

### 4.2 Author
新增 slug 字段，email 类型改为 email，name 增加必填和长度约束。

### 4.3 其余新增类型
- Tag：标签。
- Topic Collection：专题集合。
- Knowledge Node：知识库目录树节点（含 parent/children）。
- Quiz Set：题组。
- Quiz Item：题目（支持选项组件和私有答案字段）。

---

## 5. 口令访问机制

### 5.1 解锁接口
- 方法：POST
- 路径：/api/articles/:id/unlock
- 请求体：
  {
    "password": "文章口令"
  }

成功返回字段：
- unlocked
- unlockToken
- expiresAt
- article（当前实现中包含完整文章）

### 5.2 文章详情分级返回
- 请求路径：GET /api/articles/:id
- 查询参数：unlockToken

行为：
- 未携带或 token 无效：返回安全摘要数据，meta.locked = true。
- token 有效：返回完整文章数据，meta.locked = false。

### 5.3 token 签名方式
- HMAC-SHA256。
- 密钥优先级：ARTICLE_UNLOCK_SECRET > JWT_SECRET > 固定回退值。

建议：生产环境务必配置 ARTICLE_UNLOCK_SECRET。

---

## 6. Postman 使用方式

### 6.1 导入
1. 导入 Collection：postman/strapi-blog.postman_collection.json
2. 导入 Environment：postman/strapi-blog.local.postman_environment.json
3. 选择环境 IMQDCN Strapi Local

### 6.2 最小测试路径
1. 改 baseUrl、articleId、password。
2. 调用 Unlock Article。
3. 把响应中的 unlockToken 写入环境变量 unlockToken。
4. 调用 Get Article By ID：
   - 有 unlockToken 时应返回全文。
   - 清空 unlockToken 后应返回摘要。

### 6.3 常见问题
- unlockToken 不是固定值，每次解锁会返回新的 token。
- token 过期后需要重新调用 unlock。

---

## 7. 日常运维与配置建议

### 7.1 密码写入方式
当前实现对比字段为 passwordHash（SHA-256）。

建议在写入数据时先生成 hash 再保存，不建议存明文。示例命令：
node -e "console.log(require('crypto').createHash('sha256').update('123456').digest('hex'))"

### 7.2 环境变量建议
- ARTICLE_UNLOCK_SECRET：强随机字符串，生产必配。
- JWT_SECRET：保留 Strapi 原有用途。
- Markdown 导入通过后台登录态执行，不需要额外 `STRAPI_CONTENT_TOKEN`。

### 7.3 Markdown 发布工作流
目标：通过 Markdown + Frontmatter 在后台插件中批量创建/更新 Article，减少后台手工录入。

主要文件：
- `content/articles/*.md`：内容源文件。
- 插件页面：`/admin/plugins/markdown-import`。

支持字段（Frontmatter 常用）：
- title、slug、description、excerpt、contentType
- author、category、tags
- topicCollections、wikiNodes、quizSet
- featured、pinned、readingTime、viewCount、likeCount
- isProtected、accessLevel、passwordHint、unlockTtlSeconds
- password（导入时自动转 passwordHash）或 passwordHash
- seo、cover、publish

正文映射规则：
- Markdown 正文会写入 `blocks[0]` 的 `shared.rich-text.body`。

操作入口：
1. 登录 Strapi 后台，进入 Markdown 导入页面。
2. 选择文件或粘贴内容后执行导入。
3. 在页面“导入结果”中查看 create/update/failed 明细。

导入策略：
- 按 `slug` 判断，存在则更新，不存在则创建。
- 优先按 `documentId` 匹配，未命中再按 `slug` 匹配。
- `publish: true` 时自动设置 `publishedAt`。
- 页面内可直接查看导入摘要与逐项错误信息。

创建/修改操作说明：
- 单篇创建：新增 markdown 且使用新 slug，在插件页面导入单文件。
- 单篇修改：编辑已有 slug 对应 markdown，在插件页面再次导入。
- 批量创建/修改：一次选择多篇 markdown 执行导入。

安全建议：
- 不建议长期保留 Frontmatter 明文 `password`，导入后建议改为仅保留 `passwordHash`。

---

## 8. 升级指南（npm run upgrade）

结论：本次改造属于标准扩展方式，可升级；但升级后需要重点回归自定义控制器逻辑。

### 8.1 升级前检查
1. 提交当前代码，确保可回滚。
2. 执行 dry-run：npm run upgrade:dry
3. 记录当前可用状态：
   - npm run build
   - 关键接口可用（unlock、article detail）

### 8.2 正式升级步骤
1. 执行：npm run upgrade
2. 重新安装依赖（如有提示）。
3. 执行：npm run build
4. 执行：npm run develop

### 8.3 升级后必测清单
1. POST /api/articles/:id/unlock
2. GET /api/articles/:id（无 token）
3. GET /api/articles/:id（有 token）
4. 新增类型 CRUD：tags/topic-collections/knowledge-nodes/quiz-sets/quiz-items
5. 后台 Content Manager 打开各模型是否正常

### 8.4 已知风险点
- 新增 API 的 controller/router/service 使用了 as any 以兼容当前 TS 泛型约束。
- 升级后如 Strapi 类型系统调整，可能需要收敛 as any。
- tsconfig 中 moduleResolution 的弃用提示与本次业务改造无直接关系，但未来 TS 大版本需处理。

---

## 9. 回滚方案
1. 若升级或改造后异常，优先回滚到最近可用提交。
2. 重新执行 npm ci + npm run build 验证。
3. 保留 Postman 测试结果作为回滚验收证据。

---

## 10. 后续建议
- 将 Unlock Article 的 Postman 测试脚本补齐为自动写入 unlockToken。
- 在服务端新增受保护内容的统一响应中间层，避免未来多模型重复实现。
- 前端 Nuxt 搭建后，先做 API SDK 封装：article detail + unlock 二段流。
- 内容侧建议逐步切换到 Markdown 为主、后台补录为辅的运营方式，提升发布效率。

---

## 11. 升级后快速回归清单
- 详见：`Docs/Strapi升级后10分钟导入回归清单.md`

## 12. 生产环境手工发布流（无 CI）
- 详见：`Docs/Markdown发布工作流.md` 的“生产环境手工发布流（无 CI）”章节。
- 执行原则：先 dry-run 再 write，保留报告，失败优先回滚 markdown 后重导入。
