---
title: "Core Design — Dynamic Meta-Model Engine"
summary: "Architecture, data flow, database schema, and index design for the unified asset registration system"
read_when:
  - "understanding the architecture and design decisions of the asset registration system"
  - "debugging the data flow from UI to database"
  - "extending the meta-model or adding new asset types"
  - "reviewing database schema, indexes, and query patterns"
scope:
  - assets
  - database
  - frontend
status: "active"
updated: "2026-07-04"
---

# Core Design: Dynamic Meta-Model Engine

## 1. Architecture

```
┌─ Browser ─────────────────────────────────────────────────────┐
│  /dashboard/assets[...]                                       │
└──────────────────────────┬───────────────────────────────────┘
        │ React Query (useSuspenseQuery / useMutation)
        │ ↓ Server Actions ('use server')
        ▼
┌─ Next.js Server ──────────────────────────────────────────────┐
│  features/assets/api/                                         │
│    types.ts   queries.ts   mutations.ts                       │
│    service.ts ← 唯一需替换的数据访问层                          │
│  lib/db.ts ← PostgreSQL 连接池（server-only）                  │
└──────────────────────────┬───────────────────────────────────┘
        │ node-postgres (pg)
        ▼
┌─ PostgreSQL ──────────────────────────────────────────────────┐
│  asset_templates ← JSONB 元模型定义                            │
│  asset_instances ← JSONB 资产实例                              │
│  10 indexes (GIN + B-tree)                                   │
└───────────────────────────────────────────────────────────────┘
```

## 2. Design Principle

传统方案为每种资产类型建单独的表（`server_table`, `db_table`, `service_table`...），
每新增一种资产类型就需要一次 DDL 迁移。

本系统采用**统一的两表结构 + JSONB**，核心思想：

> **模板定义"形状"，实例填充"内容"，AI 消费"能力"**

```
 ┌──────────────┐         ┌──────────────────┐
 │  asset_templates │──────│  asset_instances  │
 │                  │ 1:N  │                   │
 │  schema_def JSONB│      │  attributes JSONB │
 │  state_mapping   │      │  capabilities     │
 │  capabilities    │      │  tags[] (GIN)     │
 └──────────────┘         └──────────────────┘
```

### 为什么是 JSONB？

| 场景 | 固定 Schema | JSONB（本方案） |
|------|------------|-----------------|
| 新增资产类型 | 建表 + 迁移 | 创建一条模板记录 |
| 添加字段 | ALTER TABLE | 改 JSONB 内容 |
| 跨类型查询 | JOIN N 张表 | 一条 SQL + GIN 索引 |
| AI 消费 | 需定制视图 | 统一 capabilities 字段 |

## 3. Database Schema

### `asset_templates`

定义资产类型的"形状"：

