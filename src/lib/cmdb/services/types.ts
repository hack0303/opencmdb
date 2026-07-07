// ═══════════════════════════════════════════════════════════
// Service Type Contracts — Layer 2: Service / Bounded Context
// ═══════════════════════════════════════════════════════════
// A Service is a bounded context that wraps assets with
// semantic meaning. It provides the semantic abstraction
// layer that reduces AI token consumption.
// ═══════════════════════════════════════════════════════════

export type SemanticRole = {
  role: string;
  description: string;
};

export type Service = {
  id: string;
  name: string;
  description: string;
  domainId: string;
  tags: string[];
  semanticRoles: SemanticRole[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ServiceWithDetails = Service & {
  domainName?: string;
  assetCount?: number;
  links?: {
    asSource: { targetId: string; targetName: string; type: string; label: string }[];
    asTarget: { sourceId: string; sourceName: string; type: string; label: string }[];
  };
  assets?: {
    id: string;
    name: string;
    templateId: string;
    templateName: string;
    currentState: string;
  }[];
};

export type ServiceFilters = {
  page?: number;
  limit?: number;
  search?: string;
  domainId?: string;
  tag?: string;
  sort?: string;
};

export type ServicesResponse = {
  items: Service[];
  total_items: number;
};

export type ServiceMutationPayload = {
  name: string;
  description: string;
  domainId: string;
  tags: string[];
  semanticRoles: SemanticRole[];
  sortOrder?: number;
};
