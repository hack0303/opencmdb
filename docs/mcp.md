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
| `/tools` | GET | List all available tools (JSON) |
| `/mcp` | POST | MCP JSON-RPC endpoint |
| `/mcp` | GET | SSE stream (for stateful MCP clients) |

## Editor Integration

### Claude Code (`.mcp.json`)

```json
{
  "mcpServers": {
    "opencmdb": {
      "url": "http://127.0.0.1:3100/mcp",
      "description": "OpenCMDB asset management — migration, DB query, build/lint"
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

Same as above at `.cursor/mcp.json`.

## Available Tools

### `run_migration`

Apply all pending SQL migrations in order.

**Parameters:**
- `seed_only` (boolean) — only run seed data files
- `schema_only` (boolean) — only run schema files
- `dry_run` (boolean) — preview without executing

### `query_database`

Execute a read-only SQL query.

**Parameters:**
- `sql` (string, required) — SELECT or WITH query
- `params` (string[]) — values for `$1`, `$2` placeholders

### `list_tables`

List all public schema tables with row counts. No parameters.

### `describe_table`

Show columns, types, indexes for a table.

**Parameters:**
- `table` (string, required) — table name

### `run_dev_server`

Start the Next.js dev server in the background. No parameters.

### `build_project`

Run `npm run build`. No parameters.

### `lint_project`

Run `npm run lint` (oxlint). No parameters.

### `read_migration_file`

Read a migration SQL file.

**Parameters:**
- `file` (string, required) — e.g. `001-schema-assets.sql`

### `list_migration_files`

List all migration SQL files in order. No parameters.

## Architecture

```
┌─────────────┐     POST /mcp (JSON-RPC)     ┌──────────────────┐
│ AI Assistant │ ──────────────────────────→  │  MCP HTTP Server │
│ (Claude Code │ ←── SSE / JSON Response ──  │  :3100/mcp       │
│  Cursor, etc)│                              │                  │
└─────────────┘                               │  Tools:          │
                                              │  ├─ run_migration│
Database ──→ pg (node-postgres) ←─────────────│  ├─ query_db     │
                                              │  ├─ list_tables  │
Project ──→ execSync / spawn ←───────────────│  ├─ build/lint   │
                                              │  └─ read files   │
                                              └──────────────────┘
```

## Connection String

The server reads database credentials from environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `192.168.1.9` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `opencmdb` | Database name |
| `DB_USER` | `opencmdb_rw` | Database user |
| `DB_PASS` | — | Database password |
| `MCP_PORT` | `3100` | MCP server port |
| `MCP_HOST` | `0.0.0.0` | MCP server bind address |