```sql
CREATE TABLE asset_templates (
    id              VARCHAR(64) PRIMARY KEY,      -- tmpl-srv-001
    name            VARCHAR(255) NOT NULL,         -- "Quarkus Microservice"
    category        VARCHAR(64) NOT NULL,          -- hardware | software | storage
    description     TEXT NOT NULL DEFAULT '',
    schema_def      JSONB NOT NULL DEFAULT '{}',   -- 动态属性的 JSON Schema
    state_mapping   JSONB NOT NULL DEFAULT '{}',   -- 状态枚举 + 健康判定条件
    capabilities    JSONB NOT NULL DEFAULT '[]',   -- AI 工具定义列表
    tags            TEXT[] NOT NULL DEFAULT '{}',   -- 分类标签
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`schema_def` 示例（Quarkus Microservice 模板）：
```jsonc
{
  "type": "object",
  "properties": {
    "version": { "type": "string", "title": "Runtime Version" },
    "port":    { "type": "number", "title": "Service Port" },
    "apiPrefix": { "type": "string", "title": "API Prefix" },
    "upstreamDeps": { "type": "string", "title": "Upstream Dependencies" }
  },
  "required": ["version", "port"]
}
```

`state_mapping` 示例：
```jsonc
{
  "states": ["BOOTING", "RUNNING", "DEGRADED", "STOPPED"],
  "initialState": "BOOTING",
  "conditions": {
    "RUNNING": "health === \"ok\" && uptime > 30",
    "DEGRADED": "health === \"degraded\"",
    "STOPPED": "health === \"down\""
  }
}
```

`capabilities` 示例：
```jsonc
[
  {
    "name": "health_check",
    "description": "Check service health status",
    "method": "GET",
    "endpoint": "/health",
    "inputSchema": {},
    "outputSchema": { "type": "object", "properties": { "status": { "type": "string" } } }
  }
]
```

### `asset_instances`

具体的资产登记记录：

```sql
CREATE TABLE asset_instances (
    id              VARCHAR(64) PRIMARY KEY,      -- ast-srv-001
    template_id     VARCHAR(64) NOT NULL REFERENCES asset_templates(id),
    name            VARCHAR(255) NOT NULL,         -- "cland-user-service-01"
    description     TEXT NOT NULL DEFAULT '',
    attributes      JSONB NOT NULL DEFAULT '{}',   -- ① 固有属性
    state_mapping   JSONB NOT NULL DEFAULT '{}',   -- ② 状态映射
    current_state   VARCHAR(64) NOT NULL DEFAULT 'UNKNOWN',
    capabilities    JSONB NOT NULL DEFAULT '[]',   -- ③ 语义能力契约
    tags            TEXT[] NOT NULL DEFAULT '{}',   -- 标签（能力检索用）
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

三种资产的三要素示例：

| 资产 | ① attributes | ② current_state | ③ capabilities |
|------|-------------|-----------------|----------------|
| `cland-user-service-01` | `{"port":8080, "version":"Java 21"}` | RUNNING | `health_check`, `list_users`, `metrics` |
| `gpu-node-ai-01` | `{"gpu":"Tesla P40", "cpu":"32c 64t"}` | ONLINE | `power_off`, `reboot`, `gpu_info` |
| `cland-db-primary` | `{"version":16, "maxConnections":200}` | RUNNING | `query`, `pg_stat` |

## 4. Data Flow

### 查询流程（列表页）

```
Server Component (page.tsx)
  → searchParamsCache.parse(searchParams)         // 解析 URL 参数
  → getQueryClient()
  → void queryClient.prefetchQuery(options)       // 预取（fire-and-forget）
  → HydrationBoundary state={dehydrate(...)}      // 序列化到客户端
  → <Suspense fallback={<Skeleton />}>
      ↓
  Client Component (useSuspenseQuery)
  → 从 hydration 缓存读取（首次无网络请求）
  → 缓存过期后自动调用 Server Action
      ↓
  service.ts ('use server')
  → SQL: SELECT ... FROM asset_instances ...
  → PostgreSQL
```

### 变更流程（表单提交）

```
Client Component (AssetForm)
  → useMutation({ ...createAssetMutation, onSuccess: ... })
    → mutationFn(data)
      → service.ts (createAsset)
        → INSERT INTO asset_instances ...
      → onSuccess
        → invalidateQueries({ queryKey: assetKeys.all })
        → toast.success('Asset registered')
        → router.push('/dashboard/assets')
```

## 5. Key Database Indexes

| 索引 | 类型 | 用途 | SQL 用法示例 |
|------|------|------|-------------|
| `idx_asset_instances_tags` | GIN | 标签包含查询 | `'payment' = ANY(tags)` |
| `idx_asset_instances_attrs` | GIN | JSONB 属性路径 | `attributes @> '{"gpu":"Tesla P40"}'` |
| `idx_asset_instances_cap_names` | GIN expr | 能力名称搜索 | `jsonb_path_query_array(capabilities, '$.name')` |
| `idx_asset_instances_state` | B-tree | 状态筛选 | `WHERE current_state = 'RUNNING'` |
| `idx_asset_instances_template` | B-tree | 模板关联 | `WHERE template_id = 'tmpl-srv-001'` |
| `idx_asset_instances_updated` | B-tree DESC | 排序 | `ORDER BY updated_at DESC` |
| `idx_asset_templates_tags` | GIN | 模板标签 | `'database' = ANY(tags)` |
| `idx_asset_templates_category` | B-tree | 分类筛选 | `WHERE category = 'hardware'` |

GIN 表达式索引（能力名称快速检索）：
```sql
CREATE INDEX idx_asset_instances_cap_names
    ON asset_instances
    USING GIN (jsonb_path_query_array(capabilities, '$.name'));
```

此索引使以下跨类型查询无需全表扫描：
```sql
-- 查询所有具备 "payment" 相关能力的资产
SELECT * FROM asset_instances
WHERE 'payment' ILIKE ANY(tags)
   OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(capabilities) AS cap
       WHERE cap->>'name' ILIKE '%payment%'
          OR cap->>'description' ILIKE '%payment%'
   );
```

## 6. Data Access Layer Architecture

```
features/assets/api/
├── types.ts       类型契约（导出形状，组件依赖此文件）
├── service.ts     数据访问层（唯一需对接后端时修改的文件）
├── queries.ts     Query Key Factory + queryOptions
└── mutations.ts   mutationOptions + 自动缓存失效
```

**关键规则：**

- `types.ts` — 组件只从这里 import 类型，不直接依赖 mock API
- `service.ts` — 标注 `'use server'`，直连 PostgreSQL。对接真实后端时**只改这一个文件**
- `queries.ts` — 定义 `templateKeys` / `assetKeys` 工厂 + `queryOptions`，**从不直接调用 API**
- `mutations.ts` — 使用 `mutationOptions` + `getQueryClient()`，**不在组件中定义 invalidation**

**为什么用 `mutationOptions` 而不是自定义 Hook？**

```ts
// ✅ 正确：mutationOptions 可组合、可测试、与组件解耦
export const createAssetMutation = mutationOptions({
  mutationFn: (data) => createAsset(data),
  onSuccess: () => getQueryClient().invalidateQueries({ queryKey: assetKeys.all })
});

// 组件中组合 UI 逻辑：
const mutation = useMutation({
  ...createAssetMutation,
  onSuccess: () => { toast.success('Created'); router.push('/dashboard/assets'); }
});
```

## 7. File Index

| Layer | Path | Purpose |
|-------|------|---------|
| API 类型 | `src/features/assets/api/types.ts` | Type contracts |
| 数据访问 | `src/features/assets/api/service.ts` | Server Actions |
| 查询 | `src/features/assets/api/queries.ts` | React Query options |
| 变更 | `src/features/assets/api/mutations.ts` | Mutation options |
| DB 连接 | `src/lib/db.ts` | PostgreSQL pool (server-only) |
| 组件 | `src/features/assets/components/` | 13 UI components |
| 路由 | `src/app/dashboard/assets/` | 6 page routes |
| 迁移 | `scripts/001-schema-assets.sql` | Schema DDL |
| 预置数据 | `scripts/002-seed-templates-extra.sql` | Extra templates |
| 运行器 | `scripts/migrate.mjs` | Migration runner |
| 详情 | `docs/db.md` | Database design |
