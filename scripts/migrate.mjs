#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// OpenCMDB — Database Migration Runner
// Usage: node scripts/migrate.mjs
// ═══════════════════════════════════════════════════════════

import { readFileSync, readdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'opencmdb',
  user: process.env.DB_USER || 'opencmdb_rw',
  password: process.env.DB_PASS || '',
};

async function runMigration() {
  const client = new pg.Client(DB_CONFIG);

  try {
    console.log('═'.repeat(55));
    console.log(' OpenCMDB Migration');
    console.log(` Host:     ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log(` Database: ${DB_CONFIG.database}`);
    console.log(` User:     ${DB_CONFIG.user}`);
    console.log('═'.repeat(55));

    await client.connect();
    console.log('\n✓ Connected to database');

    // Discover and run all migration SQL files in order
    const sqlFiles = readdirSync(__dirname)
      .filter((f) => /^\d{3}-.+\.sql$/.test(f))
      .sort();

    if (sqlFiles.length === 0) {
      console.log('⚠ No migration files found');
      return;
    }

    for (const file of sqlFiles) {
      const sqlPath = resolve(__dirname, file);
      const sql = readFileSync(sqlPath, 'utf-8');
      console.log(`▶ [${file}] Applying...`);
      await client.query(sql);
      console.log(`✓ ${file} applied`);
    }

    // Verify
    const { rows: tables } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('\n▶ Tables created:');
    for (const t of tables) {
      const { rows: countResult } = await client.query(`SELECT COUNT(*) AS cnt FROM "${t.table_name}"`);
      console.log(`  • ${t.table_name} (${countResult[0].cnt} rows)`);
    }

    console.log('\n' + '═'.repeat(55));
    console.log('✅ Migration complete');
    console.log('═'.repeat(55));
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
