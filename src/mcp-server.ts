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

const assetService = require('./lib/cmdb/assets/service');
const domainService = require('./lib/cmdb/domains/service');
const serviceService = require('./lib/cmdb/services/service');

// ─── Tool Definitions ───
//   5 groups: Domain · Service · Asset · Template · Database Utilities · Migration

const tools: Tool[] = [
  // ═══════════ Domain Management ═══════════

  {
    name: 'get_domains',
    description:
      'List business domains with optional search. Returns JSON with items and total_items.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search in name, description, tags' },
        tag: { type: 'string', description: 'Filter by tag' },
        limit: { type: 'number', description: 'Max results (default 50)' }
      }
    }
  },
  {
    name: 'get_domain',
    description: 'Get a single domain by ID with full details (topology graph, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Domain ID (e.g. sub-...)' }
      },
      required: ['id']
    }
  },
  {
    name: 'domain_ai_view',
    description:
      'Get an AI-optimized YAML summary of a domain — includes description, tags, service count, topology links. Minimizes token usage.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Domain ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_domain',
    description:
      'Create a new business domain. Provide name, description, optional tags, topology_data, sort_order.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Domain name (e.g. C-Land Base Domain)' },
        description: { type: 'string', description: 'What this domain covers' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional classification tags'
        },
        topology_data: {
          type: 'object',
          description: 'Optional topology graph: { description, nodes, edges }'
        },
        sort_order: {
          type: 'number',
          description: 'Optional sort order (default 0)'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'update_domain',
    description: 'Update an existing domain. Only provided fields are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Domain ID to update' },
        name: { type: 'string' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        topology_data: { type: 'object' },
        sort_order: { type: 'number' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_domain',
    description: 'Delete a domain by ID (soft-delete).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Domain ID to delete' }
      },
      required: ['id']
    }
  },

  // ═══════════ Service Management ═══════════

  {
    name: 'get_services',
    description:
      'List services (bounded contexts) with optional filters. Returns JSON with items and total_items.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search in name, description, tags' },
        domain_id: { type: 'string', description: 'Filter by domain ID' },
        tag: { type: 'string', description: 'Filter by tag' },
        limit: { type: 'number', description: 'Max results (default 50)' }
      }
    }
  },
  {
    name: 'get_service',
    description: 'Get a single service by ID with full details (domain name, assets, links).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Service ID (e.g. svc-...)' }
      },
      required: ['id']
    }
  },
  {
    name: 'service_ai_view',
    description:
      'Get an AI-optimized YAML summary of a service — includes description, domain, tags, semantic roles, bound assets, topology links. Minimizes token usage.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Service ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_service',
    description:
      'Create a new service (bounded context) under a domain. Provide name, domain_id, optional description, tags, semantic_roles, sort_order.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Service name (e.g. cland-user-service)' },
        domain_id: { type: 'string', description: 'Parent domain ID' },
        description: { type: 'string', description: 'What this bounded context does' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional classification tags'
        },
        semantic_roles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              description: { type: 'string' }
            }
          },
          description: 'Optional semantic role definitions'
        },
        sort_order: {
          type: 'number',
          description: 'Optional sort order (default 0)'
        }
      },
      required: ['name', 'domain_id']
    }
  },
  {
    name: 'update_service',
    description: 'Update an existing service. Only provided fields are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Service ID to update' },
        name: { type: 'string' },
        description: { type: 'string' },
        domain_id: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        semantic_roles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              description: { type: 'string' }
            }
          }
        },
        sort_order: { type: 'number' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_service',
    description: 'Delete a service by ID (soft-delete).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Service ID to delete' }
      },
      required: ['id']
    }
  },
  {
    name: 'bind_asset_to_service',
    description:
      'Bind an existing asset to a service. Provide service_id, asset_id, optional binding_type, semantic_role, metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'Service ID (e.g. svc-...)' },
        asset_id: { type: 'string', description: 'Asset ID (e.g. ast-db-001)' },
        binding_type: {
          type: 'string',
          description: 'Optional binding type (e.g. primary, replica)'
        },
        semantic_role: {
          type: 'string',
          description: 'Optional semantic role (e.g. data_store, compute)'
        }
      },
      required: ['service_id', 'asset_id']
    }
  },
  {
    name: 'set_root_binding',
    description:
      'Set an asset as the root/primary asset for a service. Provide service_id and asset_id. The root asset appears first in the service topology.',
    inputSchema: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'Service ID' },
        asset_id: { type: 'string', description: 'Asset ID to set as root' }
      },
      required: ['service_id', 'asset_id']
    }
  },
  {
    name: 'add_link',
    description:
      'Add a topology link (edge) between two services within a domain. Provide domain_id, source_svc_id, target_svc_id, link_type, label.',
    inputSchema: {
      type: 'object',
      properties: {
        domain_id: { type: 'string', description: 'Domain ID that owns this edge' },
        source_svc_id: { type: 'string', description: 'Source service ID' },
        target_svc_id: { type: 'string', description: 'Target service ID' },
        link_type: {
          type: 'string',
          description: 'One of: sync, async_command, async_event'
        },
        label: { type: 'string', description: 'Human-readable label (e.g. grpc, kafka topic)' }
      },
      required: ['domain_id', 'source_svc_id', 'target_svc_id', 'link_type', 'label']
    }
  },
  {
    name: 'remove_links',
    description:
      'Remove one or more topology links by ID. Provide a domain_id and an array of link_ids.',
    inputSchema: {
      type: 'object',
      properties: {
        domain_id: { type: 'string', description: 'Domain ID that owns these links' },
        link_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of link IDs to delete'
        }
      },
      required: ['domain_id', 'link_ids']
    }
  },
  {
    name: 'add_links',
    description:
      'Batch add multiple topology links at once. Provide an array of link objects, each with domain_id, source_svc_id, target_svc_id, link_type, label.',
    inputSchema: {
      type: 'object',
      properties: {
        links: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              domain_id: { type: 'string' },
              source_svc_id: { type: 'string' },
              target_svc_id: { type: 'string' },
              link_type: {
                type: 'string',
                description: 'One of: sync, async_command, async_event'
              },
              label: { type: 'string' }
            },
            required: ['domain_id', 'source_svc_id', 'target_svc_id', 'link_type', 'label']
          },
          minItems: 1
        }
      },
      required: ['links']
    }
  },

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
  }

  // ═══════════ Migration ═══════════
];

