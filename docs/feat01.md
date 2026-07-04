---
title: "Feature Guide — Asset Registration"
summary: "AI-oriented views, authentication, and step-by-step usage guide for the asset registration system"
read_when:
  - "configuring or troubleshooting login and authentication"
  - "using AI-oriented views and capability-based queries"
  - "registering new assets or creating asset type templates through the UI"
  - "understanding how AI consumes asset data"
scope:
  - assets
  - auth
  - frontend
status: "active"
updated: "2026-07-04"
---

# Feature Guide: Asset Registration

## 1. Authentication

### Login

| Item | Value |
|------|-------|
| URL | `http://<host>:3002/auth/login` |
| API | `POST /api/auth/login` |
| Username | `opencmdb` |
| Password | `opencmdb` |

### How It Works

```
Login Page                    Server                        Browser
   │                           │                             │
   ├── POST username/password ─→                             │
   │                           ├── validateCredentials()     │
   │                           ├── createSession(JWT)        │
   │                           ├── set cookie: session=JWT   │
   │←── { success, user } ────┘                             │
   │                           │                             │
   ├── /dashboard/assets ─────→                              │
   │                           ├── middleware: jwtVerify()   │
   │                           ├── cookie valid → allow      │
   │←── 200 (page) ───────────┘                              │
```

### Session Management

| Property | Value |
|----------|-------|
| Token | JWT (HS256) |
| Expiry | 24 hours |
| Cookie | `session` (httpOnly, sameSite=lax) |
| Middleware | `src/proxy.ts` — protects `/dashboard/*`, `/api/*` |

### Logout

```http
POST /api/auth/logout
→ Deletes session cookie
→ User redirected to /auth/login
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | JWT sign/verify, cookie helpers, `requireAuth()` guard |
| `src/lib/auth-context.tsx` | React context: `useAuth()` → `{ user, logout, loading }` |
| `src/app/api/auth/login/route.ts` | Login API handler |
| `src/app/api/auth/logout/route.ts` | Logout API handler |
| `src/app/api/auth/me/route.ts` | Current user query |
| `src/app/auth/login/page.tsx` | Login page UI |
| `src/proxy.ts` | Auth middleware |

---

## 2. AI-Oriented Views

### Capability-Based Query

AI 不需要知道有哪些"服务器"或"微服务"，直接按能力检索：

```sql
-- 查询所有具备 "payment" 能力的资产
SELECT id, name, template_id, current_state, tags
FROM asset_instances
WHERE 'payment' ILIKE ANY(tags)
   OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(capabilities) AS cap
       WHERE cap->>'name' ILIKE '%payment%'
          OR cap->>'description' ILIKE '%payment%'
   );
```

前端 API：
```ts
const results = await queryByCapability('payment');
// → [cland-user-service-01, cland-payment-service-01, ...]
```

### Token Minimizer

访问 `?view=ai` 时，系统自动剔除对 AI 决策无用的冗余字段：

**剔除的字段：**
- `id`, `templateId`（内部标识符）
- `createdAt`, `updatedAt`（审计时间戳）

**保留的核心信息：**
- `name`, `description` — 资产标识
- `state` — 当前健康状态
- `attributes` — 类型相关的业务属性
- `capabilities` — AI 可调用的工具（最关键）
- `tags` — 分类标记

### Format Transformer

同一份资产数据，API 支持双格式渲染：

**Strict YAML**（默认，适合 AI 工具契约场景）：
```yaml
asset:
  name: "gpu-node-ai-01"
  type: "tmpl-hw-001"
  description: "Primary AI training node with Tesla P40"
  state: ONLINE
  tags: [hardware, gpu, compute, nvidia, ai-training]
  attributes:
    cpu: "32c 64t"
    ram: "256GB DDR5"
    gpu: "Tesla P40"
    gpuCount: 4
    ipmiAddr: "10.0.100.50"
    location: "DC1-Rack12-U24"
  capabilities:
    - name: "power_off"
      description: "Gracefully power off the node"
      input:
        type: object
        properties:
          force:
            type: boolean
    - name: "gpu_info"
      description: "Query GPU utilization and memory"
      method: GET
      endpoint: "/nvidia-smi"
