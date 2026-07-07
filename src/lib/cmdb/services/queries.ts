// ═══════════════════════════════════════════════════════════
// Service Query Options — Query key factories + queryOptions
// ═══════════════════════════════════════════════════════════

import { queryOptions } from '@tanstack/react-query';
import type { Service, ServiceWithDetails, ServiceFilters } from './types';

export type { Service, ServiceWithDetails, ServiceFilters };

// ──────────── Query Keys ────────────

export const serviceKeys = {
  all: ['services'] as const,
  list: (filters: ServiceFilters) => [...serviceKeys.all, 'list', filters] as const,
  detail: (id: string) => [...serviceKeys.all, 'detail', id] as const
};

export const servicesQueryOptions = (filters: ServiceFilters) =>
  queryOptions({
    queryKey: serviceKeys.list(filters),
    queryFn: async () => {
      const { getServices } = await import('./service');
      return getServices(filters);
    }
  });

export const serviceByIdOptions = (id: string) =>
  queryOptions({
    queryKey: serviceKeys.detail(id),
    queryFn: async () => {
      const { getServiceById } = await import('./service');
      return getServiceById(id);
    }
  });