// ─── Tool Handlers — delegate to service.ts ───

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    // ── Domain Management ──

    case 'get_domains': {
      try {
        const filters: Record<string, unknown> = {
          page: 1,
          limit: Math.min(Math.max(+(args.limit ?? 50), 1), 200)
        };
        if (args.search) filters.search = args.search;
        const result = await domainService.getDomains(filters as any);
        return JSON.stringify(result, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'get_domain': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const domain = await domainService.getDomainById(id);
        return domain ? JSON.stringify(domain, null, 2) : `❌ Domain "${id}" not found.`;
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'domain_ai_view': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const domain = await domainService.getDomainById(id);
        if (!domain) return `❌ Domain "${id}" not found.`;
        const services = await domainService.getDomains({ limit: 1 });
        const svcCount = services.total_items;
        const linkCount = (domain as any).topologyData?.edges?.length ?? 0;
        const lines: string[] = [];
        lines.push('domain:');
        lines.push(`  name: "${domain.name}"`);
        lines.push(`  description: "${domain.description}"`);
        lines.push(`  tags: [${domain.tags.map((t: string) => `"${t}"`).join(', ')}]`);
        lines.push(`  services: ${svcCount}`);
        lines.push(`  topology_links: ${linkCount}`);
        const topo = (domain as any).topologyData;
        if (topo?.edges?.length > 0) {
          lines.push('  links:');
          for (const e of topo.edges) {
            lines.push(`    - source: "${e.source}"`);
            lines.push(`      target: "${e.target}"`);
            lines.push(`      type: ${e.type}`);
            if (e.label) lines.push(`      label: "${e.label}"`);
          }
        }
        return lines.join('\n');
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'create_domain': {
      const name = args.name as string;
      if (!name) return '❌ name is required.';
      try {
        const payload: Record<string, unknown> = {
          name,
          description: (args.description as string) || '',
          tags: (args.tags as string[]) || [],
          topologyData: (args.topology_data as Record<string, unknown>) || {
            description: '',
            nodes: [],
            edges: []
          },
          sortOrder: (args.sort_order as number) ?? 0
        };
        const domain = await domainService.createDomain(payload as any);
        return JSON.stringify({ id: domain.id, name: domain.name, status: 'created' }, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'update_domain': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const payload: Record<string, unknown> = {};
        if (args.name !== undefined) payload.name = args.name;
        if (args.description !== undefined) payload.description = args.description;
        if (args.tags !== undefined) payload.tags = args.tags;
        if (args.topology_data !== undefined) payload.topologyData = args.topology_data;
        if (args.sort_order !== undefined) payload.sortOrder = args.sort_order;
        const domain = await domainService.updateDomain(id, payload as any);
        return domain
          ? JSON.stringify({ id: domain.id, status: 'updated' }, null, 2)
          : `❌ Domain "${id}" not found.`;
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'delete_domain': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        await domainService.deleteDomain(id);
        return JSON.stringify({ id, status: 'deleted' }, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    // ── Service Management ──

    case 'get_services': {
      try {
        const filters: Record<string, unknown> = {
          page: 1,
          limit: Math.min(Math.max(+(args.limit ?? 50), 1), 200)
        };
        if (args.search) filters.search = args.search;
        if (args.domain_id) filters.domainId = args.domain_id;
        if (args.tag) filters.tag = args.tag;
        const result = await serviceService.getServices(filters as any);
        return JSON.stringify(result, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'get_service': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const svc = await serviceService.getServiceById(id);
        return svc ? JSON.stringify(svc, null, 2) : `❌ Service "${id}" not found.`;
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'service_ai_view': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const svc = await serviceService.getServiceById(id);
        if (!svc) return `❌ Service "${id}" not found.`;
        const lines: string[] = [];
        lines.push('service:');
        lines.push(`  name: "${svc.name}"`);
        lines.push(`  description: "${svc.description}"`);
        lines.push(`  domain: "${(svc as any).domainName ?? (svc as any).domainId}"`);
        lines.push(`  tags: [${(svc.tags || []).map((t: string) => `"${t}"`).join(', ')}]`);
        const roles = (svc as any).semanticRoles || [];
        if (roles.length > 0) {
          lines.push('  semantic_roles:');
          for (const r of roles) {
            lines.push(`    - role: "${r.role}"`);
            lines.push(`      description: "${r.description}"`);
          }
        }
        const assets = (svc as any).assets || [];
        if (assets.length > 0) {
          lines.push('  bound_assets:');
          for (const a of assets) {
            lines.push(`    - name: "${a.name}"`);
            lines.push(`      type: "${a.templateName}"`);
            lines.push(`      state: ${a.currentState}`);
          }
        }
        const links = (svc as any).links;
        if (links) {
          if (links.asSource?.length > 0) {
            lines.push('  outgoing_links:');
            for (const l of links.asSource) {
              lines.push(`    - target: "${l.targetName}"`);
              lines.push(`      type: ${l.type}`);
              if (l.label) lines.push(`      label: "${l.label}"`);
            }
          }
          if (links.asTarget?.length > 0) {
            lines.push('  incoming_links:');
            for (const l of links.asTarget) {
              lines.push(`    - source: "${l.sourceName}"`);
              lines.push(`      type: ${l.type}`);
              if (l.label) lines.push(`      label: "${l.label}"`);
            }
          }
        }
        return lines.join('\n');
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'create_service': {
      const name = args.name as string;
      const domainId = args.domain_id as string;
      if (!name || !domainId) return '❌ name and domain_id are required.';
      try {
        const payload: Record<string, unknown> = {
          name,
          domainId,
          description: (args.description as string) || '',
          tags: (args.tags as string[]) || [],
          semanticRoles: (args.semantic_roles as Record<string, unknown>[]) || [],
          sortOrder: (args.sort_order as number) ?? 0
        };
        const svc = await serviceService.createService(payload as any);
        return JSON.stringify({ id: svc.id, name: svc.name, status: 'created' }, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'update_service': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const payload: Record<string, unknown> = {};
        if (args.name !== undefined) payload.name = args.name;
        if (args.description !== undefined) payload.description = args.description;
        if (args.domain_id !== undefined) payload.domainId = args.domain_id;
        if (args.tags !== undefined) payload.tags = args.tags;
        if (args.semantic_roles !== undefined) payload.semanticRoles = args.semantic_roles;
        if (args.sort_order !== undefined) payload.sortOrder = args.sort_order;
        const svc = await serviceService.updateService(id, payload as any);
        return svc
          ? JSON.stringify({ id: svc.id, status: 'updated' }, null, 2)
          : `❌ Service "${id}" not found.`;
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'delete_service': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        await serviceService.deleteService(id);
        return JSON.stringify({ id, status: 'deleted' }, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'bind_asset_to_service': {
      const serviceId = args.service_id as string;
      const assetId = args.asset_id as string;
      if (!serviceId || !assetId) return '❌ service_id and asset_id are required.';
      try {
        const payload: Record<string, unknown> = {
          serviceId,
          assetId
        };
        if (args.binding_type) payload.bindingType = args.binding_type;
        if (args.semantic_role) payload.semanticRole = args.semantic_role;
        await serviceService.bindAssetToService(payload as any);
        return JSON.stringify(
          { service_id: serviceId, asset_id: assetId, status: 'bound' },
          null,
          2
        );
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'set_root_binding': {
      const serviceId = args.service_id as string;
      const assetId = args.asset_id as string;
      if (!serviceId || !assetId) return '❌ service_id and asset_id are required.';
      try {
        await serviceService.setRootBinding(serviceId, assetId);
        return JSON.stringify(
          { service_id: serviceId, asset_id: assetId, status: 'root_set' },
          null,
          2
        );
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'add_link': {
      const domainId = args.domain_id as string;
      const sourceSvcId = args.source_svc_id as string;
      const targetSvcId = args.target_svc_id as string;
      const linkType = args.link_type as string;
      const label = args.label as string;
      if (!domainId || !sourceSvcId || !targetSvcId || !linkType || !label) {
        return '❌ domain_id, source_svc_id, target_svc_id, link_type, and label are required.';
      }
      if (!['sync', 'async_command', 'async_event'].includes(linkType)) {
        return '❌ link_type must be one of: sync, async_command, async_event';
      }
      try {
        await serviceService.createServiceLink({
          domainId,
          sourceSvcId,
          targetSvcId,
          linkType: linkType as 'sync' | 'async_command' | 'async_event',
          label
        });
        return JSON.stringify(
          {
            source_svc_id: sourceSvcId,
            target_svc_id: targetSvcId,
            link_type: linkType,
            status: 'created'
          },
          null,
          2
        );
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'remove_links': {
      const domainId = args.domain_id as string;
      const linkIds = args.link_ids as string[];
      if (!domainId || !Array.isArray(linkIds) || linkIds.length === 0) {
        return '❌ domain_id and link_ids array are required.';
      }
      try {
        let count = 0;
        for (const linkId of linkIds) {
          await serviceService.deleteServiceLink(linkId, domainId);
          count++;
        }
        return JSON.stringify({ count, status: 'deleted' }, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'add_links': {
      const links = args.links as Record<string, unknown>[];
      if (!Array.isArray(links) || links.length === 0) {
        return '❌ links array is required with at least one item.';
      }
      try {
        const items = links.map((l) => {
          const lt = l.link_type as string;
          if (!['sync', 'async_command', 'async_event'].includes(lt)) {
            throw new Error(
              `Invalid link_type "${lt}". Must be sync, async_command, or async_event.`
            );
          }
          return {
            domainId: l.domain_id as string,
            sourceSvcId: l.source_svc_id as string,
            targetSvcId: l.target_svc_id as string,
            linkType: lt as 'sync' | 'async_command' | 'async_event',
            label: (l.label as string) || ''
          };
        });
        const count = await serviceService.createServiceLinks(items);
        return JSON.stringify({ count, status: 'created' }, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    // ── Asset Management ──

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
        const result = await assetService.getAssets(filters as any);
        return JSON.stringify(result, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'get_asset': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const asset = await assetService.getAssetById(id);
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
        const tmpl = await assetService.getTemplateById(templateId);
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
        const asset = await assetService.createAsset(payload as any);
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
        const asset = await assetService.updateAsset(id, payload as any);
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
        await assetService.deleteAsset(id);
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
        const result = await assetService.getTemplates(filters as any);
        return JSON.stringify(result, null, 2);
      } catch (err: any) {
        return `❌ ${err.message}`;
      }
    }

    case 'get_template': {
      const id = args.id as string;
      if (!id) return '❌ id is required.';
      try {
        const tmpl = await assetService.getTemplateById(id);
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
        const tmpl = await assetService.createTemplate(payload as any);
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
        const tmpl = await assetService.updateTemplate(id, payload as any);
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
        await assetService.deleteTemplate(id);
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
