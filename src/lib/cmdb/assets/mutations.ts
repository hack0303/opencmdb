// ═══════════════════════════════════════════════════════════
// Asset Mutation Options — mutationOptions + key invalidation
// ═══════════════════════════════════════════════════════════

import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createAsset,
  updateAsset,
  deleteAsset
} from './service';
import { templateKeys, assetKeys } from './queries';
import type { TemplateMutationPayload, AssetMutationPayload } from './types';

// ──────────── Template Mutations ────────────

export const createTemplateMutation = mutationOptions({
  mutationFn: (data: TemplateMutationPayload) => createTemplate(data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: templateKeys.all });
  }
});

export const updateTemplateMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: Partial<TemplateMutationPayload> }) =>
    updateTemplate(id, values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: templateKeys.all });
  }
});

export const deleteTemplateMutation = mutationOptions({
  mutationFn: (id: string) => deleteTemplate(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: templateKeys.all });
  }
});

// ──────────── Asset Mutations ────────────

export const createAssetMutation = mutationOptions({
  mutationFn: (data: AssetMutationPayload) => createAsset(data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: assetKeys.all });
  }
});

export const updateAssetMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: Partial<AssetMutationPayload> }) =>
    updateAsset(id, values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: assetKeys.all });
  }
});

export const deleteAssetMutation = mutationOptions({
  mutationFn: (id: string) => deleteAsset(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: assetKeys.all });
  }
});
