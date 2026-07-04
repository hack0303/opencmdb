---
title: "OpenCMDB — Endpoint Reference"
summary: "Complete API endpoint, frontend route, MCP tool, and static file reference"
read_when:
  - "finding which API endpoint to call"
  - "understanding authentication requirements for a route"
  - "debugging API request/response issues"
  - "adding new routes or API endpoints"
scope:
  - api
  - frontend
  - mcp
status: "active"
updated: "2026-07-04"
---

# Endpoint Reference

## Architecture

```
                          ┌─────────────────────┐
                          │  Next.js :3000       │
Clients ──── HTTP ───────→│  ├── Frontend Pages  │
                          │  ├── API Routes      │
                          │  └── Static Files    │
                          └─────────────────────┘

                          ┌─────────────────────┐
AI Assistants ── MCP ────→│  MCP Server :3100   │
                          │  └── MCP Tools       │
                          └─────────────────────┘
```

---

## 1. Authentication

All API routes (except `/api/auth/login`) require JWT session cookie. The middleware at `src/proxy.ts`:
- Protects `/dashboard/*` — redirects to `/auth/login` if unauthenticated
- Protects `/api/*` — returns `401 { error: "Unauthorized" }` if unauthenticated
- Allows `/auth/login`, `/api/auth/login` as public

### `POST /api/auth/login`

Login with username/password. Sets `session` httpOnly cookie.

**Request:**
```json
{ "username": "opencmdb", "password": "opencmdb" }
```

**Response (200):**
```json
{
  "success": true,
  "user": { "username": "opencmdb", "name": "opencmdb", "email": "admin@opencmdb.local" }
}
```

**Response (400):**
```json
{ "error": "Username and password are required" }
```

**Response (401):**
```json
{ "error": "Invalid username or password" }
```

| Property | Value |
|----------|-------|
| Auth | No (public) |
| Cookie | `session` (httpOnly, sameSite=lax, 24h) |
| JWT Secret | `AUTH_SECRET` env var (default: `change-me-in-production`) |

### `POST /api/auth/logout`

Clear session cookie.

**Response (200):**
```json
{ "success": true }
```

| Property | Value |
|----------|-------|
| Auth | Yes (cookie) |

### `GET /api/auth/me`

Get current authenticated user.

**Response (200):**
```json
{
  "username": "opencmdb",
  "name": "opencmdb",
  "email": "admin@opencmdb.local"
}
```

**Response (401):**
```json
{ "error": "Unauthorized" }
```

| Property | Value |
|----------|-------|
| Auth | Yes (cookie) |

---

## 2. API Routes (Mock / BFF)

### `GET /api/products`

List products with pagination, search, and sort.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |
| `search` | string | — | Search term |
| `categories` | string | — | Filter by category |
| `sort` | string | — | Sort definition (JSON) |

