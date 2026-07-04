// ═══════════════════════════════════════════════════════════
// Auth Utilities — JWT-based session management
// ═══════════════════════════════════════════════════════════

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'change-me-in-production');

const COOKIE_NAME = 'session';
const SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

// ═════════════════════════════════════════════
// User credentials (hardcoded for dev)
// ═════════════════════════════════════════════

const USERS: Record<string, { password: string; name: string; email: string }> = {
  opencmdb: {
    password: 'opencmdb',
    name: 'OpenCMDB Admin',
    email: 'admin@opencmdb.local'
  }
};

export interface AuthUser {
  username: string;
  name: string;
  email: string;
}

// ── Login ──

export function validateCredentials(username: string, password: string): AuthUser | null {
  const user = USERS[username];
  if (!user || user.password !== password) return null;
  return { username, name: user.name, email: user.email };
}

// ── JWT ──

export async function createSession(user: AuthUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as AuthUser;
  } catch {
    return null;
  }
}

// ── Cookie helpers (Server Components / Actions) ──

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/'
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ── Guard / Redirect ──

export async function requireAuth(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) {
    redirect('/auth/login');
  }
  return user;
}
