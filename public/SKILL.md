---
name: opencmdb-asset-registration
description: |
  OpenCMDB — 动态元模型资产注册与管理平台。
  通过远程 MCP 服务器（端口 3100）提供资产注册、模板管理、数据库迁移、只读查询等 AI 工具。
  当用户提到"资产注册"、"资产管理"、"CMDB"、"资产模板"、"注册 xxx 资产"、"MCP 连接"、
  "数据库迁移"、"查看资产"、"AI 视图"时触发。
description_for_model: |
  OpenCMDB is a dynamic meta-model asset registration and management platform.
  It exposes a remote MCP server (Streamable HTTP, port 3100) with 26 tools:
  Domain CRUD (get_domains, get_domain, domain_ai_view, create_domain, update_domain, delete_domain),
  Service CRUD (get_services, get_service, service_ai_view, create_service, update_service, delete_service, bind_asset_to_service, set_root_binding, add_link, add_links, remove_links),
  Asset CRUD (get_assets, get_asset, register_asset, update_asset, delete_asset),
  Template CRUD (get_templates, get_template, create_template, update_template, delete_template),
  SQL query (sql_query, list_tables, describe_table).

  MCP endpoint: http://192.168.1.14:3100/mcp
  Web UI:       http://192.168.1.14:3000

  Session management is stateful. If a session is stuck (e.g. "Server already initialized"),
  send POST /reset to clear the session, then re-initialize.

  Data model has three layers:
    Domain (Layer 1) — business boundary with topology graph
    Service (Layer 2) — bounded context wrapping assets with semantic meaning
    Asset (Layer 3) — concrete resource instance linked to a template

  Key tables:
    domains             — business domain boundaries
    services            — bounded contexts within domains
    service_links       — sync/async relationships between services
    service_asset_bindings — many-to-many links between services and assets
    asset_templates     — defines asset types (PostgreSQL Database, GPU Node, etc.)
                         with JSONB schema_def, state_mapping, capabilities
    asset_instances     — concrete assets linked to a template, with JSONB attributes
---

# OpenCMDB — MCP Server & Project Functions

## Architecture

```
AI Assistant ─── MCP (Streamable HTTP) ───→ OpenCMDB MCP Server (:3100)
                                                    │
                                                    ↓
                                               PostgreSQL (opencmdb)
                                               ├── domains
                                               ├── services
                                               ├── service_links
                                               ├── asset_templates
                                               ├── asset_instances
                                               └── service_asset_bindings
```

## Three-Layer Hierarchy

OpenCMDB models infrastructure in three abstraction layers:

| Layer | Concept | Example | Role |
|-------|---------|---------|------|
| 1 | **Domain** (Business Boundary) | C-Land Base Domain | Macro business slice that groups services by capability. Contains complete topology graph (sync/async service relationships). |
| 2 | **Service** (Bounded Context) | cland-user-service | Wraps assets with semantic meaning (roles, responsibilities). Provides the semantic abstraction layer that reduces AI token consumption. |
| 3 | **Asset** (Concrete Resource) | cland-db-primary | Registered infrastructure instance (DB, GPU, gateway, etc.) with JSONB attributes defined by its template. |

```
Domain (Layer 1)
  └── Service (Layer 2) — bounded context
        └── Asset (Layer 3) — concrete resource instance
```

A **Domain** owns a topology graph (`topology_data` JSONB) that describes how its services connect via sync (REST/gRPC), async command (message), or async event relationships.

A **Service** lives under one domain, can be bound to multiple assets via `service_asset_bindings`, and has semantic roles describing its responsibilities.

An **Asset** is linked to exactly one template, which defines its valid attribute schema, lifecycle states, and capabilities.

## MCP Connection

**Endpoint:** `http://192.168.1.14:3100/mcp`

| Client | Config |
|--------|--------|
| Claude Code | `.mcp.json` → `"url": "http://192.168.1.14:3100/mcp"` |
| Cursor | `.cursor/mcp.json` — same |
| MCP SDK | `new StreamableHTTPClientTransport("http://192.168.1.14:3100/mcp")` |

**Protocol (Stateful):**

```
1. POST /mcp  →  initialize              →  receive Mcp-Session-Id
2. POST /mcp  →  tools/list              →  list tools
3. POST /mcp  →  tools/call              →  execute tool
```

All subsequent requests require `Mcp-Session-Id` + `Mcp-Protocol-Version` headers.

> ⚠️ If `"Server already initialized"` error: send `POST /reset` first.

## HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/session` | GET | Current session ID + initialized state |
| `/reset` | POST | Reset session (recover from stuck state) |
| `/tools` | GET | List all tools (JSON) |
| `/mcp` | POST | MCP JSON-RPC |

## MCP Tools (26 tools)

### Domain Management

| Tool | Parameters | Description |
|------|-----------|-------------|
| `get_domains` | `search`, `tag`, `limit` | List business domains |
| `get_domain` | `id` | Get single domain by ID |
| `domain_ai_view` | `id` | Get AI-optimized YAML summary of a domain |
| `create_domain` | `name`, `description`, `tags`, `topology_data`, `sort_order` | Create new domain |
| `update_domain` | `id`, `name`, `description`, `tags`, `topology_data`, `sort_order` | Update domain |
| `delete_domain` | `id` | Delete domain |

### Service Management