**Response (200):**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Product Name",
      "category": "Category",
      "price": 29.99,
      "status": "Published",
      "created_at": "2026-01-15T08:00:00.000Z",
      "updated_at": "2026-01-15T08:00:00.000Z"
    }
  ],
  "total_items": 42
}
```

### `POST /api/products`

Create a new product.

**Request:**
```json
{
  "name": "New Product",
  "category": "Electronics",
  "price": 99.99,
  "status": "Draft"
}
```

**Response (201):** Created product object.

### `GET /api/products/[id]`

Get product by ID.

**Response (200):** Product object. **Response (404):** `{ "error": "Not found" }`

### `PUT /api/products/[id]`

Update product by ID.

**Request:** Partial product fields. **Response (200):** Updated product.

### `DELETE /api/products/[id]`

Delete product by ID.

**Response (200):** `{ "success": true }`

### `GET /api/users`

List users with pagination, search, role filter, and sort.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |
| `search` | string | — | Search by name/email |
| `role` | string | — | Filter by role |
| `sort` | string | — | Sort definition (JSON) |

**Response (200):**
```json
{
  "items": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "Admin",
      "status": "Active",
      "created_at": "2026-01-15T08:00:00.000Z",
      "updated_at": "2026-01-15T08:00:00.000Z"
    }
  ],
  "total_items": 10
}
```

### `POST /api/users`

Create user. **Request:** `{ name, email, role, status, gender }` **Response (201)**

### `GET /api/users/[id]`

Get user by ID. **Response (200):** User object. **Response (404)**

### `PUT /api/users/[id]`

Update user by ID. **Response (200):** Updated user.

### `DELETE /api/users/[id]`

Delete user by ID. **Response (200):** `{ "success": true }`

---

## 3. Frontend Routes

### Auth

| Route | Page Component | Auth | Description |
|-------|---------------|------|-------------|
| `/auth/login` | `auth/login/page.tsx` | No | Username/password login form |
| `/auth/sign-in` | `auth/sign-in/[[...sign-in]]/page.tsx` | No | Clerk sign-in (legacy) |
| `/auth/sign-up` | `auth/sign-up/[[...sign-up]]/page.tsx` | No | Clerk sign-up (legacy) |

### Dashboard — Assets (Core Feature)

| Route | Page Component | Auth | Description |
|-------|---------------|------|-------------|
| `/dashboard/assets` | `dashboard/assets/page.tsx` | Yes | Asset instance list (DataTable) |
| `/dashboard/assets/new` | `dashboard/assets/new/page.tsx` | Yes | Register new asset (multi-block form) |
| `/dashboard/assets/[assetId]` | `dashboard/assets/[assetId]/page.tsx` | Yes | Edit asset / AI View (`?view=ai`) |
| `/dashboard/assets/templates` | `dashboard/assets/templates/page.tsx` | Yes | Template list |
| `/dashboard/assets/templates/new` | `dashboard/assets/templates/new/page.tsx` | Yes | Create new template |
| `/dashboard/assets/templates/[templateId]` | `dashboard/assets/templates/[templateId]/page.tsx` | Yes | Edit template |

### Dashboard — Other

| Route | Page Component | Description |
|-------|---------------|-------------|
| `/dashboard/overview` | Parallel routes (`@area_stats`, `@bar_stats`, `@pie_stats`, `@sales`) | Analytics charts |
| `/dashboard/product` | `dashboard/product/page.tsx` | Product list |
| `/dashboard/product/[productId]` | `dashboard/product/[productId]/page.tsx` | Product detail/edit |
| `/dashboard/users` | `dashboard/users/page.tsx` | User management |
| `/dashboard/kanban` | `dashboard/kanban/page.tsx` | Kanban task board |
| `/dashboard/chat` | `dashboard/chat/page.tsx` | Messaging UI |
| `/dashboard/notifications` | `dashboard/notifications/page.tsx` | Notification center |
| `/dashboard/forms` | `dashboard/forms/page.tsx` | Form showcase |
| `/dashboard/forms/basic` | `dashboard/forms/basic/page.tsx` | Basic form example |
| `/dashboard/forms/advanced` | `dashboard/forms/advanced/page.tsx` | Advanced form patterns |
| `/dashboard/forms/multi-step` | `dashboard/forms/multi-step/page.tsx` | Multi-step form |
| `/dashboard/forms/sheet-form` | `dashboard/forms/sheet-form/page.tsx` | Sheet-based form |
| `/dashboard/elements/icons` | `dashboard/elements/icons/page.tsx` | Icon showcase |
| `/dashboard/react-query` | `dashboard/react-query/page.tsx` | React Query demo (Pokemon API) |
| `/dashboard/billing` | `dashboard/billing/page.tsx` | Subscription billing |
| `/dashboard/exclusive` | `dashboard/exclusive/page.tsx` | Pro plan feature example |
| `/dashboard/workspaces` | `dashboard/workspaces/page.tsx` | Organization management |
| `/dashboard/workspaces/team` | `dashboard/workspaces/team/[[...rest]]/page.tsx` | Team settings |
| `/dashboard/profile` | `dashboard/profile/[[...profile]]/page.tsx` | User profile |

### Public / Static

| Route | Page Component | Description |
|-------|---------------|-------------|
| `/` | `page.tsx` | Landing page |
| `/about` | `about/page.tsx` | About page |
| `/privacy-policy` | `privacy-policy/page.tsx` | Privacy policy |
| `/terms-of-service` | `terms-of-service/page.tsx` | Terms of service |
| `/SKILL.md` | Static file | Project skill description |
| `/mcp.md` | Static file | MCP server documentation (canonical: `docs/mcp/index.md`) |

---

## 4. Static Files (public/)

Files in `public/` are served directly at the root path:

| Path | Source | Description |
|------|--------|-------------|
| `/SKILL.md` | `public/SKILL.md` | Project function skill documentation |
| `/mcp.md` | `public/mcp.md` | MCP server tool documentation (canonical: `docs/mcp/index.md`) |
| `/robots.txt` | `public/robots.txt` | Search engine directives |
| `/favicon.ico` | `public/favicon.ico` | Site favicon |
| `/next.svg` | `public/next.svg` | Next.js logo |
| `/vercel.svg` | `public/vercel.svg` | Vercel logo |
| `/shadcn-dashboard.png` | `public/shadcn-dashboard.png` | Dashboard screenshot |
| `/assets/sentry.svg` | `public/assets/sentry.svg` | Sentry logo |

---

## 5. MCP Tools (port 3100)

The MCP server runs on port `:3100` (started automatically with `npm run dev` via concurrently).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP JSON-RPC (Streamable HTTP) |
| `/mcp` | GET | SSE stream (stateful sessions) |
| `/health` | GET | Health check → `{ "status": "ok" }` |
| `/tools` | GET | List all 9 tools (JSON) |

**Available MCP Tools:**

| Tool | Description |
|------|-------------|
| `run_migration` | Apply SQL migrations (`seed_only`, `schema_only`, `dry_run`) |
| `query_database` | Execute read-only SQL (`sql`, `params`) |
| `list_tables` | List all tables with row counts |
| `describe_table` | Show columns, types, indexes (`table`) |
| `run_dev_server` | Start Next.js dev server in background |
| `build_project` | Run `npm run build` |
| `lint_project` | Run `npm run lint` |
| `read_migration_file` | Read migration SQL file (`file`) |
| `list_migration_files` | List all migration files |

**Editor Configuration (`.mcp.json`):**
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

**MCP Protocol Flow (stateful):**
1. `POST /mcp` with `method: "initialize"` → receive `Mcp-Session-Id` header
2. Include `Mcp-Session-Id` header in all subsequent requests
3. `POST /mcp` with `method: "tools/list"` → list tools
4. `POST /mcp` with `method: "tools/call"` → execute tool

---

## 6. Database

Connection details for direct database access.

| Property | Value |
|----------|-------|
| Host | `192.168.1.9` |
| Port | `5432` |
| Database | `opencmdb` |
| Read-Write | `opencmdb_rw` |
| Read-Only | `opencmdb_ro` |

**Key Tables:**

| Table | Rows | Description |
|-------|------|-------------|
| `asset_templates` | 5 | Asset type definitions |
| `asset_instances` | 0+ | Concrete asset instances |

---

## 7. Development Commands

| Command | What it starts |
|---------|---------------|
| `npm run dev` | Next.js (`:3000`) + MCP (`:3100`) |
| `npm run dev:next` | Next.js only (`:3000`) |
| `npm run dev:mcp` | MCP only (`:3100`) |
| `npm run build` | Production build |
| `node scripts/migrate.mjs` | Database migration |

---

## 8. Environment Variables

| Variable | Default | Required | Used In |
|----------|---------|----------|---------|
| `DB_HOST` | `192.168.1.9` | Yes | MCP / Migration |
| `DB_PORT` | `5432` | Yes | MCP / Migration |
| `DB_NAME` | `opencmdb` | Yes | MCP / Migration |
| `DB_USER` | `opencmdb_rw` | Yes | MCP / Migration |
| `DB_PASS` | — | Yes | MCP / Migration |
| `AUTH_SECRET` | `change-me-in-production` | Yes | Auth middleware |
| `MCP_PORT` | `3100` | No | MCP server port |
| `MCP_HOST` | `0.0.0.0` | No | MCP bind address |
