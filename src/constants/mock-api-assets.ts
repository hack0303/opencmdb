////////////////////////////////////////////////////////////////////////////////
// Mock API — Asset Templates & Instances (Dynamic Meta-Model)
////////////////////////////////////////////////////////////////////////////////

import { matchSorter } from 'match-sorter';

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type SchemaProperty = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  title?: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  required?: boolean;
};

export type CapabilityDefinition = {
  name: string;
  description: string;
  endpoint?: string;
  method?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
};

export type StateMapping = {
  states: string[];
  initialState: string;
  conditions?: Record<string, string>;
};

export type AssetTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  schema: {
    type: 'object';
    properties: Record<string, SchemaProperty>;
    required?: string[];
  };
  defaultStateMapping: StateMapping;
  defaultCapabilities: CapabilityDefinition[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type AssetInstance = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  attributes: Record<string, unknown>;
  stateMapping: StateMapping;
  currentState: string;
  capabilities: CapabilityDefinition[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

// ──────────────────────────────────────────────
// Seed Templates
// ──────────────────────────────────────────────

const seedTemplates: AssetTemplate[] = [
  {
    id: 'tmpl-srv-001',
    name: 'Quarkus Microservice',
    category: 'software',
    description: 'Quarkus-based Java microservice with REST API',
    schema: {
      type: 'object',
      properties: {
        version: { type: 'string', title: 'Runtime Version', description: 'e.g. Java 21, Java 25' },
        port: { type: 'number', title: 'Service Port', description: 'HTTP listen port' },
        apiPrefix: { type: 'string', title: 'API Prefix', description: 'e.g. /api/v1' },
        upstreamDeps: {
          type: 'string',
          title: 'Upstream Dependencies',
          description: 'Comma-separated upstream services'
        }
      },
      required: ['version', 'port']
    },
    defaultStateMapping: {
      states: ['BOOTING', 'RUNNING', 'DEGRADED', 'STOPPED'],
      initialState: 'BOOTING',
      conditions: {
        RUNNING: 'health === "ok" && uptime > 30',
        DEGRADED: 'health === "degraded"',
        STOPPED: 'health === "down"'
      }
    },
    defaultCapabilities: [
      {
        name: 'health_check',
        description: 'Check service health status',
        method: 'GET',
        endpoint: '/health',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { status: { type: 'string' } } }
      },
      {
        name: 'metrics',
        description: 'Fetch Prometheus metrics',
        method: 'GET',
        endpoint: '/metrics',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { data: { type: 'string' } } }
      }
    ],
    tags: ['service', 'java', 'quarkus', 'microservice'],
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: '2025-06-20T10:30:00Z'
  },
  {
    id: 'tmpl-hw-001',
    name: 'GPU Compute Node',
    category: 'hardware',
    description: 'NVIDIA GPU server for AI/ML workloads',
    schema: {
      type: 'object',
      properties: {
        cpu: { type: 'string', title: 'CPU Spec', description: 'e.g. 32c 64t' },
        ram: { type: 'string', title: 'Memory', description: 'e.g. 256GB DDR5' },
        gpu: { type: 'string', title: 'GPU Model', description: 'e.g. Tesla P40, A100' },
        gpuCount: { type: 'number', title: 'GPU Count' },
        ipmiAddr: {
          type: 'string',
          title: 'IPMI Address',
          description: 'Out-of-band management IP'
        },
        location: {
          type: 'string',
          title: 'Physical Location',
          description: 'Rack, row, datacenter'
        }
      },
      required: ['cpu', 'gpu', 'ipmiAddr']
    },
    defaultStateMapping: {
      states: ['OFFLINE', 'ONLINE', 'DEGRADED', 'MAINTENANCE'],
      initialState: 'OFFLINE',
      conditions: {
        ONLINE: 'power === "on" && nvidia_smi_ok === true',
        DEGRADED: 'power === "on" && nvidia_smi_ok === false',
        MAINTENANCE: 'power === "on" && maintenance_mode === true'
      }
    },
    defaultCapabilities: [
      {
        name: 'power_off',
        description: 'Gracefully power off the node',
        inputSchema: { type: 'object', properties: { force: { type: 'boolean' } } },
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } }
      },
      {
        name: 'reboot',
        description: 'Reboot the compute node',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } }
      },
      {
        name: 'gpu_info',
        description: 'Query GPU utilization and memory',
        method: 'GET',
        endpoint: '/nvidia-smi',
        inputSchema: {},
        outputSchema: {
          type: 'object',
          properties: {
            gpuCount: { type: 'number' },
            utilization: { type: 'number' },
            memoryUsed: { type: 'string' }
          }
        }
      }
    ],
    tags: ['hardware', 'gpu', 'compute', 'nvidia'],
    createdAt: '2025-02-01T09:00:00Z',
    updatedAt: '2025-06-18T14:00:00Z'
  },
  {
    id: 'tmpl-db-001',
    name: 'PostgreSQL Database',
    category: 'storage',
    description: 'PostgreSQL relational database instance',
    schema: {
      type: 'object',
      properties: {
        version: { type: 'string', title: 'PG Version', description: 'e.g. 15, 16' },
        connectionString: { type: 'string', title: 'JDBC Connection String' },
        maxConnections: { type: 'number', title: 'Max Connections', default: 100 },
        readReplicas: { type: 'number', title: 'Read Replica Count', default: 0 },
        storageGB: { type: 'number', title: 'Storage (GB)' }
      },
      required: ['version', 'connectionString']
    },
    defaultStateMapping: {
      states: ['PROVISIONING', 'RUNNING', 'DEGRADED', 'STOPPED'],
      initialState: 'PROVISIONING',
      conditions: {
        RUNNING: 'pg_is_ready === true && connections < maxConnections',
        DEGRADED: 'pg_is_ready === true && connections >= maxConnections * 0.9',
        STOPPED: 'pg_is_ready === false'
      }
    },
    defaultCapabilities: [
      {
        name: 'query',
        description: 'Execute a read-only SQL query',
        inputSchema: {
          type: 'object',
          properties: { sql: { type: 'string', description: 'SELECT query only' } },
          required: ['sql']
        },
        outputSchema: { type: 'object', properties: { rows: { type: 'array' } } }
      },
      {
        name: 'pg_stat',
        description: 'Fetch database statistics',
        method: 'GET',
        endpoint: '/pg_stat',
        inputSchema: {},
        outputSchema: {
          type: 'object',
          properties: {
            activeConnections: { type: 'number' },
            replicationLag: { type: 'string' },
            cacheHitRatio: { type: 'number' }
          }
        }
      }
    ],
    tags: ['database', 'postgresql', 'storage', 'sql'],
    createdAt: '2025-03-10T11:00:00Z',
    updatedAt: '2025-06-15T09:00:00Z'
  },
  {
    id: 'tmpl-gw-001',
    name: 'APISIX Gateway',
    category: 'software',
    description: 'Apache APISIX API Gateway instance',
    schema: {
      type: 'object',
      properties: {
        version: { type: 'string', title: 'APISIX Version', description: 'e.g. 3.9' },
        adminPort: { type: 'number', title: 'Admin API Port', default: 9180 },
        httpPort: { type: 'number', title: 'HTTP Proxy Port', default: 9080 },
        httpsPort: { type: 'number', title: 'HTTPS Proxy Port', default: 9443 },
        upstreamCount: { type: 'number', title: 'Configured Upstreams' }
      },
      required: ['version', 'adminPort']
    },
    defaultStateMapping: {
      states: ['INIT', 'RUNNING', 'DEGRADED', 'DOWN'],
      initialState: 'INIT',
      conditions: {
        RUNNING: 'admin_api_ok === true && routes_loaded === true',
        DEGRADED: 'admin_api_ok === true && routes_loaded === false',
        DOWN: 'admin_api_ok === false'
      }
    },
    defaultCapabilities: [
      {
        name: 'list_routes',
        description: 'List all configured routes',
        method: 'GET',
        endpoint: '/apisix/admin/routes',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { routes: { type: 'array' } } }
      },
      {
        name: 'reload',
        description: 'Hot-reload gateway configuration',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } }
      }
    ],
    tags: ['gateway', 'apisix', 'proxy', 'software'],
    createdAt: '2025-04-05T07:00:00Z',
    updatedAt: '2025-06-22T16:00:00Z'
  },
  {
    id: 'tmpl-vec-001',
    name: 'Qdrant Vector DB',
    category: 'storage',
    description: 'Qdrant vector database for embeddings',
    schema: {
      type: 'object',
      properties: {
        version: { type: 'string', title: 'Qdrant Version' },
        grpcPort: { type: 'number', title: 'gRPC Port', default: 6334 },
        httpPort: { type: 'number', title: 'HTTP Port', default: 6333 },
        collectionCount: { type: 'number', title: 'Number of Collections' },
        vectorSize: { type: 'number', title: 'Default Vector Dimension' }
      },
      required: ['version', 'httpPort']
    },
    defaultStateMapping: {
      states: ['STARTING', 'READY', 'DEGRADED', 'STOPPED'],
      initialState: 'STARTING',
      conditions: {
        READY: 'api_reachable === true && collections_loaded === true',
        DEGRADED: 'api_reachable === true && collections_loaded === false',
        STOPPED: 'api_reachable === false'
      }
    },
    defaultCapabilities: [
      {
        name: 'search',
        description: 'Search nearest vectors',
        method: 'POST',
        endpoint: '/collections/{name}/points/search',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string' },
            vector: { type: 'array', items: { type: 'number' } },
            limit: { type: 'number', default: 10 }
          },
          required: ['collection', 'vector']
        },
        outputSchema: { type: 'object', properties: { result: { type: 'array' } } }
      },
      {
        name: 'collection_stats',
        description: 'Get collection statistics',
        method: 'GET',
        endpoint: '/collections/{name}',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name']
        },
        outputSchema: {
          type: 'object',
          properties: { status: { type: 'string' }, pointsCount: { type: 'number' } }
        }
      }
    ],
    tags: ['database', 'vector', 'qdrant', 'embeddings'],
    createdAt: '2025-05-01T12:00:00Z',
    updatedAt: '2025-06-25T08:00:00Z'
  }
];