```

**Markdown Table**（适合硬件资产列表浏览）：
```markdown
# Asset: gpu-node-ai-01
| Property | Value |
|----------|-------|
| **Type** | `tmpl-hw-001` |
| **Description** | Primary AI training node with Tesla P40 |
| **State** | ONLINE |
| **Tags** | hardware, gpu, compute, nvidia, ai-training |

### Attributes
| Key | Value |
|-----|-------|
| **cpu** | `32c 64t` |
| **ram** | `256GB DDR5` |
| **gpu** | `Tesla P40` |
| **location** | `DC1-Rack12-U24` |

### Capabilities
| Name | Description | Method | Endpoint |
|------|-------------|--------|----------|
| `power_off` | Gracefully power off the node | - | - |
| `gpu_info` | Query GPU utilization and memory | GET | /nvidia-smi |
```

### Access AI View

```
/dashboard/assets/ast-srv-001?view=ai
```

或在资产详情页的 "Actions" 下拉菜单中选择 "AI View"。

### Key Files

| File | Purpose |
|------|---------|
| `src/features/assets/api/service.ts` | `queryByCapability()` Server Action |
| `src/features/assets/components/ai-view.tsx` | AI view rendering component |

---

## 3. Usage Guide

### Creating a New Asset Type Template

```
Templates → New Template
```

1. **Basic Info**: 填写名称、选择分类（Hardware / Software / Storage）
2. **Description**: 描述该类资产的用途
3. **Tags**: 逗号分隔的标签（用于分类检索）
4. **Attributes Schema (JSON)**: 定义该类资产的属性形状
   ```json
   {
     "type": "object",
     "properties": {
       "cpu": { "type": "string", "title": "CPU Spec" },
       "gpu": { "type": "string", "title": "GPU Model" }
     },
     "required": ["cpu", "gpu"]
   }
   ```
5. **State Mapping (JSON)**: 定义状态枚举和健康判定条件
6. **Capabilities (JSON)**: 定义该类资产的默认 AI 工具

### Registering an Asset

```
Assets → Register Asset
```

表单分为四个区块：

| Block | Content | Auto-fill |
|-------|---------|-----------|
| **① Basic Info** | 名称、选择模板、描述、标签 | — |
| **② Attributes** | 按模板 Schema 填入 JSON | 模板 Schema 预览 |
| **③ State Mapping** | 状态枚举 + 初始状态 + 条件 | 模板默认值 |
| **④ Capabilities** | AI 工具定义列表 | 模板默认能力 |

### Editing an Asset

在资产列表页的 Actions 菜单中选择 "Edit"，或直接点击资产名进入详情页。

### AI View

在 Actions 菜单中选择 "AI View"，或在 URL 后加 `?view=ai`。

支持切换 **YAML** / **Markdown** 格式，点击 "Copy" 一键复制。

---

## 4. Route Map

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard/assets` | `page.tsx` | 资产实例列表（DataTable） |
| `/dashboard/assets/new` | `new/page.tsx` | 注册新资产 |
| `/dashboard/assets/[id]` | `[assetId]/page.tsx` | 编辑 / AI 视图 |
| `/dashboard/assets/templates` | `templates/page.tsx` | 模板列表 |
| `/dashboard/assets/templates/new` | `templates/new/page.tsx` | 创建模板 |
| `/dashboard/assets/templates/[id]` | `templates/[templateId]/page.tsx` | 编辑模板 |
| `/auth/login` | `auth/login/page.tsx` | 登录页 |

---

## 5. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.7 (strict) |
| UI | shadcn/ui + Tailwind CSS v4 |
| State | TanStack Query v5 + Zustand |
| Form | TanStack Form + Zod |
| Data | PostgreSQL 16 + node-postgres |
| Auth | JWT (jose) + httpOnly cookies |
| AI Format | YAML / Markdown dual output |
