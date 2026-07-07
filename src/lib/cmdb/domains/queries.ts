// ═══════════════════════════════════════════════════════════
// Domain Query Options — Query key factories + queryOptions
// ═══════════════════════════════════════════════════════════

import { queryOptions } from '@tanstack/react-query';
import type { Domain, DomainFilters } from './types';

export type { Domain, DomainFilters };

// ──────────── Query Keys ────────────

export const domainKeys = {
  all: ['domains'] as const,
  list: (filters: DomainFilters) => [...domainKeys.all, 'list', filters] as const,
  detail: (id: string) => [...domainKeys.all, 'detail', id] as const,
  summary: () => [...domainKeys.all, 'summary'] as const
};

export const domainsQueryOptions = (filters: DomainFilters) =>
  queryOptions({
    queryKey: domainKeys.list(filters),
    queryFn: async () => {
      const { getDomains } = await import('./service');
      return getDomains(filters);
    }
  });

export const domainByIdOptions = (id: string) =>
  queryOptions({
    queryKey: domainKeys.detail(id),
    queryFn: async () => {
      const { getDomainById } = await import('./service');
      return getDomainById(id);
    }
  });

export const domainSummaryOptions = () =>
  queryOptions({
    queryKey: domainKeys.summary(),
    queryFn: async () => {
      const { getDomainSummary } = await import('./service');
      return getDomainSummary();
    }
  });
