// ═══════════════════════════════════════════════════════════
// Domain Mutation Options — mutationOptions + key invalidation
// ═══════════════════════════════════════════════════════════

import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createDomain, updateDomain, deleteDomain } from './service';
import { domainKeys } from './queries';
import type { DomainMutationPayload } from './types';

export const createDomainMutation = mutationOptions({
  mutationFn: (data: DomainMutationPayload) => createDomain(data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: domainKeys.all });
  }
});

export const updateDomainMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: Partial<DomainMutationPayload> }) =>
    updateDomain(id, values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: domainKeys.all });
  }
});

export const deleteDomainMutation = mutationOptions({
  mutationFn: (id: string) => deleteDomain(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: domainKeys.all });
  }
});
