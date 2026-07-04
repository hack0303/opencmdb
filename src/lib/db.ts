// ═══════════════════════════════════════════════════════════
// Database Connection Pool (Server Only)
// ═══════════════════════════════════════════════════════════

import 'server-only';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || '192.168.1.9',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'opencmdb',
  user: process.env.DB_USER || 'opencmdb_rw',
  password: process.env.DB_PASS || 'a1b2c3d4e5f6g7h8i9j0klmnopqrstuv',
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export default pool;

/**
 * Execute a single SQL query.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/**
 * Execute a single-row query (returns one row or null).
 */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await pool.query(text, params);
  return (result.rows[0] as T) ?? null;
}