| Tool | Parameters | Description |
|------|-----------|-------------|
| `get_services` | `search`, `domain_id`, `tag`, `limit` | List services (bounded contexts) |
| `get_service` | `id` | Get single service by ID |
| `service_ai_view` | `id` | Get AI-optimized YAML summary of a service |
| `create_service` | `name`, `domain_id`, `description`, `tags`, `semantic_roles`, `sort_order` | Create new service |
| `update_service` | `id`, `name`, `description`, `domain_id`, `tags`, `semantic_roles`, `sort_order` | Update service |
| `delete_service` | `id` | Delete service |
| `bind_asset_to_service` | `service_id`, `asset_id`, `binding_type`, `semantic_role` | Bind asset to a service |
| `set_root_binding` | `service_id`, `asset_id` | Set an asset as root/primary for a service |
| `add_link` | `domain_id`, `source_svc_id`, `target_svc_id`, `link_type`, `label` | Add topology link between services |
| `add_links` | `links` (array of link objects) | Batch add multiple topology links at once |
| `remove_links` | `domain_id`, `link_ids` (array) | Remove one or more topology links by ID |

### Asset Management

| Tool | Parameters | Description |
|------|-----------|-------------|
| `get_assets` | `template_id`, `state`, `search`, `limit` | List asset instances |
| `get_asset` | `id` | Get single asset by ID |
| `register_asset` | `template_id`, `name`, `attributes`, `tags` | Register new asset |
| `update_asset` | `id`, `attributes`, `current_state`, `tags` | Update existing asset |
| `delete_asset` | `id` | Delete asset |

### Template Management

| Tool | Parameters | Description |
|------|-----------|-------------|
| `get_templates` | `category` | List templates |
| `get_template` | `id` | Get single template |
| `create_template` | `name`, `category`, `schema`, `tags` | Create new template |
| `update_template` | `id`, `name`, `category`, `schema` | Update template |
| `delete_template` | `id` | Delete template |

### Database Utilities

| Tool | Parameters | Description |
|------|-----------|-------------|
| `sql_query` | `sql` (SELECT/WITH), `params` | Read-only SQL queries |
| `list_tables` | — | List all tables |
| `describe_table` | `table` | Columns, types, indexes |

## Database Schema

### `asset_templates` — 5 built-in templates

| ID | Name | Category |
|----|------|----------|
| `tmpl-srv-001` | Quarkus Microservice | software |
| `tmpl-hw-001` | GPU Compute Node | hardware |
| `tmpl-db-001` | PostgreSQL Database | storage |
| `tmpl-gw-001` | APISIX Gateway | software |
| `tmpl-vec-001` | Qdrant Vector DB | storage |

Each template defines:
- `schema_def` (JSONB) — JSON Schema for valid attributes
- `state_mapping` (JSONB) — lifecycle state definitions
- `capabilities` (JSONB) — AI tool contracts

### `asset_instances` — concrete assets

Key columns: `id`, `template_id` (FK), `name`, `description`, `attributes` (JSONB), `current_state`, `tags` (TEXT[]), `capabilities` (JSONB)

### Seed data

| ID | Name | Template | State |
|----|------|----------|-------|
| `ast-srv-001` | cland-user-service-01 | Quarkus Microservice | RUNNING |
| `ast-hw-001` | gpu-node-ai-01 | GPU Compute Node | ONLINE |
| `ast-db-001` | cland-db-primary | PostgreSQL Database | RUNNING |

## Related Docs

| Doc | URL |
|-----|-----|
| MCP tools & protocol | `docs/mcp/index.md` |
| Database schema | `docs/db.md` |
| API / frontend routes | `docs/endpoint.md` |
| AI views & capability queries | `docs/feat01.md` |

## Login

**URL:** `http://192.168.1.14:3000/auth/login`
**Credentials:** `opencmdb` / `opencmdb`

---

## Examples

### 1. Initialize Session

```bash
curl -s --noproxy "*" -X POST http://192.168.1.14:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "my-agent", "version": "1.0.0" }
    },
    "id": 1
  }'
```

→ Response header: `Mcp-Session-Id: ea00d16f-...` (save this for subsequent calls)

### 2. Recover from Stuck Session

If initialize returns `"Server already initialized"`:

```bash
curl -s -X POST http://192.168.1.14:3100/reset
```

Then retry initialize.

### 3. List All Tools

```bash
SESSION_ID="your-saved-session-id"

curl -s --noproxy "*" -X POST http://192.168.1.14:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
  -H "Mcp-Protocol-Version: 2025-03-26" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }'
```

### 4. List Templates

```bash
curl -s --noproxy "*" -X POST http://192.168.1.14:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
  -H "Mcp-Protocol-Version: 2025-03-26" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_templates",
      "arguments": {}
    },
    "id": 3
  }'
```

### 5. Register a New Asset

```bash
curl -s --noproxy "*" -X POST http://192.168.1.14:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
  -H "Mcp-Protocol-Version: 2025-03-26" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "register_asset",
      "arguments": {
        "template_id": "tmpl-db-001",
        "name": "cland_base_dict",
        "attributes": {
          "version": "16",
          "host": "192.168.1.9",
          "port": 5432,
          "rw_user": "opencmdb_rw",
          "ro_user": "opencmdb_ro",
          "connectionString": "jdbc:postgresql://192.168.1.9:5432/cland_base_dict"
        },
        "tags": ["database", "postgresql", "production"],
        "description": "基础字典库"
      }
    },
    "id": 4
  }'
```

### 6. Query Registered Assets

```bash
curl -s --noproxy "*" -X POST http://192.168.1.14:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
  -H "Mcp-Protocol-Version: 2025-03-26" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_assets",
      "arguments": {
        "search": "cland"
      }
    },
    "id": 5
  }'
```

### 7. Describe a Table

```bash
curl -s --noproxy "*" -X POST http://192.168.1.14:3100/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
  -H "Mcp-Protocol-Version: 2025-03-26" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "describe_table",
      "arguments": { "table": "asset_instances" }
    },
    "id": 6
  }'
```