// ──────────────────────────────────────────────
// Seed Asset Instances
// ──────────────────────────────────────────────

const seedAssets: AssetInstance[] = [
  {
    id: 'ast-srv-001',
    templateId: 'tmpl-srv-001',
    name: 'cland-user-service-01',
    description: 'User management microservice — C-Land platform',
    attributes: {
      version: 'Java 21',
      port: 8080,
      apiPrefix: '/api/v1/users',
      upstreamDeps: 'cland-db-primary, cland-redis-cache'
    },
    stateMapping: {
      states: ['BOOTING', 'RUNNING', 'DEGRADED', 'STOPPED'],
      initialState: 'BOOTING',
      conditions: {
        RUNNING: 'health === "ok" && uptime > 30',
        DEGRADED: 'health === "degraded"',
        STOPPED: 'health === "down"'
      }
    },
    currentState: 'RUNNING',
    capabilities: [
      {
        name: 'health_check',
        description: 'Check service health status',
        method: 'GET',
        endpoint: '/health',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { status: { type: 'string' } } }
      },
      {
        name: 'metrics',
        description: 'Fetch Prometheus metrics',
        method: 'GET',
        endpoint: '/metrics',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { data: { type: 'string' } } }
      },
      {
        name: 'list_users',
        description: 'List all users',
        method: 'GET',
        endpoint: '/api/v1/users',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { users: { type: 'array' } } }
      }
    ],
    tags: ['service', 'user-management', 'cland', 'microservice', 'payment'],
    createdAt: '2025-04-10T08:00:00Z',
    updatedAt: '2025-07-01T12:00:00Z'
  },
  {
    id: 'ast-srv-002',
    name: 'cland-payment-service-01',
    description: 'Payment processing microservice — C-Land platform',
    templateId: 'tmpl-srv-001',
    attributes: {
      version: 'Java 25',
      port: 8081,
      apiPrefix: '/api/v1/payments',
      upstreamDeps: 'cland-db-primary, cland-account-service'
    },
    stateMapping: {
      states: ['BOOTING', 'RUNNING', 'DEGRADED', 'STOPPED'],
      initialState: 'BOOTING',
      conditions: {
        RUNNING: 'health === "ok" && uptime > 30',
        DEGRADED: 'health === "degraded"',
        STOPPED: 'health === "down"'
      }
    },
    currentState: 'RUNNING',
    capabilities: [
      {
        name: 'health_check',
        description: 'Check service health status',
        method: 'GET',
        endpoint: '/health',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { status: { type: 'string' } } }
      },
      {
        name: 'process_payment',
        description: 'Process a payment transaction',
        method: 'POST',
        endpoint: '/api/v1/payments',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            currency: { type: 'string' },
            userId: { type: 'string' }
          },
          required: ['amount', 'userId']
        },
        outputSchema: {
          type: 'object',
          properties: { transactionId: { type: 'string' }, status: { type: 'string' } }
        }
      }
    ],
    tags: ['service', 'payment', 'cland', 'microservice'],
    createdAt: '2025-04-15T09:00:00Z',
    updatedAt: '2025-07-02T10:00:00Z'
  },
  {
    id: 'ast-hw-001',
    name: 'gpu-node-ai-01',
    description: 'Primary AI training node with Tesla P40',
    templateId: 'tmpl-hw-001',
    attributes: {
      cpu: '32c 64t',
      ram: '256GB DDR5',
      gpu: 'Tesla P40',
      gpuCount: 4,
      ipmiAddr: '10.0.100.50',
      location: 'DC1-Rack12-U24'
    },
    stateMapping: {
      states: ['OFFLINE', 'ONLINE', 'DEGRADED', 'MAINTENANCE'],
      initialState: 'OFFLINE',
      conditions: {
        ONLINE: 'power === "on" && nvidia_smi_ok === true',
        DEGRADED: 'power === "on" && nvidia_smi_ok === false',
        MAINTENANCE: 'power === "on" && maintenance_mode === true'
      }
    },
    currentState: 'ONLINE',
    capabilities: [
      {
        name: 'power_off',
        description: 'Gracefully power off the node',
        inputSchema: { type: 'object', properties: { force: { type: 'boolean' } } },
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } }
      },
      {
        name: 'reboot',
        description: 'Reboot the compute node',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } }
      },
      {
        name: 'gpu_info',
        description: 'Query GPU utilization and memory',
        method: 'GET',
        endpoint: '/nvidia-smi',
        inputSchema: {},
        outputSchema: {
          type: 'object',
          properties: { utilization: { type: 'number' }, memoryUsed: { type: 'string' } }
        }
      }
    ],
    tags: ['hardware', 'gpu', 'compute', 'nvidia', 'ai-training'],
    createdAt: '2025-03-01T10:00:00Z',
    updatedAt: '2025-07-03T08:00:00Z'
  },
  {
    id: 'ast-hw-002',
    name: 'gpu-node-infer-01',
    description: 'Inference node with Tesla T4',
    templateId: 'tmpl-hw-001',
    attributes: {
      cpu: '16c 32t',
      ram: '128GB DDR5',
      gpu: 'Tesla T4',
      gpuCount: 2,
      ipmiAddr: '10.0.100.51',
      location: 'DC1-Rack12-U25'
    },
    stateMapping: {
      states: ['OFFLINE', 'ONLINE', 'DEGRADED', 'MAINTENANCE'],
      initialState: 'OFFLINE',
      conditions: {
        ONLINE: 'power === "on" && nvidia_smi_ok === true',
        DEGRADED: 'power === "on" && nvidia_smi_ok === false',
        MAINTENANCE: 'power === "on" && maintenance_mode === true'
      }
    },
    currentState: 'ONLINE',
    capabilities: [
      {
        name: 'power_off',
        description: 'Gracefully power off the node',
        inputSchema: { type: 'object', properties: { force: { type: 'boolean' } } },
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } }
      },
      {
        name: 'reboot',
        description: 'Reboot the compute node',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } }
      },
      {
        name: 'gpu_info',
        description: 'Query GPU utilization and memory',
        method: 'GET',
        endpoint: '/nvidia-smi',
        inputSchema: {},
        outputSchema: {
          type: 'object',
          properties: { utilization: { type: 'number' }, memoryUsed: { type: 'string' } }
        }
      }
    ],
    tags: ['hardware', 'gpu', 'compute', 'nvidia', 'inference'],
    createdAt: '2025-03-15T11:00:00Z',
    updatedAt: '2025-07-03T09:00:00Z'
  },
  {
    id: 'ast-db-001',
    name: 'cland-db-primary',
    description: 'Primary PostgreSQL database for C-Land platform',
    templateId: 'tmpl-db-001',
    attributes: {
      version: '16',
      connectionString: 'postgresql://cland:****@cland-db-primary:5432/cland',
      maxConnections: 200,
      readReplicas: 2,
      storageGB: 1024
    },
    stateMapping: {
      states: ['PROVISIONING', 'RUNNING', 'DEGRADED', 'STOPPED'],
      initialState: 'PROVISIONING',
      conditions: {
        RUNNING: 'pg_is_ready === true && connections < maxConnections',
        DEGRADED: 'pg_is_ready === true && connections >= maxConnections * 0.9',
        STOPPED: 'pg_is_ready === false'
      }
    },
    currentState: 'RUNNING',
    capabilities: [
      {
        name: 'query',
        description: 'Execute a read-only SQL query',
        inputSchema: {
          type: 'object',
          properties: { sql: { type: 'string', description: 'SELECT query only' } },
          required: ['sql']
        },
        outputSchema: { type: 'object', properties: { rows: { type: 'array' } } }
      },
      {
        name: 'pg_stat',
        description: 'Fetch database statistics',
        method: 'GET',
        endpoint: '/pg_stat',
        inputSchema: {},
        outputSchema: {
          type: 'object',
          properties: {
            activeConnections: { type: 'number' },
            replicationLag: { type: 'string' },
            cacheHitRatio: { type: 'number' }
          }
        }
      }
    ],
    tags: ['database', 'postgresql', 'storage', 'cland', 'primary'],
    createdAt: '2025-04-01T08:00:00Z',
    updatedAt: '2025-07-01T14:00:00Z'
  },
  {
    id: 'ast-gw-001',
    name: 'cland-gateway-prod',
    description: 'Production APISIX API Gateway',
    templateId: 'tmpl-gw-001',
    attributes: {
      version: '3.9',
      adminPort: 9180,
      httpPort: 9080,
      httpsPort: 9443,
      upstreamCount: 12
    },
    stateMapping: {
      states: ['INIT', 'RUNNING', 'DEGRADED', 'DOWN'],
      initialState: 'INIT',
      conditions: {
        RUNNING: 'admin_api_ok === true && routes_loaded === true',
        DEGRADED: 'admin_api_ok === true && routes_loaded === false',
        DOWN: 'admin_api_ok === false'
      }
    },
    currentState: 'RUNNING',
    capabilities: [
      {
        name: 'list_routes',
        description: 'List all configured routes',
        method: 'GET',
        endpoint: '/apisix/admin/routes',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { routes: { type: 'array' } } }
      },
      {
        name: 'reload',
        description: 'Hot-reload gateway configuration',
        inputSchema: {},
        outputSchema: { type: 'object', properties: { success: { type: 'boolean' } } }
      }
    ],
    tags: ['gateway', 'apisix', 'proxy', 'cland', 'production'],
    createdAt: '2025-05-01T06:00:00Z',
    updatedAt: '2025-07-02T18:00:00Z'
  },
  {
    id: 'ast-vec-001',
    name: 'cland-vector-store',
    description: 'Qdrant vector store for C-Land AI features',
    templateId: 'tmpl-vec-001',
    attributes: {
      version: '1.10',
      grpcPort: 6334,
      httpPort: 6333,
      collectionCount: 8,
      vectorSize: 768
    },
    stateMapping: {
      states: ['STARTING', 'READY', 'DEGRADED', 'STOPPED'],
      initialState: 'STARTING',
      conditions: {
        READY: 'api_reachable === true && collections_loaded === true',
        DEGRADED: 'api_reachable === true && collections_loaded === false',
        STOPPED: 'api_reachable === false'
      }
    },
    currentState: 'READY',
    capabilities: [
      {
        name: 'search',
        description: 'Search nearest vectors',
        method: 'POST',
        endpoint: '/collections/{name}/points/search',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string' },
            vector: { type: 'array', items: { type: 'number' } },
            limit: { type: 'number', default: 10 }
          },
          required: ['collection', 'vector']
        },
        outputSchema: { type: 'object', properties: { result: { type: 'array' } } }
      },
      {
        name: 'collection_stats',
        description: 'Get collection statistics',
        method: 'GET',
        endpoint: '/collections/{name}',
        inputSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name']
        },
        outputSchema: {
          type: 'object',
          properties: { status: { type: 'string' }, pointsCount: { type: 'number' } }
        }
      }
    ],
    tags: ['database', 'vector', 'qdrant', 'cland', 'embeddings'],
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2025-07-03T11:00:00Z'
  }
];

