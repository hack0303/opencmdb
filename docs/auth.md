---
title: "OpenCMDB — Authentication System"
summary: "JWT-based session auth: login, middleware protection, API routes, client context, and configuration"
read_when:
  - "debugging login or redirect issues"
  - "understanding how auth middleware protects routes"
  - "adding new protected pages or API routes"
  - "configuring authentication for production"
scope:
  - auth
  - middleware
  - api
status: "active"
updated: "2026-07-04"
---

# Authentication System

## Architecture

```
┌──────────┐  POST /api/auth/login   ┌──────────────┐
│ Browser  │ ──────────────────────→  │  Login API   │
│ (client) │                         │  Route       │
│          │ ←── 200 + Set-Cookie ── │  Handler     │
│          │    { success, user }     │              │
│          │                         │  validates   │
│          │  window.location.href   │  creates JWT │
│          │  ─→ /dashboard/assets   │  sets cookie │
│          │                         └──────────────┘
│          │                              │
│          │                         ┌────┴───────┐
│          │  GET /dashboard/assets  │ Middleware  │
│          │  (with cookie) ───────→ │ proxy.ts    │
│          │                         │             │
│          │                         │ jwtVerify() │
│          │                         │  ✔ → next() │
│          │                         │  ✗ → /login │
│          │                         └────────────┘
└──────────┘
```

---

## Credentials

| Username   | Password   | Role  |
|------------|-----------|-------|
| `opencmdb` | `opencmdb`| Admin |

Hardcoded in `src/lib/auth.ts` — replace with database/user service for production.

---

## Auth Flow (Login Page)

**File:** `src/app/auth/login/page.tsx`

1. User submits form (fetch + JSON)
2. `POST /api/auth/login` with `{ username, password }`
3. Server validates credentials → creates JWT → sets `session` cookie
4. Returns `{ success: true, user: { ... } }`
5. Client reads JSON → `window.location.href = '/dashboard/assets'`
6. Browser follows redirect with cookie → middleware verifies → dashboard renders

```typescript
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});

const data = await res.json();
if (res.ok && data.success) {
  window.location.href = '/dashboard/assets';
}
```

**Why full page redirect (`window.location.href`) instead of `router.push()`:**
- Full page load ensures middleware reads the cookie
- Avoids race condition between cookie set and client navigation
- Cookie + navigation are handled atomically by the browser

---

## API Endpoints

### `POST /api/auth/login`

Validate credentials and create session.

**Request:**
```json
{ "username": "opencmdb", "password": "opencmdb" }
```

**Success (200):**
```json
{
  "success": true,
  "user": { "username": "opencmdb", "name": "OpenCMDB Admin", "email": "admin@opencmdb.local" }
}
```
Cookie set: `session=<JWT>; httpOnly; path=/; maxAge=86400; sameSite=lax`

**Error (400):**
```json
{ "error": "Username and password are required" }
```

**Error (401):**
```json
{ "error": "Invalid username or password" }
```

### `POST /api/auth/logout`

Clear session cookie.

**Response (200):**
```json
{ "success": true }
```
Cookie deleted.

### `GET /api/auth/me`

Get current authenticated user. Used by `AuthProvider` context.

**Authenticated (200):**
```json
{
  "authenticated": true,
  "user": { "username": "opencmdb", "name": "OpenCMDB Admin", "email": "admin@opencmdb.local" }
}
```

**Unauthenticated (401):**
```json
{ "authenticated": false }
```

---

## JWT Session (`src/lib/auth.ts`)

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| Signing key | `process.env.AUTH_SECRET \|\| 'change-me-in-production'` |
| Token payload | `{ username, name, email, iat, exp }` |
| Expiry | 24 hours |
| Cookie name | `session` |
| Cookie flags | `httpOnly`, `sameSite=lax`, `path=/` |

**Key functions:**

| Function | Description |
|----------|-------------|
| `validateCredentials(username, password)` | Check against hardcoded USERS map |
| `createSession(user)` | Create signed JWT |
| `verifySession(token)` | Verify and decode JWT |
| `getSession()` | Read cookie + verify JWT |
| `setSessionCookie(token)` | Set cookie on server components |
| `clearSessionCookie()` | Delete cookie |
| `requireAuth()` | Guard: redirect to `/auth/login` if unauthenticated |

---

## Middleware (`src/proxy.ts`)

The middleware protects `/dashboard/*` and `/api/*` routes.

```typescript
// Public paths — no auth required
const publicPaths = ['/auth/login', '/api/auth/login'];
```

**Protected routes:**

| Pattern | Unauthenticated behavior |
|---------|--------------------------|
| `/dashboard/*` | 302 redirect to `/auth/login` |
| `/api/*` | 401 JSON `{ "error": "Unauthorized" }` |
| `/auth/login` | Allowed (public) |
| `/api/auth/login` | Allowed (public) |

**Matcher config** — middleware runs on all routes except static files and `_next`:

```typescript
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|...)).*)',
    '/(api|trpc)(.*)'
  ]
};
```

---

## Client-Side Auth Context (`src/lib/auth-context.tsx`)

Provides `useAuth()` hook for client components.

```tsx
import { useAuth } from '@/lib/auth-context';

function MyComponent() {
  const { user, loading, logout, refresh } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <p>Not logged in</p>;
  return <p>Welcome, {user.name}</p>;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `user` | `AuthUser \| null` | Current user or null |
| `loading` | `boolean` | Initial auth check in progress |
| `logout` | `() => Promise<void>` | POST to `/api/auth/logout`, redirect to login |
| `refresh` | `() => Promise<void>` | Re-fetch `/api/auth/me` |

Wrapped in layout (`src/app/layout.tsx` or `src/app/dashboard/layout.tsx`):
```tsx
<AuthProvider>
  {children}
</AuthProvider>
```

---

## Login Page UI

| File | `src/app/auth/login/page.tsx` |
|------|------------------------------|
| Route | `/auth/login` |
| Type | Client component (`'use client'`) |
| Auth | Public (no auth required) |

The login page submits credentials via `fetch` to `/api/auth/login`. On success it reads the JSON response and does a full page redirect (`window.location.href`) to `/dashboard/assets`. On failure it shows inline error message and toast.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid credentials | Toast + inline error: "Invalid username or password" |
| Missing fields | Toast + inline error: "Username and password are required" |
| Network error | Toast + inline error: "Network error — is the server running?" |
| Expired session | Middleware deletes cookie + redirects to `/auth/login` |
| No session cookie | Middleware redirects to `/auth/login` (or 401 for API) |

---

## Security Considerations

| Concern | Implementation |
|---------|---------------|
| Token storage | httpOnly cookie (not accessible to JavaScript) |
| CSRF | `sameSite=lax` prevents cross-site form POST |
| XSS | Token in httpOnly cookie, not exposed to JS |
| Secret | `process.env.AUTH_SECRET` — **must change in production** from default `change-me-in-production` |
| HTTPS | Cookie flagged `secure` only in production |
| Token expiry | 24 hours, enforced by `jwtVerify` |
| Credentials | Hardcoded in dev — **must move to database for production** |

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `AUTH_SECRET` | `change-me-in-production` | Yes | JWT signing key — change for production |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | JWT utilities, credential validation, cookie helpers |
| `src/proxy.ts` | Auth middleware — protects routes |
| `src/lib/auth-context.tsx` | Client-side auth state (useAuth hook) |
| `src/app/api/auth/login/route.ts` | Login API handler |
| `src/app/api/auth/logout/route.ts` | Logout API handler |
| `src/app/api/auth/me/route.ts` | Current user query |
| `src/app/auth/login/page.tsx` | Login page UI |
