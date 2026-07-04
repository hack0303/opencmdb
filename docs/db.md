---
title: "Database Design — OpenCMDB Asset Meta-Model"
summary: "PostgreSQL schema, indexes, and data access patterns for the dynamic meta-model asset registration system"
read_when:
  - "understanding the database schema for asset templates and instances"
  - "debugging or optimizing asset-related SQL queries"
  - "adding new asset types or extending the meta-model"
  - "setting up the database for a new environment"
scope:
  - database
  - assets
status: "active"
updated: "2026-07-04"
---

# Database Design

## Overview

The database uses a **dynamic meta-model** approach — instead of creating separate tables for each asset type (servers, databases, services), we store **all asset types** in two unified tables with JSONB for flexible, schema-less data.

### Design Principles

1. **One schema, all types** — `asset_templates` defines *what* each asset type looks like (its JSON Schema). `asset_instances` stores the actual assets with their dynamic attributes.
2. **JSONB for flexibility** — type-specific attributes, state mappings, and capabilities are stored as JSONB, supporting arbitrary shapes without DDL changes.
3. **GIN indexes for performance** — tags arrays, JSONB attributes, and capability names are indexed for efficient cross-type queries.
4. **Server-only access** — the `pg` module is protected by `server-only` so it never leaks to the client bundle.

---

## Table: `asset_templates`

Defines the "shape" of an asset type. Each row describes a category of asset (e.g., "Quarkus Microservice", "GPU Compute Node").

| Column | Type | Description |
|--------|------|-------------|
| `id` | `VARCHAR(64) PK` | Unique template ID, e.g. `tmpl-srv-001` |
| `name` | `VARCHAR(255) NOT NULL` | Human-readable name, e.g. "Quarkus Microservice" |
| `category` | `VARCHAR(64) NOT NULL` | One of `hardware`, `software`, `storage` |
| `description` | `TEXT` | Free-text description |
| `schema_def` | `JSONB` | JSON Schema defining valid `attributes` for instances of this type |
| `state_mapping` | `JSONB` | Default state enumeration + health conditions |
| `capabilities` | `JSONB` | Default AI tool definitions this asset type provides |
| `tags` | `TEXT[]` | Classification tags (GIN-indexed) |
| `created_at` | `TIMESTAMPTZ` | Auto-set on insert |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated by trigger |

### Indexes

| Index | Type | Purpose |
|-------|------|---------|
| `asset_templates_pkey` | B-tree | Primary key |
| `idx_asset_templates_tags` | **GIN** | Array containment queries (`WHERE 'service' = ANY(tags)`) |
| `idx_asset_templates_category` | B-tree | Filter by category |

### `schema_def` Structure

The JSON Schema stored here defines what `attributes` are valid for instances of this template:

```jsonc
{
  "type": "object",
  "properties": {
    "version": {
      "type": "string",
      "title": "Runtime Version",
      "description": "e.g. Java 21, Java 25"
    },
    "port": {
      "type": "number",
      "title": "Service Port",
      "description": "HTTP listen port"
    },
    // ... more fields
  },
  "required": ["version", "port"]
}
```

### `state_mapping` Structure

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

### `capabilities` Structure

```jsonc
[
  {
    "name": "health_check",
    "description": "Check service health status",
    "method": "GET",
    "endpoint": "/health",
    "inputSchema": {},
    "outputSchema": {
      "type": "object",
      "properties": {
        "status": { "type": "string" }
      }
    }
  }
]
```

---

## Table: `asset_instances`

Each row is a concrete asset instance (e.g., `cland-user-service-01`), linked to a template.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `VARCHAR(64) PK` | Unique instance ID, e.g. `ast-srv-001` |
| `template_id` | `VARCHAR(64) FK` | References `asset_templates.id` (RESTRICT on delete) |
| `name` | `VARCHAR(255) NOT NULL` | Instance name, e.g. "cland-user-service-01" |
| `description` | `TEXT` | Free-text description |
| `attributes` | `JSONB` | Dynamic key-value pairs shaped by template's `schema_def` |
| `state_mapping` | `JSONB` | Per-instance state mapping (usually copied from template) |
| `current_state` | `VARCHAR(64)` | Current lifecycle state, e.g. "RUNNING" |
| `capabilities` | `JSONB` | Actual tool definitions available on this instance |
| `tags` | `TEXT[]` | Classification tags (GIN-indexed) |
| `created_at` | `TIMESTAMPTZ` | Auto-set on insert |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated by trigger |

### Indexes

