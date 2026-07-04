// ═══════════════════════════════════════════════════════════
// Asset Type Contracts — Dynamic Meta-Model
// ═══════════════════════════════════════════════════════════

export type {
  AssetTemplate,
  AssetInstance,
  SchemaProperty,
  CapabilityDefinition,
  StateMapping
} from '@/constants/mock-api-assets';

// ─────────────────────────────
// Template Filters & Response
// ─────────────────────────────

export type TemplateFilters = {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sort?: string;
};

export type TemplatesResponse = {
  items: import('@/constants/mock-api-assets').AssetTemplate[];
  total_items: number;
};

export type TemplateMutationPayload = {
  name: string;
  category: string;
  description: string;
  schema: {
    type: 'object';
    properties: Record<string, import('@/constants/mock-api-assets').SchemaProperty>;
    required?: string[];
  };
  defaultStateMapping: {
    states: string[];
    initialState: string;
    conditions?: Record<string, string>;
  };
  defaultCapabilities: {
    name: string;
    description: string;
    endpoint?: string;
    method?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
  }[];
  tags: string[];
};

// ─────────────────────────────
// Asset Filters & Response
// ─────────────────────────────

export type AssetFilters = {
  page?: number;
  limit?: number;
  search?: string;
  templateId?: string;
  state?: string;
  tag?: string;
  sort?: string;
};

export type AssetsResponse = {
  items: import('@/constants/mock-api-assets').AssetInstance[];
  total_items: number;
};

export type AssetMutationPayload = {
  templateId: string;
  name: string;
  description: string;
  attributes: Record<string, unknown>;
  stateMapping: {
    states: string[];
    initialState: string;
    conditions?: Record<string, string>;
  };
  currentState: string;
  capabilities: {
    name: string;
    description: string;
    endpoint?: string;
    method?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
  }[];
  tags: string[];
};
