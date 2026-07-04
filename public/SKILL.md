---
name: opencmdb-asset-registration
description: |
  OpenCMDB — 动态元模型资产注册与管理平台。基于 Next.js 16 + shadcn/ui + PostgreSQL 16。
  管理 IT 资产模板和实例（服务器、微服务、数据库、网关等设备资产）。
  支持 JSONB 动态属性、状态映射和 AI 能力契约，实现"一表多型"。
  当用户提到"资产注册"、"资产管理"、"CMDB"、"资产模板"、"硬件管理"时触发。
description_for_model: |
  This skill describes the OpenCMDB asset registration platform.
  Use it when the user asks about asset features, navigation, or project setup.
  The project is a CMDB (Configuration Management Database) with dynamic meta-model:
  templates define asset types, instances hold concrete assets.
  Features: asset CRUD, template management, AI-oriented asset views,
  capability-based asset query, YAML/Markdown format export.
allowed-tools: Bash(npm run dev), Bash(npm run build), Bash(npm run lint)
---

# OpenCMDB — Asset Registration Platform

OpenCMDB is a **Configuration Management Database (CMDB)** for IT infrastructure assets.
It uses a dynamic meta-model: define asset types once as templates, then register any number of asset instances.

---

## What You Can Do

### Asset Management
| Feature | How |
|---------|-----|
| **List all assets** | `/dashboard/assets` — sortable, filterable data table |
| **Register a new asset** | `/dashboard/assets/new` — multi-block form (basic info → attributes → state → capabilities) |
| **Edit an asset** | Click asset name in list, or Actions → Edit |
| **Delete an asset** | Actions → Delete (confirmation dialog) |
| **AI-oriented view** | Actions → "AI View" or append `?view=ai` — shows YAML / Markdown format |

### Template Management
| Feature | How |
|---------|-----|
| **List templates** | `/dashboard/assets/templates` |
| **Create template** | `/dashboard/assets/templates/new` — define JSON Schema, state mapping, capabilities |
| **Edit template** | Click template in list |

### Built-in Asset Types (5 templates)

| Template | Category | Example Instance |
|----------|----------|-----------------|
| Quarkus Microservice | software | `cland-user-service-01` |
| GPU Compute Node | hardware | `gpu-node-ai-01` |
| PostgreSQL Database | storage | `cland-db-primary` |
| APISIX Gateway | software | _add your own_ |
| Qdrant Vector DB | storage | _add your own_ |

---

## Authentication

| Item | Value |
|------|-------|
| Login URL | `/auth/login` |
| Username | `opencmdb` |
| Password | `opencmdb` |
| Session | JWT + httpOnly cookie, 24h expiry |
| Protection | All `/dashboard/*` and `/api/*` routes require login |

---

## Getting Started

```bash
# 1. Install
npm install

# 2. Set up database
cp .env.example.txt .env.local  # edit DB_HOST, DB_PASS
node scripts/migrate.mjs        # creates tables + seed data

# 3. Start dev (both Next.js + MCP server)
npm run dev

# Open http://localhost:3000 (or next available port)
# Login: opencmdb / opencmdb
```

---

## Architecture Overview

```
User (Browser)          Next.js App              PostgreSQL
     │                      │                       │
     ├── /dashboard/assets ─→  Server Component      │
     │                       ├── prefetch data ──────→│
     │                       │←── JSONB rows ────────│
     │←── HTML with data ────┘                       │
     │                                                │
     ├── /dashboard/assets/new                         │
     │   → Client form                                │
     │   → Server Action ────────────────────────────→│
     │   → redirect to list ←────────────────────────│
```

**Key files:**

| Layer | File | Purpose |
|-------|------|---------|
| UI | `src/app/dashboard/assets/` | Page routes and layouts |
| Feature | `src/features/assets/` | Components, forms, tables |
| API types | `src/features/assets/api/types.ts` | Data contracts |
| Service | `src/features/assets/api/service.ts` | **Swap this for your backend** |
| Queries | `src/features/assets/api/queries.ts` | React Query options + key factories |
| Mutations | `src/features/assets/api/mutations.ts` | Mutations + cache invalidation |
| Auth | `src/lib/auth.ts` | JWT utilities |
| Middleware | `src/proxy.ts` | Route protection |
| DB connection | `src/lib/db.ts` | PostgreSQL pool |

---

## AI Capabilities

Assets carry **capability contracts** — tool definitions that AI agents can use:

```yaml
capabilities:
  - name: health_check
    description: Check service health status
    method: GET
    endpoint: /health
  - name: gpu_info
    description: Query GPU utilization and memory
    method: GET
    endpoint: /nvidia-smi
```

The **AI View** (`?view=ai`) strips internal IDs and timestamps, leaving:
`name`, `description`, `state`, `attributes`, `capabilities`, `tags`

Format: YAML (default) or Markdown table — toggle in the UI.

**Capability-based query** — search assets by what they can do, not what they are:
```
/dashboard/assets?view=ai&q=payment
```
Returns all assets tagged with "payment" or having payment-related capabilities.

---

## Project Structure

```
src/
├── app/dashboard/assets/    # Asset pages (list/create/edit/templates)
├── app/api/auth/            # Auth API (login/logout/me)
├── app/auth/login/          # Login page
├── features/assets/         # Asset feature module
├── components/ui/           # shadcn UI components
├── lib/                     # DB, auth, utils
└── styles/                  # CSS + themes
scripts/
├── 001-schema-assets.sql    # Database schema
├── 002-seed-templates-extra.sql
└── migrate.mjs              # Migration runner
```

---

## Development Commands

```bash
npm run dev        # Next.js (:3000) + MCP (:3100)
npm run dev:next   # Next.js only
npm run dev:mcp    # MCP server only
npm run build      # Production build
npm run lint       # Lint
node scripts/migrate.mjs   # Database migration
```

---

## Documents

| Doc | Path | Content |
|-----|------|---------|
| This file | `/SKILL.md` | Project function overview |
| MCP reference | `/mcp.md` | MCP server tools |
| Endpoint reference | `docs/endpoint.md` | All API + frontend routes |
| Auth system | `docs/auth.md` | Login, JWT, middleware |
| Database design | `docs/db.md` | Schema, indexes, queries |
| Feature guide | `docs/feat01.md` | AI views, capability query |
| Architecture | `docs/feat/core.md` | Core design, meta-model |
