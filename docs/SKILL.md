---
name: opencmdb-asset-registration
description: |
  OpenCMDB — 动态元模型资产注册与管理平台。基于 Next.js 16 + shadcn/ui + PostgreSQL 16。
  用于管理 IT 资产模板和实例（服务器、微服务、数据库、网关等设备资产）。
  使用 JSONB 动态属性、GIN 索引、状态映射和 AI 能力契约实现"一表多型"。
  当用户提到"资产注册"、"资产管理"、"CMDB"、"资产模板"、"硬件管理"时触发。
description_for_model: |
  This skill provides complete knowledge of the OpenCMDB asset registration platform.
  Use it when the user asks about asset-related features, database schema, or the project's architecture.
  The project uses a dynamic meta-model: asset_templates define the "shape" (JSON Schema, state mapping, capabilities),
  and asset_instances store concrete assets with dynamic JSONB attributes.
  Queries go through PostgreSQL directly (Server Actions + node-postgres), using GIN indexes on JSONB and arrays for performance.
allowed-tools: Bash(node scripts/migrate.mjs), Bash(npm run dev), Bash(npm run build)
---

# OpenCMDB — Asset Registration Platform

OpenCMDB 是一个**动态元模型资产注册平台**。核心思想：用两张表（`asset_templates` + `asset_instances`）+ JSONB 实现任意类型的 IT 资产管理。

---

## 架构总览

```
Human Admin ──→ Asset Templates (元模型定义)
                    │
                    ├── schema_def      JSON Schema（属性形状）
                    ├── state_mapping   状态枚举 + 健康条件
                    └── capabilities    AI 工具契约列表
                    │
Asset Instances (具象实例)
    ├── attributes     JSONB 动态属性（由模板 schema_def 约束）
    ├── current_state  生命周期状态
    ├── capabilities   实际能力
    └── tags           分类标签（GIN 索引）
```

---

## 快速参考

| 任务 | 位置 |
|------|------|
| 资产列表 | `/dashboard/assets` |
| 注册资产 | `/dashboard/assets/new` |
| 编辑资产 / AI 视图 | `/dashboard/assets/[id]` |
| 模板列表 | `/dashboard/assets/templates` |
| 创建模板 | `/dashboard/assets/templates/new` |
| 登录 | `/auth/login` |
| 资产 API 层 | `src/features/assets/api/` |
| 数据库模式 | `scripts/001-schema-assets.sql` |
| 迁移运行器 | `scripts/migrate.mjs` |

---

## 核心领域模型

### 表结构 (`scripts/001-schema-assets.sql`)

**asset_templates** — 定义某类资产的"形状"

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `VARCHAR(64) PK` | `tmpl-srv-001` 格式 |
| `name` | `VARCHAR(255)` | 模板名 |
| `category` | `VARCHAR(64)` | `hardware` / `software` / `storage` |
| `schema_def` | `JSONB` | JSON Schema 定义 attributes 合法形状 |
| `state_mapping` | `JSONB` | 状态枚举 + 健康判定条件 |
| `capabilities` | `JSONB` | AI 工具契约列表 |
| `tags` | `TEXT[]` | 分类标签（GIN 索引） |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | 触发器自动更新 |

**asset_instances** — 具体的资产实例

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `VARCHAR(64) PK` | `ast-srv-001` 格式 |
| `template_id` | `VARCHAR(64) FK` | → `asset_templates(id) ON DELETE RESTRICT` |
| `name` | `VARCHAR(255)` | 实例名 |
| `attributes` | `JSONB` | 由模板 schema_def 约束 |
| `state_mapping` | `JSONB` | 实例级状态映射 |
| `current_state` | `VARCHAR(64)` | 生命周期状态 |
| `capabilities` | `JSONB` | AI 工具契约 |
| `tags` | `TEXT[]` | 分类标签 |

### 预置数据

**5 个内置模板：**

| ID | 名称 | 分类 |
|----|------|------|
| `tmpl-srv-001` | Quarkus Microservice | software |
| `tmpl-hw-001` | GPU Compute Node | hardware |
| `tmpl-db-001` | PostgreSQL Database | storage |
| `tmpl-gw-001` | APISIX Gateway | software |
| `tmpl-vec-001` | Qdrant Vector DB | storage |

### 索引设计

| 索引 | 类型 | 用途 |
|------|------|------|
| `idx_asset_templates_tags_gin` | GIN | 标签数组包含查询 |
| `idx_asset_instances_tags_gin` | GIN | 标签数组包含查询 |
| `idx_asset_instances_attrs_gin` | GIN | JSONB 属性包含查询 (`@>`) |
| `idx_asset_instances_cap_names_gin` | GIN 表达式 | 能力名称快速检索 |
| `idx_asset_instances_updated_desc` | B-tree DESC | 按更新时间排序 |

---

## 数据访问层

### 架构

```
src/features/assets/api/
├── types.ts        ← 类型契约（响应形状、过滤器、负载）
├── service.ts      ← Server Actions + PostgreSQL 直接查询（唯一替换文件）
├── queries.ts      ← React Query 选项 + 键工厂
└── mutations.ts    ← React Query 变更选项 + 缓存失效
```

### 服务函数 (`service.ts`)

