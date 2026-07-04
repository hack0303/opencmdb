// ═══════════════════════════════════════════════════════════
// OpenCMDB MCP E2E Test — Full Workflow
// ═══════════════════════════════════════════════════════════
// Tests:
//   1. Connect to MCP server (SDK client)
//   2. List available tools
//   3. Query PostgreSQL Database template
//   4. Register N databases as assets
//   5. Verify registration via query
//
// Usage:
//   node e2e/mcp-flow.test.js
//   node e2e/mcp-flow.test.js --register  # also run registration steps
//   MCP_URL=http://192.168.1.14:3100/mcp node e2e/mcp-flow.test.js
// ═══════════════════════════════════════════════════════════

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const {
  StreamableHTTPClientTransport
} = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const MCP_URL = process.env.MCP_URL || 'http://127.0.0.1:3100/mcp';
const SHOULD_REGISTER = process.argv.includes('--register');

// ── DB registries (read from db_info.md or inline) ──
// Format: { name, host, port, rw_user, ro_user, description, version, tags }
const DB_REGISTRY = [
  // TODO: populate from db_info.md — example:
  // { name: 'cland_base_dict', host: '192.168.1.9', port: 5432,
  //   rw_user: 'opencmdb_rw', ro_user: 'opencmdb_ro',
  //   description: '基础字典库', version: '16',
  //   tags: ['database', 'postgresql', 'production'] },
];

// ── Helpers ──

let passed = 0;
let failed = 0;

function assert(label, ok) {
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

/** Reset the MCP server session (clear initialized state). */
async function resetSession() {
  const url = new URL(MCP_URL);
  const resetUrl = `${url.protocol}//${url.host}/reset`;
  const res = await fetch(resetUrl, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`reset failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  console.log(`  🔄 Session reset: ${body.message}`);
}

async function connect() {
  // Reset session first so the SDK client can do fresh initialize
  await resetSession();

  const transport = new StreamableHTTPClientTransport(MCP_URL);
  const client = new Client({ name: 'opencmdb-e2e', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

async function call(client, name, args = {}) {
  return client.callTool({ name, arguments: args });
}

// ── Tests ──

async function testConnectivity(client) {
  console.log('\n── 1. Connectivity ──');
  assert('client is connected', !!client);
}

async function testListTools(client) {
  console.log('\n── 2. List Tools ──');
  const result = await client.listTools();
  const toolNames = result.tools.map((t) => t.name).sort();
  assert('tools returned as array', Array.isArray(result.tools));
  assert('has run_migration', toolNames.includes('run_migration'));
  assert('has query_database', toolNames.includes('query_database'));
  assert('has list_tables', toolNames.includes('list_tables'));
  assert('has describe_table', toolNames.includes('describe_table'));
  console.log(`  tools: ${toolNames.join(', ')}`);
}

async function testListTables(client) {
  console.log('\n── 3. List Tables ──');
  const result = await call(client, 'list_tables');
  const text = result.content?.[0]?.text || '';
  assert('response has content text', text.length > 0);
  assert('contains asset_templates', text.includes('asset_templates'));
  assert('contains asset_instances', text.includes('asset_instances'));
  console.log(`  ${text.split('\n')[0]}`);
}

async function testQueryTemplate(client) {
  console.log('\n── 4. Query PostgreSQL Template ──');
  const result = await call(client, 'query_database', {
    sql: "SELECT id, name, category FROM asset_templates WHERE name ILIKE '%postgres%'"
  });
  const text = result.content?.[0]?.text || '';
  const rows = JSON.parse(text);
  assert('PostgreSQL template found', rows.length > 0);
  assert('template id is tmpl-db-001', rows[0]?.id === 'tmpl-db-001');
  console.log(`  template: ${rows[0]?.id} — ${rows[0]?.name} (${rows[0]?.category})`);
}

async function testRegisterAssets(client) {
  console.log('\n── 5. Register Database Assets ──');

  if (DB_REGISTRY.length === 0) {
    console.log('  ⏭  SKIP — no DB_REGISTRY entries. Populate DB_REGISTRY or provide db_info.md');
    return;
  }

  let registered = 0;
  for (const db of DB_REGISTRY) {
    const assetId = `ast-db-${String(registered + 1).padStart(3, '0')}`;
    try {
      await call(client, 'query_database', {
        sql: `INSERT INTO asset_instances (id, template_id, name, description, attributes, tags)
              VALUES ($1, 'tmpl-db-001', $2, $3, $4::jsonb, $5::text[])
              ON CONFLICT (id) DO NOTHING`,
        params: [
          assetId,
          db.name,
          db.description || '',
          JSON.stringify({
            version: db.version || '16',
            host: db.host,
            port: db.port,
            rw_user: db.rw_user,
            ro_user: db.ro_user,
            description: db.description || '',
            connectionString: `jdbc:postgresql://${db.host}:${db.port}/${db.name}`
          }),
          `{${(db.tags || ['database', 'postgresql']).join(',')}}`
        ]
      });
      console.log(`  ✅ ${assetId} — ${db.name}`);
      registered++;
    } catch (err) {
      console.error(`  ❌ ${assetId} — ${db.name}: ${err.message}`);
      failed++;
    }
  }
  assert(`registered ${registered} database(s)`, registered === DB_REGISTRY.length);
}

async function testVerifyAssets(client) {
  console.log('\n── 6. Verify Registered Assets ──');
  const result = await call(client, 'query_database', {
    sql: "SELECT id, name, current_state, attributes->>'host' AS host FROM asset_instances ORDER BY name"
  });
  const text = result.content?.[0]?.text || '';
  const rows = JSON.parse(text);
  console.log(`  found ${rows.length} asset(s):`);
  for (const r of rows) {
    console.log(`    • ${r.id}  ${r.name}  state=${r.current_state}  host=${r.host || '-'}`);
  }
  if (DB_REGISTRY.length > 0) {
    assert(`all ${DB_REGISTRY.length} databases registered`, rows.length >= DB_REGISTRY.length);
  } else {
    console.log('  ⏭  SKIP assertion (no DB_REGISTRY)');
  }
}

// ── Main ──

async function main() {
  console.log(`⸻⸻⸻ OpenCMDB MCP E2E Test ⸻⸻⸻`);
  console.log(`Server: ${MCP_URL}`);
  console.log(`Mode:   ${SHOULD_REGISTER ? 'connect + register' : 'connect only'}`);
  if (DB_REGISTRY.length > 0) {
    console.log(`DBs:    ${DB_REGISTRY.length} database(s) to register`);
  } else {
    console.log(`DBs:    (none — set DB_REGISTRY or provide db_info.md)`);
  }

  const client = await connect();

  await testConnectivity(client);
  await testListTools(client);
  await testListTables(client);
  await testQueryTemplate(client);

  if (SHOULD_REGISTER) {
    await testRegisterAssets(client);
    await testVerifyAssets(client);
  }

  // ── Summary ──
  console.log(`\n⸻⸻⸻ Results ⸻⸻⸻`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n❌ Fatal: ${err.message}`);
  if (err.cause) console.error(`  cause: ${err.cause.message}`);
  process.exit(1);
});
