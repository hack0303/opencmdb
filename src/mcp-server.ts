// ═══════════════════════════════════════════════════════════
// OpenCMDB — Remote MCP Server (Streamable HTTP)
// MCP is just a protocol layer — all business logic is delegated
// to the existing service layer (src/features/assets/api/service.ts).
// ═══════════════════════════════════════════════════════════

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ─── Load .env.local ───

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

// ─── Service Layer (reuses the same service.ts used by Next.js frontend) ───
// require() works with tsx — it gives us named exports directly.

const service = require('../src/features/assets/api/service.js');

// ─── Tool Definitions ───
//   3 groups: Asset Management · Templates · Database Utilities · Migration

const tools: Tool[] = [
  // ═══════════ Asset Management ═══════════

  {
    name: 'get_assets',
    description:
      'List asset instances with optional filters (template, state, tag search, limit). Returns JSON array.',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'Filter by template ID (e.g. tmpl-db-001)' },
        state: { type: 'string', description: 'Filter by current_state (e.g. RUNNING)' },
        search: { type: 'string', description: 'Search in name, description, tags' },
        limit: { type: 'number', description: 'Max results (default 50)' }
      }
    }
  },
  {
    name: 'get_asset',
    description: 'Get a single asset instance by ID with full details.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Asset ID (e.g. ast-db-001)' }
      },
      required: ['id']
    }
  },
  {
    name: 'register_asset',
    description:
      'Register a new asset instance. Provide template_id, name, attributes (JSON object), optional tags, description, current_state, capabilities, state_mapping.',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'Template ID (e.g. tmpl-db-001)' },
        name: { type: 'string', description: 'Asset name (e.g. cland-base-dict)' },
        attributes: { type: 'object', description: 'JSON object matching the template schema_def' },
        description: { type: 'string', description: 'Optional description' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
        current_state: { type: 'string', description: 'Initial state (default UNKNOWN)' }
      },
      required: ['template_id', 'name', 'attributes']
    }
  },
  {
    name: 'update_asset',
    description: 'Update an existing asset. Only provided fields are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Asset ID to update' },
        attributes: {
          type: 'object',
          description: 'New attributes (JSON object, replaces existing)'
        },
        current_state: { type: 'string', description: 'New state' },
        tags: { type: 'array', items: { type: 'string' }, description: 'New tags' },
        description: { type: 'string', description: 'New description' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_asset',
    description: 'Delete an asset instance by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Asset ID to delete' }
      },
      required: ['id']
    }
  },

  // ═══════════ Templates ═══════════

  {
    name: 'get_templates',
    description: 'List all asset templates, optionally filtered by category.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter: hardware, software, storage' }
      }
    }
  },
  {
    name: 'get_template',
    description: 'Get a single template by ID with full schema_def, state_mapping, capabilities.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Template ID (e.g. tmpl-db-001)' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_template',
    description:
      'Create a new asset template. Provide name, category (hardware/software/storage), schema (JSON Schema), defaultStateMapping, defaultCapabilities, tags, description.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Template name (e.g. Redis Cache)' },
        category: { type: 'string', description: 'One of: hardware, software, storage' },
        description: { type: 'string', description: 'What this asset type does' },
        schema: {
          type: 'object',
          description: 'JSON Schema defining valid attributes for instances'
        },
        default_state_mapping: {
          type: 'object',
          description: 'Default state definitions: { states, initialState, conditions }'
        },
        default_capabilities: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of capability definitions'
        },
        tags: { type: 'array', items: { type: 'string' }, description: 'Classification tags' }
      },
      required: ['name', 'category', 'schema']
    }
  },
  {
    name: 'update_template',
    description: 'Update an existing template. Only provided fields are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Template ID to update' },
        name: { type: 'string' },
        category: { type: 'string', description: 'hardware, software, or storage' },
        description: { type: 'string' },
        schema: { type: 'object', description: 'JSON Schema' },
        default_state_mapping: { type: 'object' },
        default_capabilities: { type: 'array', items: { type: 'object' } },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_template',
    description: 'Delete a template by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Template ID to delete' }
      },
      required: ['id']
    }
  },

  // ═══════════ Database Utilities ═══════════

  {
    name: 'sql_query',
    description: 'Execute a read-only SQL query (SELECT / WITH only). Returns JSON rows.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SELECT or WITH SQL query' },
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

  // ═══════════ Migration ═══════════

  {
    name: 'run_migration',
    description: 'Apply pending SQL migrations (scripts/nnn-*.sql). Use dry_run to preview.',
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
    name: 'list_migrations',
    description: 'List all migration SQL files in order.',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ─── Tool Handlers — delegate to service.ts ───

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    // ── Asset Management (delegates to service.ts) ──

    case 'get_assets': {
      try {
        // Build filters matching the service layer (camelCase keys)
        const filters: Record<string, unknown> = {
          page: 1,
          limit: Math.min(Math.max(+(args.limit ?? 50), 1), 200)
        };
        if (args.template_id) filters.templateId = args.template_id;
        if (args.state) filters.state = args.state;
        if (args.search) filters.search = args.search;
        const result = await service.getAssets(filters as any);
        return JSON.stringify(result, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'get_asset': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const asset = await service.getAssetById(id);
        return asset ? JSON.stringify(asset, null, 2) : `❌ Asset "${id}" not found.`;
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'register_asset': {
      const templateId = args.template_id as string;
      const name = args.name as string;
      const attributes = args.attributes as Record<string, unknown>;
      if (!templateId || !name || !attributes) {
        return '❌ template_id, name, and attributes are required.';
      }
      try {
        // Fetch template defaults for state_mapping and capabilities
        const tmpl = await service.getTemplateById(templateId);
        if (!tmpl) return `❌ Template "${templateId}" not found.`;

        const payload: Record<string, unknown> = {
          templateId,
          name,
          attributes,
          description: (args.description as string) || '',
          tags: (args.tags as string[]) || [],
          currentState:
            (args.current_state as string) ||
            (tmpl as any).defaultStateMapping?.initialState ||
            'UNKNOWN',
          stateMapping: (tmpl as any).defaultStateMapping,
          capabilities: (tmpl as any).defaultCapabilities || []
        };
        const asset = await service.createAsset(payload as any);
        return JSON.stringify({ id: asset.id, status: 'created' }, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'update_asset': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const payload: Record<string, unknown> = {};
        if (args.attributes !== undefined) payload.attributes = args.attributes;
        if (args.current_state !== undefined) payload.currentState = args.current_state;
        if (args.tags !== undefined) payload.tags = args.tags;
        if (args.description !== undefined) payload.description = args.description;
        const asset = await service.updateAsset(id, payload as any);
        return asset
          ? JSON.stringify({ id: asset.id, status: 'updated' }, null, 2)
          : `❌ Asset "${id}" not found.`;
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'delete_asset': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        await service.deleteAsset(id);
        return JSON.stringify({ id, status: 'deleted' }, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    // ── Template Management ──

    case 'get_templates': {
      try {
        const filters: Record<string, unknown> = { page: 1, limit: 50 };
        if (args.category) filters.category = args.category;
        const result = await service.getTemplates(filters as any);
        return JSON.stringify(result, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'get_template': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const tmpl = await service.getTemplateById(id);
        return tmpl ? JSON.stringify(tmpl, null, 2) : `❌ Template "${id}" not found.`;
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'create_template': {
      const name = args.name as string;
      const category = args.category as string;
      const schema = args.schema as Record<string, unknown>;
      if (!name || !category || !schema) {
        return '❌ name, category, and schema are required.';
      }
      try {
        const payload: Record<string, unknown> = {
          name,
          category,
          schema,
          description: (args.description as string) || '',
          tags: (args.tags as string[]) || [],
          defaultStateMapping: args.default_state_mapping || {
            states: ['UNKNOWN'],
            initialState: 'UNKNOWN'
          },
          defaultCapabilities: args.default_capabilities || []
        };
        const tmpl = await service.createTemplate(payload as any);
        return JSON.stringify({ id: tmpl.id, name: tmpl.name, status: 'created' }, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'update_template': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const payload: Record<string, unknown> = {};
        if (args.name !== undefined) payload.name = args.name;
        if (args.category !== undefined) payload.category = args.category;
        if (args.description !== undefined) payload.description = args.description;
        if (args.schema !== undefined) payload.schema = args.schema;
        if (args.default_state_mapping !== undefined)
          payload.defaultStateMapping = args.default_state_mapping;
        if (args.default_capabilities !== undefined)
          payload.defaultCapabilities = args.default_capabilities;
        if (args.tags !== undefined) payload.tags = args.tags;
        const tmpl = await service.updateTemplate(id, payload as any);
        return tmpl
          ? JSON.stringify({ id: tmpl.id, status: 'updated' }, null, 2)
          : `❌ Template "${id}" not found.`;
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'delete_template': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        await service.deleteTemplate(id);
        return JSON.stringify({ id, status: 'deleted' }, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    // ── Database Utilities ──

    case 'sql_query': {
      const sql = args.sql as string;
      if (!sql) return '❌ sql is required.';
      const upper = sql.trim().toUpperCase();
      if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
        return '❌ Only SELECT/WITH queries allowed (read-only).';
      }
      try {
        const { query } = require('../src/lib/db.js');
        const rows = await query(sql, (args.params as string[]) || []);
        return JSON.stringify(rows, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'list_tables': {
      try {
        const { query } = require('../src/lib/db.js');
        const rows = await query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' ORDER BY table_name`
        );
        const lines: string[] = [];
        for (const r of rows) {
          const cnt = await query(`SELECT COUNT(*) AS cnt FROM "${r.table_name}"`);
          lines.push(`  \u2022 ${r.table_name} (${cnt[0].cnt} rows)`);
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
        const { query } = require('../src/lib/db.js');
        const cols = await query(
          `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [table]
        );
        if (cols.length === 0) return `❌ Table "${table}" not found.`;

        const indexes = await query(
          `SELECT indexname, indexdef FROM pg_indexes
           WHERE tablename = $1 ORDER BY indexname`,
          [table]
        );

        const lines: string[] = [`Table: ${table}`, ''];
        lines.push('Columns:');
        for (const c of cols) {
          lines.push(
            `  \u2022 ${c.column_name}  ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}${c.column_default ? ` DEFAULT ${c.column_default}` : ''}`
          );
        }
        if (indexes.length > 0) {
          lines.push('', 'Indexes:');
          for (const ix of indexes) {
            lines.push(`  \u2022 ${ix.indexname}`);
          }
        }
        return lines.join('\n');
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    // ── Migration ──

    case 'run_migration': {
      const { query } = require('../src/lib/db.js');
      const scriptsDir = resolve(PROJECT_ROOT, 'scripts');
      const files = readdirSync(scriptsDir)
        .filter((f) => /^\d{3}-.+\.sql$/.test(f))
        .sort();
      if (files.length === 0) return '⚠ No migration files found.';

      const seedOnly = args.seed_only === true;
      const schemaOnly = args.schema_only === true;
      const dryRun = args.dry_run === true;
      const lines: string[] = [];

      for (const file of files) {
        const isSeed = file.includes('seed');
        if (seedOnly && !isSeed) continue;
        if (schemaOnly && isSeed) continue;
        if (dryRun) {
          lines.push(`[DRY-RUN] ${file}`);
          continue;
        }
        const sql = readFileSync(resolve(scriptsDir, file), 'utf-8');
        try {
          await query(sql);
          lines.push(`✅ ${file}`);
        } catch (err: any) {
          lines.push(`❌ ${file}: ${err.message}`);
          return lines.join('\n');
        }
      }
      if (dryRun && lines.length === 0) lines.push('(no files to run)');
      return lines.join('\n');
    }

    case 'list_migrations': {
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

  // ─── Transport management ───

  let transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID()
  });

  await mcpServer.connect(transport);

  async function resetTransport(): Promise<void> {
    await mcpServer.close();
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID()
    });
    await mcpServer.connect(transport);
  }

  // ─── HTTP Server ───

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version'
    );

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', server: 'opencmdb-mcp' }));
      return;
    }
    if (req.method === 'POST' && req.url === '/reset') {
      try {
        await resetTransport();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Session reset.' }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
    if (req.method === 'GET' && req.url === '/session') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          {
            sessionId: transport.sessionId || null,
            initialized: (transport as any)._initialized === true,
            server: 'opencmdb-mcp'
          },
          null,
          2
        )
      );
      return;
    }
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
