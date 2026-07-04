// ═══════════════════════════════════════════════════════════
// Database Pool — shared between Next.js (db.ts) and MCP server
// No `server-only` — plain pg.Pool.
// ═══════════════════════════════════════════════════════════

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || '192.168.1.9',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'opencmdb',
  user: process.env.DB_USER || 'opencmdb_rw',
  password: process.env.DB_PASS || '',
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export default pool;

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await pool.query(text, params);
  return (result.rows[0] as T) ?? null;
}
