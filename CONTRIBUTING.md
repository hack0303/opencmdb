# Contributing to OpenCMDB

感谢您考虑为 OpenCMDB 做出贡献！本文档提供了参与开发的指南和约定。

## 目录

- [开发环境](#开发环境)
- [项目结构](#项目结构)
- [开发工作流](#开发工作流)
- [提交规范](#提交规范)
- [代码风格](#代码风格)
- [隐私与安全](#隐私与安全)
- [PR 流程](#pr-流程)

---

## 开发环境

### 前置要求

| 工具 | 版本要求 | 安装 |
|------|---------|------|
| Node.js | >= 20 | [nodejs.org](https://nodejs.org) |
| npm | >= 10 | 随 Node.js 安装 |
| PostgreSQL | >= 16 | [postgresql.org](https://postgresql.org) |

### 快速开始

```bash
# 1. 克隆仓库
git clone git@github.com:hack0303/opencmdb.git
cd opencmdb

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入数据库连接信息

# 4. 初始化数据库
node scripts/migrate.mjs

# 5. 启动开发服务器
npm run dev
```

开发服务器默认运行在 `http://localhost:3000`。登录凭据：`opencmdb` / `opencmdb`。

### 可用脚本

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建 + TypeScript 检查
npm run start        # 启动生产服务器
npm run lint         # ESLint + oxlint 检查
npm run lint:fix     # 自动修复 + 格式化
npm run format       # Prettier 格式化
```

---

## 项目结构

```
src/
├── app/                    # Next.js App Router 路由
│   ├── api/               # API 路由（BFF 模式）
│   ├── auth/              # 认证页面
│   └── dashboard/         # 仪表盘页面
│       └── assets/        # ← 资产登记功能
├── components/
│   ├── ui/                # shadcn/ui 组件（不改）
│   └── layout/            # 布局组件
├── features/              # 功能模块
│   ├── assets/            # ← 资产核心功能
│   │   └── api/           # types → service → queries → mutations
│   └── ...
├── lib/                   # 工具库
├── config/                # 配置
├── hooks/                 # 自定义 Hooks
├── constants/             # Mock 数据和常量
└── styles/                # 全局样式和主题

scripts/                   # 数据库迁移脚本
docs/                      # 项目文档
```

新增功能时，遵循 `src/features/<name>/` 的模块化结构。

---

## 开发工作流

### 1. 分支策略

```bash
main          # 生产分支，只接受 PR
├── feat/*    # 新功能分支
├── fix/*     # 修复分支
└── docs/*    # 文档分支
```

### 2. 功能开发步骤

1. **阅读文档** — 先看 `docs/` 和 `AGENTS.md` 了解架构约定
2. **创建功能模块** —
   ```
   src/features/<name>/
   ├── api/
   │   ├── types.ts       # 类型契约
   │   ├── service.ts     # 数据访问层（唯一对接后端的文件）
   │   ├── queries.ts     # Query Key Factory + queryOptions
   │   └── mutations.ts   # mutationOptions + 缓存失效
   ├── components/        # UI 组件
   └── schemas/           # Zod 校验 Schema
   ```
3. **创建页面路由** — `src/app/dashboard/<name>/page.tsx`
4. **注册导航** — 在 `src/config/nav-config.ts` 中添加菜单项
5. **添加图标** — 在 `src/components/icons.tsx` 中注册新图标

### 3. 数据库变更

- 创建新的 SQL 迁移文件：`scripts/<version>-description.sql`
- 迁移必须是可逆的（提供 `DROP` / `ALTER ... DROP` 回滚）
- 运行迁移：`node scripts/migrate.mjs`

### 4. 提交前检查

```bash
npm run build        # 通过构建（零 TypeScript 错误）
npm run lint         # 无 ESLint 错误
git status           # 确认无意外文件
```

---

## 提交规范

### 提交信息格式

```
<type>: <简短描述>

<可选的详细说明>
```

### 类型

| 类型 | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: add GPU asset type template` |
| `fix` | 修复 | `fix: remove hardcoded credentials before push` |
| `refactor` | 重构 | `refactor: extract shared query builder` |
| `docs` | 文档 | `docs: update database schema documentation` |
| `chore` | 工程 | `chore: upgrade next.js to 16.2` |
| `style` | 格式 | `style: format with prettier` |
| `test` | 测试 | `test: add unit tests for auth utils` |

### 示例

```
feat: implement asset registration form with three data blocks

- Attributes block with JSON editor
- State mapping block with template default preview
- Capabilities block with template capability inheritance
```

---

## 代码风格

### TypeScript

- **严格模式** — 避免 `any`，优先使用 `interface` 而非 `type`
- **显式返回类型** — 公共函数必须标注返回类型
- **导入别名** — 使用 `@/*` 别名（如 `@/features/assets/api/types`）

### React / Next.js

- **服务端组件优先** — 只在需要浏览器 API 或 React hooks 时才加 `'use client'`
- **函数声明** — `function ComponentName() {}` 而非箭头函数
- **PageContainer** — 页面使用 `pageTitle` / `pageDescription` / `pageHeaderAction` 属性，不直接使用 `<Heading>`

### 样式

- 使用 `cn()` 工具函数合并 className，不手动拼接字符串
- Tailwind CSS v4 语法（`@import 'tailwindcss'`）

### 图标

- **永不直接 import** `@tabler/icons-react`
- 所有图标注册在 `src/components/icons.tsx`，通过 `Icons.keyName` 使用

### 数据层

- 组件永不直接 import mock API（`@/constants/mock-api*`）
- 三层调用链：`types.ts` → `service.ts` → `queries.ts`

### 表单

- 使用 `useAppForm` + `useFormFields<T>()`
- 不把 `useState` 放在 `AppField` render props 内

---

## 隐私与安全

### 禁止提交的内容

- ⛔ `.env.local`、`.env.*.local` 等环境变量文件
- ⛔ 数据库密码、API Key、JWT Secret 等敏感信息
- ⛔ 内网 IP 地址（`192.168.x.x`、`10.x.x.x`）
- ⛔ 个人邮箱地址

### 提交前扫描

```bash
# 检查 IP 地址
grep -rnP '(\d{1,3}\.){3}\d{1,3}' src/ --include='*.ts' --include='*.tsx'

# 检查潜在密钥
grep -rn 'password\|secret\|api_key\|token' src/ --include='*.ts' --include='*.tsx' \
  | grep -v 'import\|process.env\|placeholder\|change_me'

# 检查环境文件是否被跟踪
git ls-files --cached .env .env.local .env.*.local
```

### 配置文件

- 敏感配置通过 `.env.local`（已 gitignore）注入
- 模板文件使用 `.env.example`（占位符内容）

---

## PR 流程

### 提交 PR

1. 确保所有提交前检查通过
2. 填写 PR 模板（包含变更摘要、测试步骤、隐私检查确认）
3. 添加相关 `docs/` 更新
4. 请求 Code Review

### PR 标题格式

```
[<scope>] <type>: <描述>
```

示例：
- `[assets] feat: add GPU asset type template`
- `[auth] fix: redirect to login on session expiry`
- `[docs] docs: update database schema documentation`

### PR 检查清单

- [ ] `npm run build` 通过
- [ ] `npm run lint` 通过
- [ ] 无隐私泄漏（IP/密码/环境变量）
- [ ] `.env.local` 未被提交
- [ ] 数据库迁移可回滚
- [ ] 新增功能有对应文档更新
- [ ] 代码遵循项目风格约定

---

## 获取帮助

- 阅读 `docs/` 目录下的项目文档
- 阅读 `AGENTS.md` 了解 AI Agent 的编码约定
- 查看 `docs/db.md` 了解数据库设计
- 查看 `docs/feat.md` 了解功能架构
