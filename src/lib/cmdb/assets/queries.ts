// ═══════════════════════════════════════════════════════════
// Asset Query Options — Query key factories + queryOptions
// ═══════════════════════════════════════════════════════════

import { queryOptions } from '@tanstack/react-query';
import type { AssetTemplate, AssetInstance, TemplateFilters, AssetFilters } from './types';

export type { AssetTemplate, AssetInstance };

// ──────────── Template Keys ────────────

export const templateKeys = {
  all: ['asset-templates'] as const,
  list: (filters: TemplateFilters) => [...templateKeys.all, 'list', filters] as const,
  detail: (id: string) => [...templateKeys.all, 'detail', id] as const
};

export const templatesQueryOptions = (filters: TemplateFilters) =>
  queryOptions({
    queryKey: templateKeys.list(filters),
    queryFn: async () => {
      const { getTemplates } = await import('./service');
      return getTemplates(filters);
    }
  });

export const templateByIdOptions = (id: string) =>
  queryOptions({
    queryKey: templateKeys.detail(id),
    queryFn: async () => {
      const { getTemplateById } = await import('./service');
      return getTemplateById(id);
    }
  });

// ──────────── Asset Instance Keys ────────────

export const assetKeys = {
  all: ['assets'] as const,
  list: (filters: AssetFilters) => [...assetKeys.all, 'list', filters] as const,
  detail: (id: string) => [...assetKeys.all, 'detail', id] as const
};

export const assetsQueryOptions = (filters: AssetFilters) =>
  queryOptions({
    queryKey: assetKeys.list(filters),
    queryFn: async () => {
      const { getAssets } = await import('./service');
      return getAssets(filters);
    }
  });

export const assetByIdOptions = (id: string) =>
  queryOptions({
    queryKey: assetKeys.detail(id),
    queryFn: async () => {
      const { getAssetById } = await import('./service');
      return getAssetById(id);
    }
  });

// ──────────── AI-oriented Query ────────────

export const capabilityQueryOptions = (query: string) =>
  queryOptions({
    queryKey: [...assetKeys.all, 'capability-query', query] as const,
    queryFn: async () => {
      const { queryByCapability } = await import('./service');
      return queryByCapability(query);
    }
  });

export const allTagsOptions = () =>
  queryOptions({
    queryKey: [...assetKeys.all, 'tags'] as const,
    queryFn: async () => {
      const { getAllTags } = await import('./service');
      return getAllTags();
    }
  });
