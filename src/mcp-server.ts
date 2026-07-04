// ═══════════════════════════════════════════════════════════
// OpenCMDB — Remote MCP Server (Streamable HTTP)
// Exposes AI tools via HTTP for remote AI assistant access.
// ═══════════════════════════════════════════════════════════
// Usage:
//   node --import tsx src/mcp-server.ts
//   curl -X POST http://localhost:3100/mcp -H 'Content-Type: application/json' -d '{}'
// ═══════════════════════════════════════════════════════════

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { execSync, spawn } from 'child_process';
import { readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ─── Load .env.local (if present) ───

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sep = trimmed.indexOf('=');
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    const val = trimmed
      .slice(sep + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

// ─── Config ───

const PORT = parseInt(process.env.MCP_PORT || '3100', 10);
const HOST = process.env.MCP_HOST || '0.0.0.0';

const DB_CONFIG = {
  host: process.env.DB_HOST || '192.168.1.9',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'opencmdb',
  user: process.env.DB_USER || 'opencmdb_rw',
  password: process.env.DB_PASS || ''
};

// ─── Helper ───

function runCmd(cmd: string, cwd = PROJECT_ROOT): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(cmd, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return { stdout: stdout.trim(), stderr: '', code: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout?.trim() || '',
      stderr: e.stderr?.trim() || e.message,
      code: e.status ?? 1
    };
  }
}

async function queryDB(sql: string, params: string[] = []): Promise<string> {
  const { default: pg } = await import('pg');
  const client = new pg.Client(DB_CONFIG);
  try {
    await client.connect();
    const result = await client.query(sql, params);
    return JSON.stringify(result.rows, null, 2);
  } finally {
    await client.end();
  }
}

async function runMigrationFiles(
  seedOnly: boolean,
  schemaOnly: boolean,
  dryRun: boolean
): Promise<string> {
  const scriptsDir = resolve(PROJECT_ROOT, 'scripts');
  const files = readdirSync(scriptsDir)
    .filter((f) => /^\d{3}-.+\.sql$/.test(f))
    .sort();

  if (files.length === 0) return '⚠ No migration files found.';

  const lines: string[] = [];

  for (const file of files) {
    const isSeed = file.includes('seed');
    if (seedOnly && !isSeed) continue;
    if (schemaOnly && isSeed) continue;

    if (dryRun) {
      lines.push(`[DRY-RUN] ${file}`);
      continue;
    }

    const sqlPath = resolve(scriptsDir, file);
    const sql = readFileSync(sqlPath, 'utf-8');
    try {
      const { default: pg } = await import('pg');
      const client = new pg.Client(DB_CONFIG);
      await client.connect();
      await client.query(sql);
      await client.end();
      lines.push(`✅ ${file}`);
    } catch (err: any) {
      lines.push(`❌ ${file}: ${err.message}`);
      return lines.join('\n');
    }
  }

  if (dryRun && lines.length === 0) lines.push('(no files to run)');
  return lines.join('\n');
}

// ─── Tool Definitions ───

const tools: Tool[] = [
  {
    name: 'run_migration',
    description:
      'Apply all pending SQL migrations (scripts/nnn-*.sql) in order using node-postgres.',
    inputSchema: {
      type: 'object',
      properties: {
        seed_only: { type: 'boolean', description: 'Only seed files' },
        schema_only: { type: 'boolean', description: 'Only schema files' },
        dry_run: { type: 'boolean', description: 'Preview without executing' }
      }
    }
  },
  {
    name: 'query_database',
    description: 'Execute a read-only SQL query (SELECT / WITH only). Returns JSON rows.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SELECT SQL query' },
        params: {
          type: 'array',
          description: 'Values for $1, $2 placeholders',
          items: { type: 'string' }
        }
      },
      required: ['sql']
    }
  },
  {
    name: 'list_tables',
    description: 'List all public schema tables with row counts.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'describe_table',
    description: 'Show columns, types, indexes for a table.',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' }
      },
      required: ['table']
    }
  },
  {
    name: 'run_dev_server',
    description: 'Start the Next.js dev server in background.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'build_project',
    description: 'Run production build (npm run build).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'lint_project',
    description: 'Run ESLint (npm run lint).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'read_migration_file',
    description: 'Read a migration SQL file from scripts/.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'e.g. 001-schema-assets.sql' }
      },
      required: ['file']
    }
  },
  {
    name: 'list_migration_files',
    description: 'List all migration SQL files in order.',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ─── Tool Handlers ───

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'run_migration': {
      return runMigrationFiles(
        args.seed_only === true,
        args.schema_only === true,
        args.dry_run === true
      );
    }

    case 'query_database': {
      const sql = args.sql as string;
      if (!sql) return '❌ sql is required.';
      const upper = sql.trim().toUpperCase();
      if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
        return '❌ Only SELECT/WITH queries allowed (read-only).';
      }
      try {
        return await queryDB(sql, (args.params as string[]) || []);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'list_tables': {
      try {
        const rows = JSON.parse(
          await queryDB(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
          )
        );
        const lines: string[] = [];
        for (const r of rows) {
          const cnt = JSON.parse(await queryDB(`SELECT COUNT(*) AS cnt FROM "${r.table_name}"`));
          lines.push(`  • ${r.table_name} (${cnt[0].cnt} rows)`);
        }
        return 'Tables:\n' + lines.join('\n');
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'describe_table': {
      const table = args.table as string;
      if (!table) return '❌ table is required.';
      try {
        const cols = JSON.parse(
          await queryDB(
            `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
            [table]
          )
        );
        if (cols.length === 0) return `❌ Table "${table}" not found.`;

        const indexes = JSON.parse(
          await queryDB(
            `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1 ORDER BY indexname`,
            [table]
          )
        );

        const lines: string[] = [`Table: ${table}`, ''];
        lines.push('Columns:');
        for (const c of cols) {
          lines.push(
            `  • ${c.column_name}  ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}${c.column_default ? ` DEFAULT ${c.column_default}` : ''}`
          );
        }
        if (indexes.length > 0) {
          lines.push('', 'Indexes:');
          for (const ix of indexes) {
            lines.push(`  • ${ix.indexname}`);
          }
        }
        return lines.join('\n');
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'run_dev_server': {
      const child = spawn('npm', ['run', 'dev'], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        detached: true,
        shell: true
      });
      child.unref();
      return '✅ Dev server starting in background. Default: http://localhost:3000';
    }

    case 'build_project': {
      const r = runCmd('npm run build 2>&1');
      return r.code === 0
        ? `✅ Build succeeded.\n${r.stdout.slice(-2000)}`
        : `❌ Build failed (code ${r.code}).\n${r.stderr.slice(-2000)}`;
    }

    case 'lint_project': {
      const r = runCmd('npm run lint 2>&1');
      return r.code === 0
        ? '✅ Lint passed (no errors).'
        : `❌ Lint found issues (code ${r.code}).\n${r.stderr.slice(-2000)}`;
    }

    case 'read_migration_file': {
      const file = args.file as string;
      if (!file) return '❌ file is required.';
      const fp = resolve(PROJECT_ROOT, 'scripts', file);
      if (!existsSync(fp)) return `❌ File not found: scripts/${file}`;
      return readFileSync(fp, 'utf-8');
    }

    case 'list_migration_files': {
      const files = readdirSync(resolve(PROJECT_ROOT, 'scripts'))
        .filter((f) => /^\d{3}-.+\.sql$/.test(f))
        .sort();
      return files.length === 0
        ? '(no migration files)'
        : files.map((f, i) => `${i + 1}. ${f}`).join('\n');
    }

    default:
      return `❌ Unknown tool: ${name}`;
  }
}

// ─── MCP Server Setup ───

async function main() {
  const mcpServer = new Server(
    { name: 'opencmdb-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      const text = await handleToolCall(name, (args as Record<string, unknown>) || {});
      return { content: [{ type: 'text', text }] };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `❌ ${err.message}` }]
      };
    }
  });

  // ─── HTTP Server ───

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID()
  });

  // Connect the MCP server to the transport
  await mcpServer.connect(transport);

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers for remote access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', server: 'opencmdb-mcp' }));
      return;
    }

    // Tool list (convenience for non-MCP clients)
    if (req.method === 'GET' && req.url === '/tools') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          tools.map((t) => ({ name: t.name, description: t.description })),
          null,
          2
        )
      );
      return;
    }

    // All other requests → MCP transport
    // Collect body for POST
    let body = '';
    if (req.method === 'POST') {
      for await (const chunk of req) body += chunk;
    }

    try {
      const parsedBody = body ? JSON.parse(body) : undefined;
      await transport.handleRequest(req, res, parsedBody);
    } catch (err: any) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  });

  httpServer.listen(PORT, HOST, () => {
    console.error(`✅ OpenCMDB MCP server running at http://${HOST}:${PORT}/mcp`);
    console.error(`   Health:   http://${HOST}:${PORT}/health`);
    console.error(`   Tools:    http://${HOST}:${PORT}/tools`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down MCP server...');
    await transport.close();
    httpServer.close(() => process.exit(0));
  });

  process.on('SIGTERM', async () => {
    await transport.close();
    httpServer.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error('❌ MCP server failed:', err);
  process.exit(1);
});