// ──────────────────────────────────────────────
// Mock Data Store
// ──────────────────────────────────────────────

let templates: AssetTemplate[] = [...seedTemplates];
let assets: AssetInstance[] = [...seedAssets];
let nextTemplateId = 100;
let nextAssetId = 100;

export const fakeAssetTemplates = {
  records: templates,

  async list(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      sort?: string;
    } = {}
  ) {
    await delay(600);
    let { page = 1, limit = 10, search, category, sort } = filters;
    let items = [...templates];

    if (category) {
      items = items.filter((t) => t.category === category);
    }

    if (search) {
      items = matchSorter(items, search, { keys: ['name', 'description', 'category'] });
    }

    if (sort) {
      try {
        const sortItems = JSON.parse(sort) as { id: string; desc: boolean }[];
        if (sortItems.length > 0) {
          const { id, desc } = sortItems[0];
          items.sort((a, b) => {
            const aVal = (a as Record<string, unknown>)[id];
            const bVal = (b as Record<string, unknown>)[id];
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              return desc ? bVal - aVal : aVal - bVal;
            }
            return desc
              ? String(bVal ?? '').localeCompare(String(aVal ?? ''))
              : String(aVal ?? '').localeCompare(String(bVal ?? ''));
          });
        }
      } catch {
        /* ignore */
      }
    }

    const total = items.length;
    const offset = (page - 1) * limit;
    const paginated = items.slice(offset, offset + limit);

    return { items: paginated, total_items: total };
  },

  async getById(id: string) {
    await delay(400);
    return templates.find((t) => t.id === id) ?? null;
  },

  async create(data: Omit<AssetTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
    await delay(800);
    const now = new Date().toISOString();
    const newTemplate: AssetTemplate = {
      ...data,
      id: `tmpl-${nextTemplateId++}`,
      createdAt: now,
      updatedAt: now
    };
    templates.push(newTemplate);
    return newTemplate;
  },

  async update(id: string, data: Partial<Omit<AssetTemplate, 'id' | 'createdAt' | 'updatedAt'>>) {
    await delay(800);
    const idx = templates.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    templates[idx] = { ...templates[idx], ...data, updatedAt: new Date().toISOString() };
    return templates[idx];
  },

  async delete(id: string) {
    await delay(500);
    const idx = templates.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    templates.splice(idx, 1);
    return true;
  },

  /** Reset to seed data (for testing) */
  reset() {
    templates = [...seedTemplates];
  }
};

