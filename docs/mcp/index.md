# OpenCMDB — Remote MCP Server

## Setup

The MCP server runs as a standalone HTTP server (port 3100) using the MCP Streamable HTTP transport, alongside the Next.js dev server (port 3000).

```bash
# Start both Next.js (:3000) + MCP (:3100) with one command
export DB_HOST=192.168.1.9 DB_PASS=<pass>
npm run dev

# Or separately:
npm run dev:next   # Next.js only (:3000)
npm run dev:mcp    # MCP only (:3100)
npm run mcp        # MCP only (alias)
```

| 服务 | 端口 | 访问 |
|------|------|------|
| Next.js | `:3000` | `http://localhost:3000` — 管理界面 |
| SKILL.md | `:3000` | `http://localhost:3000/SKILL.md` — 项目功能描述 |
| MCP | `:3100` | `http://127.0.0.1:3100/mcp` — AI 工具端点 |

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/session` | GET | Current session ID + initialized state |
| `/reset` | POST | Reset session (recover from stuck state) |
| `/tools` | GET | List all tools (JSON) |
| `/mcp` | POST | MCP JSON-RPC endpoint |
| `/mcp` | GET | SSE stream (for stateful MCP clients) |

## MCP Protocol Flow

**Stateful session:**

```
1. POST /mcp  →  initialize              →  receive Mcp-Session-Id
2. POST /mcp  →  tools/list              →  list 15 tools
3. POST /mcp  →  tools/call              →  execute tool
```

All requests after initialize must carry `Mcp-Session-Id` + `Mcp-Protocol-Version` headers.

> ⚠️ If `"Server already initialized"` error: send `POST /reset` first.

## Editor Integration

### Claude Code (`.mcp.json`)

```json
{
  "mcpServers": {
    "opencmdb": {
      "url": "http://127.0.0.1:3100/mcp",
      "description": "OpenCMDB asset management"
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

Same as above at `.cursor/mcp.json`.

## Available Tools (15)

### Asset Management

#### `get_assets`

List asset instances with optional filters.

**Parameters:**
- `template_id` (string) — filter by template ID (e.g. `tmpl-db-001`)
- `state` (string) — filter by current_state (e.g. `RUNNING`)
- `search` (string) — search in name, description, tags
- `limit` (number) — max results (default 50)

**Returns:** `{ items: AssetInstance[], total_items: number }`

#### `get_asset`

Get a single asset instance by ID.

**Parameters:**
- `id` (string, required) — asset ID

#### `register_asset`

Register a new asset instance. Auto-fills `state_mapping` and `capabilities` from the template.

**Parameters:**
- `template_id` (string, required) — template ID
- `name` (string, required) — asset name
- `attributes` (object, required) — JSON object matching the template's `schema_def`
- `description` (string) — optional description
- `tags` (string[]) — optional tags
- `current_state` (string) — initial state (default `UNKNOWN`)

#### `update_asset`

Update an existing asset. Only provided fields are changed.

**Parameters:**
- `id` (string, required) — asset ID
- `attributes` (object) — new attributes (replaces existing)
- `current_state` (string) — new state
- `tags` (string[]) — new tags
- `description` (string) — new description

#### `delete_asset`

Delete an asset instance by ID.

**Parameters:**
- `id` (string, required) — asset ID

### Template Management

#### `get_templates`

List all asset templates, optionally filtered by category.

**Parameters:**
- `category` (string) — filter: `hardware`, `software`, `storage`

#### `get_template`

Get a single template by ID with full `schema_def`, `state_mapping`, `capabilities`.

**Parameters:**
- `id` (string, required) — template ID

#### `create_template`

Create a new asset template.

**Parameters:**
- `name` (string, required) — template name
- `category` (string, required) — `hardware`, `software`, or `storage`
- `schema` (object, required) — JSON Schema defining valid `attributes` for instances
- `description` (string) — what this asset type does
- `default_state_mapping` (object) — `{ states, initialState, conditions }`
- `default_capabilities` (object[]) — array of capability definitions
- `tags` (string[]) — classification tags

#### `update_template`

Update an existing template. Only provided fields are changed.

**Parameters:**
- `id` (string, required) — template ID
- `name`, `category`, `description`, `schema`, `default_state_mapping`, `default_capabilities`, `tags`

#### `delete_template`

Delete a template by ID.

**Parameters:**
- `id` (string, required) — template ID

### Database Utilities

#### `sql_query`

Execute a read-only SQL query (SELECT / WITH only).

**Parameters:**
- `sql` (string, required) — SELECT or WITH query
- `params` (string[]) — values for `$1`, `$2` placeholders

#### `list_tables`

List all public schema tables with row counts. No parameters.

#### `describe_table`

Show columns, types, indexes for a table.

**Parameters:**
- `table` (string, required) — table name

### Migration

#### `run_migration`

Apply pending SQL migrations (`scripts/nnn-*.sql`). Use `dry_run` to preview.

**Parameters:**
- `seed_only` (boolean) — only seed files
- `schema_only` (boolean) — only schema files
- `dry_run` (boolean) — preview without executing

#### `list_migrations`

List all migration SQL files in order. No parameters.

## Architecture

```
┌─────────────┐     POST /mcp (JSON-RPC)     ┌──────────────────┐
│ AI Assistant │ ──────────────────────────→  │  MCP HTTP Server │
│ (Claude Code │ ←── SSE / JSON Response ──  │  :3100/mcp       │
│  Cursor, SDK)│                              │                  │
└─────────────┘                               │  15 Tools        │
                                              │  ├─ Asset CRUD   │
Database ──→ pg Pool (node-postgres) ←───────│  ├─ Template CRUD│
                                              │  ├─ SQL Query    │
Service ──→ src/features/assets/api/ ←──────│  └─ Migration    │
                                              └──────────────────┘
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `192.168.1.9` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `opencmdb` | Database name |
| `DB_USER` | `opencmdb_rw` | Database user |
| `DB_PASS` | — | Database password |
| `MCP_PORT` | `3100` | MCP server port |
| `MCP_HOST` | `0.0.0.0` | MCP server bind address |

## Implementation Note

MCP is just a protocol layer. All business logic is delegated to the existing service layer at `src/features/assets/api/service.ts`. The MCP server imports and calls the same `getAssets`, `createAsset`, `getTemplates`, `createTemplate` etc. functions used by the Next.js frontend.

The database pool is shared via `src/lib/db-pool.ts`, with `src/lib/db.ts` adding a `server-only` guard for Next.js client bundle protection.