| 函数 | 说明 |
|------|------|
| `getTemplates(filters)` | 模板列表（分页、搜索、排序） |
| `getTemplateById(id)` | 单个模板查询 |
| `createTemplate(data)` | 创建新模板 |
| `updateTemplate(id, data)` | 更新模板 |
| `deleteTemplate(id)` | 删除模板 |
| `getAssets(filters)` | 资产实例列表 |
| `getAssetById(id)` | 单个资产查询 |
| `createAsset(data)` | 注册资产 |
| `updateAsset(id, data)` | 更新资产 |
| `deleteAsset(id)` | 删除资产 |
| `queryByCapability(q)` | AI 能力检索 |
| `getAllTags()` | 所有标签列表 |

### 关键查询模式

**能力检索（AI 查询）：**
```sql
SELECT * FROM asset_instances
WHERE $1 ILIKE ANY(tags)
   OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(capabilities) AS cap
       WHERE cap->>'name' ILIKE $1 OR cap->>'description' ILIKE $1
   );
```

**JSONB 路径查询：**
```sql
SELECT * FROM asset_instances WHERE attributes @> '{"gpu": "Tesla P40"}'::jsonb;
```

**标签包含查询：**
```sql
SELECT * FROM asset_instances WHERE 'production' = ANY(tags) AND 'database' = ANY(tags);
```

---

## AI 视图

访问 `?view=ai` 参数或从 Actions 菜单中选择 "AI View" 查看面向 AI 的资产信息。

**剔除的字段：** `id`, `templateId`, `createdAt`, `updatedAt`

**保留的核心信息：** `name`, `description`, `state`, `attributes`, `capabilities`, `tags`

**支持的格式：**
- **Strict YAML**（默认，适合 AI 工具契约场景）
- **Markdown Table**（适合硬件资产列表浏览）

---

## 认证与安全

| 项目 | 说明 |
|------|------|
| 登录 | `POST /api/auth/login` |
| 账号 | `opencmdb` / `opencmdb` |
| 会话 | JWT (HS256) + httpOnly Cookie，24h 过期 |
| 中间件 | `src/proxy.ts` 保护 `/dashboard/*` 和 `/api/*` |
| 数据库角色 | `opencmdb_rw`（读写）、`opencmdb_ro`（只读） |
| 连接池 | `src/lib/db.ts`，受 `server-only` 保护 |

---

## 迁移

```bash
# Node.js 迁移运行器（自动发现所有 nnn-*.sql 并顺序执行）
DB_HOST=<host> DB_PASS=<pass> node scripts/migrate.mjs

# Shell 迁移脚本
DB_PASS=<pass> ./scripts/migrate.sh
DB_PASS=<pass> ./scripts/migrate.sh --seed-only   # 仅种子数据
DB_PASS=<pass> ./scripts/migrate.sh --dry-run     # 预览
```

### 迁移文件

```
scripts/
├── 001-schema-assets.sql       ← 模式 + 3 个基础模板
├── 002-seed-templates-extra.sql ← APISIX + Qdrant 模板
└── migrate.mjs                 ← Node.js 运行器
```

---

## SQL 设计规范（本项目的约定）

参见 `~/.pi/agent/prompts/sql-spec.md`（pi prompt template，在编辑器输入 `/sql-spec` 展开）。

本项目的关键约定：
- **PostgreSQL 16+ 专用**（不兼容 MySQL）
- **复数表名**：`asset_templates`, `asset_instances`
- **物理外键**：`REFERENCES ... ON DELETE RESTRICT`
- **JSONB 列**：`schema_def`, `attributes`, `state_mapping`, `capabilities`
- **GIN 索引名加 `_gin` 后缀**，DESC 索引加 `_desc` 后缀
- **仅 `updated_at` 触发器**，无存储过程
- **参数化查询**：`$1`, `$2` 风格
- **列别名**：`AS "camelCase"` 映射

---

## 开发命令

```bash
npm run dev       # 启动开发服务器（默认 :3000）
npm run build     # 生产构建 + 类型检查
npm run lint      # ESLint 检查
npm run format    # Prettier 格式化
```

---

## 关键文件索引

| 文件 | 说明 |
|------|------|
| `src/features/assets/api/service.ts` | 服务层（修改此处对接真实后端） |
| `src/features/assets/api/types.ts` | 类型契约 |
| `src/features/assets/api/queries.ts` | React Query 选项 |
| `src/features/assets/api/mutations.ts` | 变更 + 缓存失效 |
| `src/lib/db.ts` | PostgreSQL 连接池 |
| `src/lib/auth.ts` | JWT 登录认证 |
| `src/lib/auth-context.tsx` | 前端认证上下文 |
| `scripts/001-schema-assets.sql` | 数据库模式定义 |
| `scripts/migrate.mjs` | 迁移运行器 |
| `docs/db.md` | 数据库设计文档 |
| `docs/feat.md` | 功能总览 |
| `docs/feat01.md` | 功能使用指南 |
| `docs/SKILL.md` | 本文件 — 项目功能描述 |

---

## 导航菜单（RBAC）

`src/config/nav-config.ts` 定义侧边栏菜单项，支持 `requireOrg` / `permission` / `role` / `plan` / `feature` 访问控制。
`src/hooks/use-nav.ts` 使用 Clerk 上下文过滤导航项。
