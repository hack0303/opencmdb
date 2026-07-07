// ═══════════════════════════════════════════════════════════
// Service Mutation Options — mutationOptions + key invalidation
// ═══════════════════════════════════════════════════════════

import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createService, updateService, deleteService } from './service';
import { serviceKeys } from './queries';
import type { ServiceMutationPayload } from './types';

export const createServiceMutation = mutationOptions({
  mutationFn: (data: ServiceMutationPayload) => createService(data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: serviceKeys.all });
  }
});

export const updateServiceMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: Partial<ServiceMutationPayload> }) =>
    updateService(id, values),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: serviceKeys.all });
  }
});

export const deleteServiceMutation = mutationOptions({
  mutationFn: (id: string) => deleteService(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: serviceKeys.all });
  }
});
