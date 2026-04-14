# Strapi 升级后 10 分钟导入回归清单

## 1. 目的
在 Strapi 升级后，快速验证后台插件导入链路是否仍可用，避免发布中断。

适用范围：
- 本地插件 `markdown-import`
- Article 及其关联模型

---

## 2. 前置条件（1 分钟）
1. 当前分支代码已拉取并安装依赖。
2. 后端可正常启动。
3. 管理员账号可登录后台。

---

## 3. 快速检查步骤

### 步骤 A：构建与启动（约 2 分钟）
1. 执行：`npm run build`
2. 执行：`npm run develop`
3. 通过标准：构建成功、服务可访问。

### 步骤 B：插件入口可见性（约 2 分钟）
1. 登录后台。
2. 检查左侧是否有“Markdown 导入”菜单。
3. 打开 `/admin/plugins/markdown-import`。
4. 通过标准：页面可打开，无 404。

### 步骤 C：单篇导入验证（约 3 分钟）
1. 使用 `content/articles/hello-markdown.md`。
2. 在插件页面导入该文件。
3. 通过标准：
- 请求成功返回
- 结果区域有 action/status
- failed = 0

### 步骤 D：更新逻辑验证（约 2 分钟）
1. 修改同一 slug 的 markdown 文本。
2. 再次导入。
3. 通过标准：动作为 `update`，内容已更新。

### 步骤 E：关联与保护字段抽检（约 1 分钟）
至少抽检：
- author/category/tags 关联
- isProtected/accessLevel/passwordHash
- seo 字段

---

## 4. 关键验收点
1. 插件菜单可见且页面可打开。
2. create/update 逻辑正确。
3. 导入结果表格可读，错误信息可定位。
4. 升级后无鉴权回退问题（401/405）。

---

## 5. 常见失败与处理
1. `401 Unauthorized`
- 重新登录后台后重试。
- 检查插件前端是否触发了 token 兜底重试逻辑。

2. `405 Method Not Allowed`
- 多为请求路径或前端缓存问题。
- 强刷后台：`Ctrl+F5`。

3. 插件菜单不显示
- 检查 `config/plugins.ts`。
- 检查插件根目录是否存在 `strapi-admin.js`。

---

## 6. 升级后结论模板
- Strapi 版本：x.y.z -> a.b.c
- Build：PASS/FAIL
- 插件可见性：PASS/FAIL
- 单篇导入：PASS/FAIL
- 更新导入：PASS/FAIL
- 主要问题：
- 处理结果：
- 是否允许进入生产：YES/NO

---

## 7. 关联文档
- `Docs/Markdown发布工作流.md`
- `Docs/Strapi本地插件迁移与升级指南.md`
