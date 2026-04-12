# Nuxt 前端 API 对接契约

## 1. 文档目标
本文件定义 Nuxt 前端对接当前 Strapi 后端时的接口契约与实现约定，重点覆盖：
- 内容列表与详情
- 口令解锁流程
- 关系数据 populate 约定
- 错误处理与状态管理

适用项目：be_imqd_cn  
最后更新：2026-04-12

---

## 2. 基础约定

### 2.1 Base URL
- 开发环境：由前端环境变量提供，例如 NUXT_PUBLIC_API_BASE。
- 示例：http://localhost:1337

### 2.2 统一 Header
- Accept: application/json
- Content-Type: application/json（POST 请求）

### 2.3 返回包约定
- 标准 Strapi 列表：data + meta.pagination
- 当前定制的文章详情：data + meta.locked
- 当前定制的解锁接口：unlocked + unlockToken + expiresAt + article

---

## 3. 内容接口

## 3.1 文章列表
### 接口
- Method: GET
- Path: /api/articles

### 推荐查询参数
- populate=*
- pagination[page]=1
- pagination[pageSize]=12
- sort=publishedAt:desc

### 示例
GET /api/articles?populate=*&pagination[page]=1&pagination[pageSize]=12&sort=publishedAt:desc

### 前端最少读取字段
- id
- title
- slug
- excerpt
- contentType
- cover
- author
- category
- tags
- publishedAt
- isProtected

---

## 3.2 文章详情（安全/全文双态）
### 接口
- Method: GET
- Path: /api/articles/:id
- Query: unlockToken（可选）

### 示例
- 未解锁：GET /api/articles/1
- 已解锁：GET /api/articles/1?unlockToken=xxx

### 返回行为
1. 未解锁或 token 无效
- meta.locked = true
- data 返回安全摘要（不含完整 blocks）

2. 解锁后或非受保护文章
- meta.locked = false
- data 返回完整文章（含 blocks）

### 前端处理建议
- 若 meta.locked 为 true，显示口令输入弹层。
- 若 meta.locked 为 false，进入全文渲染流程。

---

## 3.3 文章口令解锁
### 接口
- Method: POST
- Path: /api/articles/:id/unlock
- Auth: false（公开访问）

### 请求体
{
  "password": "用户输入口令"
}

### 成功响应示例
{
  "unlocked": true,
  "unlockToken": "token-value",
  "expiresAt": "2026-04-12T10:00:00.000Z",
  "article": { ... }
}

### 失败场景
- 密码错误：401 Unauthorized
- 未配置密码：400 Bad Request
- 文章不存在：404 Not Found

### 前端处理建议
1. 调用 unlock 成功后，将 unlockToken 存在内存状态或 sessionStorage。
2. 以 unlockToken 重新请求文章详情。
3. 根据 expiresAt 控制 token 失效，过期后要求重新输入口令。

---

## 4. 其它资源接口

## 4.1 Author
- GET /api/authors?populate=*
- GET /api/authors/:id?populate=*

## 4.2 Category
- GET /api/categories?populate=*
- GET /api/categories/:id?populate=*

## 4.3 Tag
- GET /api/tags?populate=*
- GET /api/tags/:id?populate=*

## 4.4 Topic Collection
- GET /api/topic-collections?populate=*
- GET /api/topic-collections/:id?populate=*

## 4.5 Knowledge Node
- GET /api/knowledge-nodes?populate=*
- GET /api/knowledge-nodes/:id?populate=*

## 4.6 Quiz
- GET /api/quiz-sets?populate=*
- GET /api/quiz-sets/:id?populate=items
- GET /api/quiz-items?populate=*
- GET /api/quiz-items/:id?populate=*

---

## 5. Nuxt 端推荐封装

## 5.1 API Client 基础方法
建议封装 get/post 两个基础方法：
- 自动拼接 baseURL
- 统一错误拦截
- 支持 query 序列化

## 5.2 文章详情加载器（核心）
推荐封装 useArticleDetail(id)：
1. 先请求不带 token 的详情。
2. 若 locked=true，显示口令弹层。
3. 用户提交口令后调用 unlock。
4. 把 unlockToken 写入状态并再次拉取详情。

## 5.3 token 存储策略
- 推荐：sessionStorage（浏览器会话级）+ 内存状态。
- 不建议：localStorage 长期持久化（安全风险更高）。

---

## 6. 前端错误码映射建议
当前后端以 HTTP 状态码为主，前端可按以下规则统一提示：
- 400：请求参数或配置错误（例如未配置密码）
- 401：口令错误或 token 无效
- 404：内容不存在
- 500：服务异常

推荐提示文案：
- 400: 当前文章口令配置异常，请联系站点管理员。
- 401: 口令错误，请重试。
- 404: 文章不存在或已下线。
- 500: 服务暂时不可用，请稍后再试。

---

## 7. 联调步骤（最短路径）
1. 启动后端：npm run develop
2. 在 Postman 里验证 unlock 和 detail 流程
3. Nuxt 接入先实现两条：
   - GET /api/articles/:id
   - POST /api/articles/:id/unlock
4. 确认 locked 切换正常后，再接列表和其余资源

---

## 8. 已知约束与后续优化
1. 当前解锁 token 为后端自定义 HMAC 签名，不是 JWT 标准结构。
2. 当前详情解锁 token 通过 query 传递，后续可升级为 Header（例如 X-Unlock-Token）。
3. 当前 unlock 接口响应中附带 article，可视情况收敛为仅返回 token 与过期时间。
4. 当前错误未细分业务码，后续可扩展为 code + message 统一格式。

---

## 9. 关联文档
- Docs/Strapi内容模型与口令接口操作手册.md
- postman/strapi-blog.postman_collection.json
- postman/strapi-blog.local.postman_environment.json
