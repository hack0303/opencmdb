<h1 align="center">OpenCMDB</h1>

<div align="center">Unified asset management system with dynamic meta-model — for humans and AI</div>

<br />

<div align="center">
  <a href="https://github.com/hack0303/opencmdb"><strong>GitHub</strong></a> ·
  <a href="./docs/feat.md"><strong>Documentation</strong></a> ·
  <a href="./CONTRIBUTING.md"><strong>Contributing</strong></a>
</div>

<br />

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/shadcn/ui-latest-black" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
</p>

---

## Overview

OpenCMDB 是一个面向 **人和 AI** 的统一资产管理系统。核心创新在于**动态元模型（Dynamic Meta-Model）** 设计——不 同类型的资产（服务器、微服务、数据库、网关）不再需要各自建表，而是通过统一的 JSONB 模型实现"一处定义，到处继承"。

### 设计理念

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  人类管理员    │────→│  资产类型模板      │────→│   AI 代理   │
│  (定义规范)    │     │  (元模型)         │     │  (消费能力)  │
│              │     │                  │     │             │
│  模板定义:    │     │  schema_def JSONB │     │  能力检索    │
│  Quarkus     │     │  state_mapping    │     │  跨类型查询  │
│  GPU 节点    │     │  capabilities     │     │  Token 瘦身  │
│  PostgreSQL  │     │                  │     │             │
│  APISIX      │     │  实例填充:        │     │  YAML/表格  │
│  Qdrant      │     │  attributes       │     │  格式转译    │
│              │     │  current_state    │     │             │
└──────────────┘     └──────────────────┘     └─────────────┘
```

### 关键特性

- **动态元模型** — JSONB 存储任意资产属性，无需 DDL 迁移
- **三要素登记** — 固有属性 + 状态映射 + 语义能力契约
- **AI 原生** — 能力检索、Token 瘦身、YAML/Markdown 双格式输出
- **认证** — 内置 JWT 登录，无外部依赖
- **全栈** — Next.js 16 + PostgreSQL + TanStack Query

---

## Pre-built Data

### 5 Asset Type Templates

| ID | Name | Category |
|----|------|----------|
| `tmpl-srv-001` | Quarkus Microservice | `software` |
| `tmpl-hw-001` | GPU Compute Node | `hardware` |
| `tmpl-db-001` | PostgreSQL Database | `storage` |
| `tmpl-gw-001` | APISIX Gateway | `software` |
| `tmpl-vec-001` | Qdrant Vector DB | `storage` |

### 3 Sample Instances

| ID | Name | Template | State |
|----|------|----------|-------|
| `ast-srv-001` | cland-user-service-01 | Quarkus Microservice | RUNNING |
| `ast-hw-001` | gpu-node-ai-01 | GPU Compute Node | ONLINE |
| `ast-db-001` | cland-db-primary | PostgreSQL Database | RUNNING |

---

## Quick Start

### Prerequisites

- Node.js >= 20
- PostgreSQL >= 16 (running, with database initialized)

### Setup

```bash
# 1. Clone
git clone git@github.com:hack0303/opencmdb.git
cd opencmdb

# 2. Install
npm install

# 3. Configure
cp .env.example .env.local
# Edit .env.local: set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS

# 4. Initialize database
node scripts/migrate.mjs

# 5. Start dev server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** and login with:

| Username | Password |
|----------|----------|
| `opencmdb` | `opencmdb` |

---

## Routes

| Route | Description |
|-------|-------------|
| `/auth/login` | Login page |
| `/dashboard/assets` | **Asset instances** — register, search, filter |
| `/dashboard/assets/new` | **Register new asset** — three-block form |
| `/dashboard/assets/[id]` | Edit asset details |
| `/dashboard/assets/[id]?view=ai` | **AI view** — YAML / Markdown |
| `/dashboard/assets/templates` | **Asset type templates** — define meta-models |
| `/dashboard/assets/templates/new` | Create new template |
| `/dashboard/assets/templates/[id]` | Edit template |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | [TypeScript 5.7](https://www.typescriptlang.org) (strict) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| Data Fetching | [TanStack Query v5](https://tanstack.com/query) |
| Forms | [TanStack Form](https://tanstack.com/form) + [Zod](https://zod.dev) |
| Tables | [TanStack Table](https://tanstack.com/table) |
| Database | [PostgreSQL 16](https://postgresql.org) + [node-postgres](https://node-postgres.com) |
| Auth | JWT ([jose](https://github.com/panva/jose)) + httpOnly cookies |
| Charts | [Recharts](https://recharts.org) |

---

## Project Structure

```
src/
├── app/
│   ├── api/auth/          # Auth API (login/logout/me)
│   ├── auth/login/        # Login page
│   └── dashboard/assets/  # ← Asset management pages (6 routes)
├── features/
│   └── assets/            # ← Core feature module
│       ├── api/           # types → service → queries → mutations
│       └── components/    # UI components (13 files)
├── lib/                   # auth.ts, db.ts, auth-context.tsx
├── config/                # nav-config.ts
└── components/            # Shared UI components

scripts/                   # Database migrations
docs/                      # Documentation
  ├── db.md                # Database design
  ├── feat.md              # Feature overview
  ├── feat/core.md         # Core design
  └── feat01.md            # Feature guide
```

---

## Documentation

| Document | Content |
|----------|---------|
| [docs/feat.md](./docs/feat.md) | Feature overview and quick reference |
| [docs/feat/core.md](./docs/feat/core.md) | Architecture, meta-model, data flow, indexes |
| [docs/feat01.md](./docs/feat01.md) | Auth, AI views, usage guide |
| [docs/db.md](./docs/db.md) | Database schema and query patterns |
| [AGENTS.md](./AGENTS.md) | AI agent coding conventions |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development guide and PR workflow |

---

## License

[MIT](./LICENSE)

*Built on [next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) — original README at [docs/README.origin.md](./docs/README.origin.md)*
