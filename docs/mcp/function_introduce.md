---
title: "OpenCMDB Function Introduction"
summary: "High-level overview of OpenCMDB's key functions and capabilities"
scope:
  - assets
  - templates
  - mcp
---

# OpenCMDB — Function Introduction

## What is OpenCMDB?

OpenCMDB is a **dynamic meta-model Configuration Management Database (CMDB)** for IT infrastructure. It allows you to define arbitrary asset types and register concrete instances — all without creating new database tables.

## Two-Layer Architecture

```
┌──────────────────────────────────────────────────┐
│                   Asset Templates                │
│  Define "what kind of asset"                      │
│                                                   │
│  • PostgreSQL Database    • GPU Compute Node     │
│  • Quarkus Microservice   • APISIX Gateway       │
│  • Qdrant Vector DB                              │
├──────────────────────────────────────────────────┤
│                   Asset Instances                │
│  Register "which specific asset"                  │
│                                                   │
│  • cland-db-primary        • gpu-node-ai-01      │
│  • cland-user-service-01                         │
└──────────────────────────────────────────────────┘
```

### Templates Layer

Templates define the **schema**, **state machine**, and **capabilities** for each asset type:

| Component | Description |
|-----------|-------------|
| `schema_def` (JSON Schema) | Validates asset `attributes` — what fields are allowed/required |
| `state_mapping` | Lifecycle states + health conditions (e.g. BOOTING → RUNNING → STOPPED) |
| `capabilities` | AI tool contracts this asset type provides |

5 built-in templates:

| ID | Name | Category |
|----|------|----------|
| `tmpl-srv-001` | Quarkus Microservice | software |
| `tmpl-hw-001` | GPU Compute Node | hardware |
| `tmpl-db-001` | PostgreSQL Database | storage |
| `tmpl-gw-001` | APISIX Gateway | software |
| `tmpl-vec-001` | Qdrant Vector DB | storage |

### Instances Layer

Each asset instance is a concrete entity linked to a template:

| Column | Description |
|--------|-------------|
| `id` | Unique identifier (e.g. `ast-db-001`) |
| `template_id` | FK → `asset_templates.id` |
| `name` | Human-readable name |
| `attributes` (JSONB) | Dynamic properties validated against template's `schema_def` |
| `current_state` | Current lifecycle state (e.g. RUNNING, DOWN) |
| `capabilities` (JSONB) | Actual AI tools available on this instance |
| `tags` (TEXT[]) | Classification labels (GIN-indexed) |

## Key Functions

### 1. Asset Lifecycle Management

```
Register → Update attributes → Change state → Delete
```

- Register new assets with type-specific attributes
- Update state, attributes, tags, or description at any time
- Delete assets when decommissioned

### 2. Template Management

```
Create → Define schema → Set state mapping → Deploy
```

- Create new asset types via JSON Schema
- Define lifecycle states and health conditions
- Set AI capability contracts per asset type
- 5 built-in templates ready to use

### 3. Capability-Based Search

Find assets by what they **do**, not what they **are**:

```
Search by tag:         'payment' = ANY(tags)
Search by capability:  cap->>'name' ILIKE '%payment%'
```

This enables AI agents to discover assets that can perform a specific function.

### 4. AI-Oriented Views

Asset detail pages support a `?view=ai` mode that strips internal IDs and timestamps, showing only:
- `name`, `description`
- `state` (current health)
- `attributes` (business properties)
- `capabilities` (what an AI can call)
- `tags` (classification)

Output is available in **YAML** or **Markdown table** format.

## Access Patterns

| Method | Access | Description |
|--------|--------|-------------|
| Web UI | `http://192.168.1.14:3000` | Browser-based management |
| MCP API | `http://192.168.1.14:3100/mcp` | AI agent tools (15 tools) |
| Direct SQL | PostgreSQL `opencmdb` database | Advanced queries |

## Database

Two core tables in PostgreSQL (hosted at `192.168.1.9:5432`):

| Table | Rows | Description |
|-------|------|-------------|
| `asset_templates` | 5 | Asset type definitions |
| `asset_instances` | 0+ | Concrete asset records |

## Related Documents

| Doc | Location | Content |
|-----|----------|---------|
| MCP Server Reference | `docs/mcp/index.md` | Full MCP tool documentation |
| DB Schema | `docs/db.md` | Database schema, indexes, queries |
| Endpoint Reference | `docs/endpoint.md` | API routes, frontend routes |
| AI Views | `docs/feat01.md` | Capability queries, AI-oriented views |
