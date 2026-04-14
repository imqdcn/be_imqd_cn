# Strapi本地插件迁移与升级指南

本文用于指导以下场景：
- 将本地插件从项目A迁移到项目B
- 升级 Strapi 版本后，快速确认插件可用
- 出现“插件已启用但后台无菜单/页面404”时快速排查

适用插件类型：
- 放在 `src/plugins/<plugin-name>` 的本地插件（未上架官方市场）

---

## 1. 当前插件基线（以 markdown-import 为例）

插件目录：
- `src/plugins/markdown-import`

关键入口文件：
- `src/plugins/markdown-import/strapi-admin.js`
- `src/plugins/markdown-import/strapi-server.ts`
- `src/plugins/markdown-import/package.json`

Admin 代码：
- `src/plugins/markdown-import/admin/src/index.ts`
- `src/plugins/markdown-import/admin/src/pages/HomePage.tsx`

Server 代码：
- `src/plugins/markdown-import/server/src/routes/index.ts`
- `src/plugins/markdown-import/server/src/controllers/import-controller.ts`
- `src/plugins/markdown-import/server/src/services/markdown-import.ts`

主项目启用配置：
- `config/plugins.ts`

---

## 2. 迁移到新项目（同 Strapi 主版本）

### 步骤 1：复制插件目录

把整个目录复制到目标项目：
- `src/plugins/markdown-import`

注意不要漏文件，建议整目录复制而不是手动挑文件。

### 步骤 2：在目标项目启用插件

编辑 `config/plugins.ts`，增加：

```ts
import path from 'path';

export default ({ env }) => ({
  'markdown-import': {
    enabled: true,
    resolve: path.resolve(__dirname, '../src/plugins/markdown-import'),
  },
});
```

说明：
- 推荐使用绝对路径 `path.resolve(...)`，跨构建目录更稳定。

### 步骤 3：安装依赖（在项目根目录）

不要在插件目录单独安装依赖。

在项目根目录执行：

```powershell
npm install
```

如果插件新增了第三方库（例如 `gray-matter`），也在项目根目录安装：

```powershell
npm install gray-matter
```

### 步骤 4：启动并验证

```powershell
npm run develop
```

验证点：
1. 后台左侧出现插件菜单
2. 可访问 `/admin/plugins/markdown-import`
3. 插件接口可达（例如 `POST /markdown-import/import`）

---

## 3. Strapi 升级时操作（推荐流程）

### 升级前

1. 建独立升级分支
2. 记录当前可用版本与回归结果
3. 确认插件目录完整、可启动

### 升级后必须检查

1. 本地插件是否仍在 `config/plugins.ts` 启用
2. `strapi-admin.js` 是否存在于插件根目录
3. `strapi-server.ts|js` 是否存在于插件根目录
4. 插件 `package.json` 是否仍包含：

```json
{
  "strapi": {
    "name": "markdown-import",
    "kind": "plugin"
  }
}
```

5. 根目录依赖是否完整（重新 `npm install`）
6. `npm run develop` 是否能正常启动

### 升级后快速回归

1. 打开后台，检查菜单
2. 进入插件页
3. 用最小样例执行一次导入
4. 验证 create/update 行为和导入报告

---

## 4. 高频问题与处理

### 问题 A：插件显示 enabled，但后台没有菜单

优先检查：
1. 插件根目录是否有 `strapi-admin.js`
2. `config/plugins.ts` 的 `resolve` 路径是否正确
3. 是否使用旧缓存页面（浏览器 `Ctrl+F5`）

可选验证：
- 检查 `.strapi/client/app.js` 是否含有插件注入代码。

### 问题 B：访问 `/admin/plugins/markdown-import` 显示 Page not found

检查：
1. Admin 注册是否写在 `admin/src/index.ts`
2. 菜单 `to` 是否为 `/plugins/markdown-import`
3. 开发服务是否是最新进程（必要时重启）

### 问题 C：编译报 TSX/DOM 类型错误

处理：
1. 确认 `tsconfig.json` 含 `"jsx": "react-jsx"`
2. 确认 `compilerOptions.lib` 含 `"DOM"`
3. 修复前端事件类型写法（建议用 `currentTarget`）

---

## 5. 建议的迁移策略（长期）

如果插件会在多个项目重复使用，建议逐步演进：

1. 阶段一：继续本地插件（当前模式）
2. 阶段二：抽成私有 npm 包（统一版本）
3. 阶段三：如需对外分发，再考虑上架官方市场

这样做的收益：
- 迁移时只需“安装包 + 启用配置”
- 升级时可按版本管理插件变更
- 回滚更可控

---

## 6. 升级/迁移完成定义（Done 标准）

满足以下全部条件才算完成：

1. `npm run develop` 启动成功
2. 后台显示插件菜单
3. 插件页面可打开
4. 导入接口可调用
5. create/update 行为正确
6. 导入报告字段完整（总数、成功、失败、动作）

如果其中任一失败，先按“高频问题与处理”排查，再决定是否回滚。
