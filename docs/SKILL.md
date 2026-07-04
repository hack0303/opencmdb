---
name: opencmdb-asset-registration
description: |
  OpenCMDB — 动态元模型资产注册与管理平台。
  管理 IT 资产模板和实例（服务器、微服务、数据库、网关等）。
  当用户提到"资产注册"、"资产管理"、"CMDB"、"资产模板"、"硬件管理"时触发。
description_for_model: |
  This skill describes how to use the OpenCMDB asset registration platform.
  Use it when the user asks how to manage assets, create templates,
  register instances, use AI views, or navigate the platform.
  This project has a remote MCP server on port 3100 with tools for
  database migration, read-only SQL queries, schema inspection,
  build/lint, and migration file management.
  MCP endpoint: http://127.0.0.1:3100/mcp
allowed-tools: Bash(npm run dev), Bash(npm run build)
---

# How to Use OpenCMDB

OpenCMDB is a **Configuration Management Database (CMDB)** for IT infrastructure.
It works in two layers:

1. **Templates** — define "what kind of asset" (e.g. "GPU Compute Node", "PostgreSQL Database")
2. **Instances** — register specific assets (e.g. "gpu-node-ai-01", "cland-db-primary")

---

## Quick Start

```bash
# Start the platform
npm run dev

# Open browser
# http://localhost:3000

# Login
Username: opencmdb
Password: opencmdb
```

After login, you'll see the **Assets** list page.

---

## Login

| Field | Value |
|-------|-------|
| URL | `/auth/login` |
| Username | `opencmdb` |
| Password | `opencmdb` |

---

## Managing Assets

### View All Assets

Navigate to **Assets** in the sidebar (or `/dashboard/assets`).

The table shows all registered assets with:
- Name, type (template), current state, tags
- **Search** — type to filter by name/description/tags
- **Sort** — click column headers
- **Filter** — by state or template type

### Register a New Asset

1. Click **"Register Asset"** button (top-right)
2. Fill in the form across 4 sections:

| Section | What to fill |
|---------|-------------|
| **① Basic Info** | Name, select a template, description, tags |
| **② Attributes** | Properties defined by the template (e.g. CPU, GPU, RAM) |
| **③ State Mapping** | States and health conditions (pre-filled from template) |
| **④ Capabilities** | AI tools this asset provides (pre-filled from template) |

3. Click **Create** — the new asset appears in the list

### Edit an Asset

1. Click the asset name in the list, OR
2. Find the row → Actions → **Edit**

### Delete an Asset

1. Find the row → Actions → **Delete**
2. Confirm in the dialog

### View AI-Oriented Asset Info

For an asset detail page:

1. Actions → **"AI View"**, OR
2. Append `?view=ai` to the URL

The AI view removes internal IDs and timestamps, showing only:
- `name`, `description` — what it is
- `state` — current health
- `attributes` — business properties
- `capabilities` — what an AI can call
- `tags` — classification

**Switch format** between **YAML** (default) and **Markdown table** — then click **Copy**.

---

## Managing Templates

Templates define asset types. The platform comes with 5 built-in templates:

| Template | Category | Used For |
|----------|----------|----------|
| Quarkus Microservice | software | Java REST services |
| GPU Compute Node | hardware | NVIDIA GPU servers |
| PostgreSQL Database | storage | Relational databases |
| APISIX Gateway | software | API gateway instances |
| Qdrant Vector DB | storage | Vector databases |

### Create a New Template

1. Go to **Templates** → **New Template**
2. Fill in:

| Field | What to enter |
|-------|-------------|
| Name | e.g. "Redis Cache Cluster" |
| Category | `hardware` / `software` / `storage` |
| Description | What this asset type does |
| Tags | Comma-separated, e.g. `cache, redis, database` |
| Attributes Schema (JSON) | Define the JSON Schema for asset attributes |
| State Mapping (JSON) | Define states + health conditions |
| Capabilities (JSON) | Define AI tool contracts |

### Edit a Template

1. Go to **Templates** → click a template name
2. Modify fields → **Save**

---

## Built-in Demo Data

After running migrations, the system contains:

**5 Templates** — Quarkus Microservice, GPU Compute Node, PostgreSQL Database, APISIX Gateway, Qdrant Vector DB

**3 Instance Examples:**

| Name | Type | State |
|------|------|-------|
| `cland-user-service-01` | Quarkus Microservice | RUNNING |
| `gpu-node-ai-01` | GPU Node | ONLINE |
| `cland-db-primary` | PostgreSQL | RUNNING |

Use these as reference for registering your own assets.

---

## Capability Search (AI Query)

Find assets by what they **do**, not what they **are**:

```
/dashboard/assets?view=ai&q=payment
```

This returns all assets tagged "payment" or with payment-related capabilities.

---

## Tips

| Task | How |
|------|-----|
| Find a specific asset | Use the search bar in the assets table |
| See all templates at once | Go to Templates page |
| Quick-register similar assets | Clone an existing asset and edit |
| Export asset info for AI | Use AI View → Copy |
| Clean up test data | Actions → Delete on any instance |

---

## Key Pages

| Page | URL | What you can do |
|------|-----|----------------|
| Asset List | `/dashboard/assets` | View, search, sort, filter all assets |
| Register Asset | `/dashboard/assets/new` | Add a new asset |
| Asset Detail | `/dashboard/assets/[id]` | Edit or AI View |
| Template List | `/dashboard/assets/templates` | View, edit templates |
| New Template | `/dashboard/assets/templates/new` | Define a new asset type |
| Login | `/auth/login` | Sign in |

---

---

## MCP Server (AI Tools)

OpenCMDB provides a remote MCP server for AI assistants. It runs on port `:3100`
(started automatically with `npm run dev` via concurrently).

### Connection

| Client | Config |
|--------|--------|
| Claude Code | `.mcp.json`: `"url": "http://127.0.0.1:3100/mcp"` |
| Cursor | `.cursor/mcp.json`: same as above |
| Any MCP client | `http://127.0.0.1:3100/mcp` |

### Available Tools

| Tool | What it does |
|------|-------------|
| `run_migration` | Apply pending SQL migrations (`seed_only`, `schema_only`, `dry_run`) |
| `query_database` | Execute read-only SQL queries (SELECT / WITH) |
| `list_tables` | Show all tables with row counts |
| `describe_table` | Show columns, types, indexes for a table |
| `run_dev_server` | Start Next.js dev server in background |
| `build_project` | Run `npm run build` |
| `lint_project` | Run `npm run lint` |
| `read_migration_file` | Read a migration `.sql` file |
| `list_migration_files` | List all migration files in order |

### Protocol Flow (Stateful)

```
1. POST /mcp  →  initialize          →  receive Mcp-Session-Id header
2. POST /mcp  →  tools/list          →  list all 9 tools
3. POST /mcp  →  tools/call          →  execute a tool
```

All subsequent requests include `Mcp-Session-Id` header from step 1.

### Quick Test

```bash
# Health check
curl http://127.0.0.1:3100/health

# Tool list
curl http://127.0.0.1:3100/tools
```

### MCP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/tools` | GET | List all tools (JSON) |
| `/mcp` | POST | MCP JSON-RPC endpoint |

See `docs/mcp/index.md` for full documentation.

---

## Documents

| Doc | Content |
|-----|---------|
| `/SKILL.md` | This file — how to use the platform |
| `docs/mcp/index.md` | MCP server tools & protocol |
| `docs/auth.md` | Authentication system reference |
| `docs/endpoint.md` | All API and frontend routes |
| `docs/feat01.md` | AI views and capability queries |