| Index | Type | Purpose |
|-------|------|---------|
| `asset_instances_pkey` | B-tree | Primary key |
| `idx_asset_instances_template` | B-tree | Filter by `template_id` |
| `idx_asset_instances_state` | B-tree | Filter by `current_state` |
| `idx_asset_instances_tags` | **GIN** | Array containment: `WHERE 'payment' = ANY(tags)` |
| `idx_asset_instances_attrs` | **GIN** | JSONB path queries: `WHERE attributes @> '{"gpu": "Tesla P40"}'` |
| `idx_asset_instances_cap_names` | **GIN expression** | Capability search: extracts all `$.name` values from JSONB array for fast lookups |
| `idx_asset_instances_updated` | B-tree DESC | Sort by `updated_at` |

### `attributes` Example (GPU Node)

```jsonc
{
  "cpu": "32c 64t",
  "ram": "256GB DDR5",
  "gpu": "Tesla P40",
  "gpuCount": 4,
  "ipmiAddr": "10.0.100.50",
  "location": "DC1-Rack12-U24"
}
```

### `attributes` Example (Microservice)

```jsonc
{
  "version": "Java 21",
  "port": 8080,
  "apiPrefix": "/api/v1/users",
  "upstreamDeps": "cland-db-primary, cland-redis-cache"
}
```

---

## Queries: Key Patterns

### Capability-Based Search (AI Query)

Find all assets that provide a specific capability:

```sql
SELECT * FROM asset_instances
WHERE
  'payment' ILIKE ANY(tags)
  OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(capabilities) AS cap
    WHERE cap->>'name' ILIKE '%payment%'
       OR cap->>'description' ILIKE '%payment%'
  );
```

Powered by `idx_asset_instances_cap_names` (GIN expression index on `jsonb_path_query_array(capabilities, '$.name')`).

### Attribute Path Query (Filter by dynamic property)

```sql
SELECT * FROM asset_instances
WHERE attributes @> '{"gpu": "Tesla P40"}'::jsonb;
```

Powered by `idx_asset_instances_attrs` (GIN index on `attributes`).

### Tag Query

```sql
SELECT * FROM asset_instances
WHERE 'production' = ANY(tags)
  AND 'database' = ANY(tags);
```

Powered by `idx_asset_instances_tags` (GIN index on `tags[]`).

---

## Data Access Layer

The application accesses the database through:

1. **`src/lib/db.ts`** — Connection pool (node-postgres `Pool`), exports `query()` and `queryOne()` helpers. Protected by `import 'server-only'` to prevent client bundle leakage.
2. **`src/features/assets/api/service.ts`** — Server Actions (`'use server'`) implementing all CRUD + query operations. This is the ONE file to modify if switching to a different backend.
3. **`src/features/assets/api/queries.ts`** — React Query options (client-side), calls server actions via `queryFn`.
4. **`src/features/assets/api/mutations.ts`** — React Query mutation options with cache invalidation.

### Service Functions

| Function | Description | Used By |
|----------|-------------|---------|
| `getTemplates(filters)` | List templates (paginated, searchable, sortable) | Template listing page |
| `getTemplateById(id)` | Get single template | Template edit page |
| `createTemplate(data)` | Create new template | Template creation form |
| `updateTemplate(id, data)` | Update template | Template edit form |
| `deleteTemplate(id)` | Delete template | Template management |
| `getAssets(filters)` | List asset instances (paginated, searchable, filterable by state/tag) | Asset listing page |
| `getAssetById(id)` | Get single asset instance | Asset detail/edit page |
| `createAsset(data)` | Register new asset | Asset registration form |
| `updateAsset(id, data)` | Update asset | Asset edit form |
| `deleteAsset(id)` | Delete asset | Asset management |
| `queryByCapability(q)` | Search assets by capability name/tag | AI capability query |
| `getAllTags()` | Get unique tags from all instances | Tag autocomplete |

---

## Migrations

Located in `scripts/`:

| File | Description |
|------|-------------|
| `001-schema-assets.sql` | Creates tables, indexes, triggers, seed data (3 built-in templates) |
| `002-seed-templates-extra.sql` | Adds 2 more templates (APISIX Gateway, Qdrant Vector DB) |

Run via:

```bash
node scripts/migrate.mjs
```

Or with `psql` directly:

```bash
PGPASSWORD=<password> psql -h 192.168.1.9 -U opencmdb_rw -d opencmdb -f scripts/001-schema-assets.sql
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `192.168.1.9` | Database hostname |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `opencmdb` | Database name |
| `DB_USER` | `opencmdb_rw` | Database user (read-write) |
| `DB_PASS` | *(required)* | Database password |

---

## Roles & Permissions

| Role | Username | Access |
|------|----------|--------|
| **Read-Write** | `opencmdb_rw` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` on all tables |
| **Read-Only** | `opencmdb_ro` | `SELECT` only (for monitoring, analytics, read replicas) |