export const fakeAssets = {
  records: assets,

  async list(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      templateId?: string;
      state?: string;
      tag?: string;
      sort?: string;
    } = {}
  ) {
    await delay(600);
    let { page = 1, limit = 10, search, templateId, state, tag, sort } = filters;
    let items = [...assets];

    if (templateId) items = items.filter((a) => a.templateId === templateId);
    if (state) items = items.filter((a) => a.currentState === state);
    if (tag) items = items.filter((a) => a.tags.includes(tag));

    if (search) {
      items = matchSorter(items, search, { keys: ['name', 'description', 'tags'] });
    }

    if (sort) {
      try {
        const sortItems = JSON.parse(sort) as { id: string; desc: boolean }[];
        if (sortItems.length > 0) {
          const { id, desc } = sortItems[0];
          items.sort((a, b) => {
            const aVal = (a as Record<string, unknown>)[id];
            const bVal = (b as Record<string, unknown>)[id];
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              return desc ? bVal - aVal : aVal - bVal;
            }
            return desc
              ? String(bVal ?? '').localeCompare(String(aVal ?? ''))
              : String(aVal ?? '').localeCompare(String(bVal ?? ''));
          });
        }
      } catch {
        /* ignore */
      }
    }

    const total = items.length;
    const offset = (page - 1) * limit;
    const paginated = items.slice(offset, offset + limit);

    return { items: paginated, total_items: total };
  },

  async getById(id: string) {
    await delay(400);
    return assets.find((a) => a.id === id) ?? null;
  },

  async create(data: Omit<AssetInstance, 'id' | 'createdAt' | 'updatedAt'>) {
    await delay(800);
    const now = new Date().toISOString();
    const newAsset: AssetInstance = {
      ...data,
      id: `ast-${nextAssetId++}`,
      createdAt: now,
      updatedAt: now
    };
    assets.push(newAsset);
    return newAsset;
  },

  async update(id: string, data: Partial<Omit<AssetInstance, 'id' | 'createdAt' | 'updatedAt'>>) {
    await delay(800);
    const idx = assets.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    assets[idx] = { ...assets[idx], ...data, updatedAt: new Date().toISOString() };
    return assets[idx];
  },

  async delete(id: string) {
    await delay(500);
    const idx = assets.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    assets.splice(idx, 1);
    return true;
  },

  /** Capability-based query — find assets by capability name or tag */
  async queryByCapability(query: string) {
    await delay(300);
    const q = query.toLowerCase();
    return assets.filter(
      (a) =>
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.capabilities.some(
          (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
        )
    );
  },

  /** All distinct tags across assets */
  async getAllTags() {
    await delay(200);
    const tagSet = new Set<string>();
    assets.forEach((a) => a.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).toSorted();
  },

  reset() {
    assets = [...seedAssets];
  }
};

// Initialize
fakeAssetTemplates.records = [...seedTemplates];
fakeAssets.records = [...seedAssets];
