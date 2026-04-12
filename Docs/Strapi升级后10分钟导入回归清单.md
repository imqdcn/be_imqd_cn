# Strapi 升级后 10 分钟导入回归清单

## 1. 目的
在 Strapi 升级后，快速验证 Markdown 导入链路是否仍可用，避免生产发布中断。

适用范围：
- scripts/import-content.mjs
- Article 及其关联模型 API

---

## 2. 前置条件（1 分钟）
1. 当前分支代码已拉取并安装依赖。
2. 环境变量已配置：
- STRAPI_BASE_URL
- STRAPI_CONTENT_TOKEN
- CONTENT_DIR
- CONTENT_IMPORT_REPORT
3. 后端服务可访问（本地或测试环境）。

---

## 3. 快速检查步骤（建议顺序）

## 步骤 A：框架与类型检查（约 2 分钟）
1. 执行：npm run build
2. 通过标准：构建成功，无阻断错误。

## 步骤 B：导入脚本语法检查（约 1 分钟）
1. 执行：node --check scripts/import-content.mjs
2. 通过标准：无输出或无错误返回。

## 步骤 C：单篇 dry-run（约 2 分钟）
1. 执行：
- node scripts/import-content.mjs --file content/articles/hello-markdown.md --dry-run --report reports/upgrade-single-check.json
2. 通过标准：
- 命令退出码为 0
- 报告文件生成
- 报告中 summary.failed = 0

## 步骤 D：定向批量 dry-run（约 2 分钟）
1. 执行：
- node scripts/import-content.mjs --slug markdown-import-demo --dry-run --report reports/upgrade-batch-check.json
2. 通过标准：
- 命令退出码为 0
- 报告中能看到对应 slug 条目

## 步骤 E：小流量真实写入（约 3 分钟）
1. 执行：
- node scripts/import-content.mjs --slug markdown-import-demo --report reports/upgrade-write-check.json
2. 通过标准：
- 命令退出码为 0
- 报告中 failed = 0
- 后台可看到对应文章创建/更新生效

---

## 4. 关键验收点
1. 关联校验可用：author/category/tags/topicCollections/wikiNodes/quizSet 不报不存在。
2. slug 逻辑正确：存在即更新，不存在即创建。
3. 差异报告可用：diffSummary 结构正常（有 token 情况下）。
4. 口令字段行为正常：password 或 passwordHash 不导致写入异常。
5. 严格模式正常：校验失败时阻止写入。

---

## 5. 常见失败与处理
1. 401 Unauthorized
- 检查 STRAPI_CONTENT_TOKEN 是否过期或权限不足。

2. 400 Bad Request
- 检查 schema 是否变化导致字段不兼容。
- 核对 frontmatter 字段类型（数字/数组/枚举）。

3. 关联不存在
- 先补齐关联实体（作者、分类、标签等），再重新导入。

4. diffSummary 为 null
- 通常为 dry-run 未配置 token，或对应 slug 尚不存在（create 场景可接受）。

---

## 6. 升级后最小回归结论模板
可在每次升级后复制以下模板：

- Strapi 版本：x.y.z -> a.b.c
- Build：PASS/FAIL
- 单篇 dry-run：PASS/FAIL
- 定向批量 dry-run：PASS/FAIL
- 小流量写入：PASS/FAIL
- 主要问题：
- 处理结果：
- 是否允许进入生产：YES/NO

---

## 7. 关联文档
- Docs/Markdown发布工作流.md
- Docs/Strapi内容模型与口令接口操作手册.md
