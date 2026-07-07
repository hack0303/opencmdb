// ═══════════════════════════════════════════════════════════
// Domain Type Contracts — Layer 1: Business Domain
// ═══════════════════════════════════════════════════════════
// A Domain is a macro business boundary slice that groups
// services by business capability. It contains the complete
// service topology graph (sync/async relationships).
// ═══════════════════════════════════════════════════════════

export type TopologyNode = {
  id: string;
  label: string;
  type: 'service' | 'external';
  role?: string;
};

export type TopologyEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  type: 'sync' | 'async_command' | 'async_event';
  metadata?: Record<string, unknown>;
};

export type TopologyData = {
  description: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
};

export type Domain = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  topologyData: TopologyData;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type DomainFilters = {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
  sort?: string;
};

export type DomainsResponse = {
  items: Domain[];
  total_items: number;
};

export type DomainMutationPayload = {
  name: string;
  description: string;
  tags: string[];
  topologyData: TopologyData;
  sortOrder?: number;
};
