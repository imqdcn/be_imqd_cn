# Markdown 发布工作流

## 1. 目标
通过 Strapi 后台插件进行 Markdown 导入，避免命令行导入带来的 token 管理与环境差异问题。

## 2. 入口
- 后台路径：`/admin/plugins/markdown-import`
- 左侧菜单：Markdown 导入

## 3. 文件位置
- 内容目录：`content/articles`
- 导入方式：后台插件页面

## 4. Frontmatter 字段映射
常用字段：
- title, slug, description, excerpt, contentType
- author, category, tags
- topicCollections, wikiNodes, quizSet
- featured, pinned, readingTime, viewCount, likeCount
- isProtected, accessLevel, passwordHint, unlockTtlSeconds
- password（导入时转 passwordHash）
- passwordHash
- seo, cover, publish

正文规则：
- Markdown 正文写入 `blocks[0] -> shared.rich-text.body`

## 5. 操作步骤
1. 登录 Strapi 后台。
2. 进入 Markdown 导入页面。
3. 上传 `.md` 文件，或粘贴单篇 Markdown 内容。
4. 确认待导入列表。
5. 点击“开始导入”。
6. 在“导入结果”区域查看 create/update/failed 明细。

## 6. 创建与更新规则
- 优先按 `documentId` 匹配：命中则更新。
- 未命中时按 `slug` 匹配：命中则更新。
- 都未命中：创建新文章。
- 若 `documentId` 与 `slug` 分别命中不同文章：标记失败并提示冲突。

## 7. 结果检查
每次导入后至少检查：
1. 总数、created、updated、failed 统计是否符合预期。
2. 失败项的错误信息是否可解释。
3. 关键文章在后台内容管理中可正常打开。

## 8. 安全建议
- 不要在 markdown 中长期保存明文 `password`。
- 导入后建议仅保留 `passwordHash`。
- 导入操作应使用管理员登录态，不依赖内容 API token。

## 9. 常见问题
1. `401 Unauthorized`
- 确认当前后台登录态有效，重新登录后重试。

2. `Method Not Allowed`
- 通常是请求路径错误或旧前端缓存，`Ctrl+F5` 强刷后台页面。

3. 页面没有菜单或打开 404
- 检查插件启用配置与本地插件入口文件，详见迁移指南。

## 10. 关联文档
- `Docs/Strapi本地插件迁移与升级指南.md`
- `Docs/Strapi升级后10分钟导入回归清单.md`
