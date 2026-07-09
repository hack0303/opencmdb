'use client';

import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { serviceByIdOptions, serviceKeys } from '@/lib/cmdb/services/queries';
import { setRootBinding } from '@/lib/cmdb/services/service';
import type { ServiceWithDetails } from '@/lib/cmdb/services/types';
import { ServiceTopologyGraph } from './service-topology-graph';
import { BindAssetDialog } from './bind-asset-dialog';
import ServiceAiView from './service-ai-view';

function SemanticRoleBadge({ role, description }: { role: string; description: string }) {
  return (
    <div className='flex items-start gap-3 rounded-lg border p-3'>
      <div className='rounded-full bg-primary/10 p-2'>
        <Icons.badgeCheck className='h-4 w-4 text-primary' />
      </div>
      <div>
        <p className='text-sm font-semibold font-mono'>{role}</p>
        <p className='text-xs text-muted-foreground mt-0.5'>{description}</p>
      </div>
    </div>
  );
}

export function ServiceViewPage({ serviceId }: { serviceId: string }) {
  const { data: service } = useSuspenseQuery(serviceByIdOptions(serviceId));

  if (!service) {
    return (
      <Card>
        <CardContent className='py-10 text-center text-muted-foreground'>
          Service not found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue='overview' className='space-y-6'>
      <TabsList>
        <TabsTrigger value='overview'>Overview</TabsTrigger>
        <TabsTrigger value='ai'>
          <Icons.sparkles className='mr-1.5 h-3.5 w-3.5' />
          AI View
        </TabsTrigger>
      </TabsList>

      <TabsContent value='overview' className='space-y-6'>
        {/* Header */}
        <div className='flex items-start justify-between'>
          <div>
            <div className='flex items-center gap-2'>
              <Icons.stack2 className='h-5 w-5 text-muted-foreground' />
              <h1 className='text-2xl font-bold'>{service.name}</h1>
              {service.sortOrder > 0 && (
                <Badge variant='outline' className='text-xs font-mono'>
                  #{service.sortOrder}
                </Badge>
              )}
            </div>
            <div className='mt-1 flex items-center gap-2 text-sm text-muted-foreground'>
              <Icons.workspace className='h-3.5 w-3.5' />
              <span>{service.domainName ?? 'No domain'}</span>
            </div>
            <p className='mt-1 text-sm text-muted-foreground max-w-2xl'>{service.description}</p>
            <div className='mt-2 flex flex-wrap gap-1'>
              {service.tags?.map((tag: string) => (
                <Badge key={tag} variant='secondary' className='text-xs'>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Semantic Roles */}
        <Card>
          <CardHeader>
            <CardTitle className='text-lg flex items-center gap-2'>
              <Icons.badgeCheck className='h-4 w-4 text-primary' />
              Semantic Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {service.semanticRoles && service.semanticRoles.length > 0 ? (
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {service.semanticRoles.map((sr, i) => (
                  <SemanticRoleBadge key={i} role={sr.role} description={sr.description} />
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>No semantic roles defined.</p>
            )}
          </CardContent>
        </Card>

        {/* Service Topology Graph */}
        <Card>
          <CardHeader>
            <CardTitle className='text-lg flex items-center gap-2'>
              <Icons.share className='h-4 w-4' />
              Assets Topology — {service.assets?.length ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceTopologyGraph
              serviceName={service.name}
              assets={(service.assets ?? []).map((a) => ({
                id: a.id,
                name: a.name,
                type: a.templateName ?? 'unknown',
                state: a.currentState
              }))}
            />
          </CardContent>
        </Card>

        {/* Bound Assets with Reorder */}
        <BoundAssetsCard service={service} />
      </TabsContent>

      <TabsContent value='ai'>
        <ServiceAiView service={service} />
      </TabsContent>
    </Tabs>
  );
}

function BoundAssetsCard({ service }: { service: ServiceWithDetails }) {
  const queryClient = useQueryClient();
  const assets = service.assets ?? [];

  const rootMutation = useMutation({
    mutationFn: (assetId: string) => setRootBinding(service.id, assetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(service.id) });
    }
  });

  // First asset (sort_order === 0) is the root
  const rootAssetId = assets.length > 0 ? assets[0].id : null;

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-lg flex items-center gap-2'>
            <Icons.asset className='h-4 w-4' />
            Bound Assets ({assets.length})
          </CardTitle>
          <BindAssetDialog serviceId={service.id} boundAssetIds={assets.map((a) => a.id)} />
        </div>
      </CardHeader>
      <CardContent>
        {assets.length > 0 ? (
          <div className='divide-y'>
            {assets.map((asset) => {
              const isRoot = asset.id === rootAssetId;
              return (
                <div key={asset.id} className='flex items-center gap-3 py-2'>
                  <button
                    onClick={() => rootMutation.mutate(asset.id)}
                    disabled={rootMutation.isPending}
                    title={isRoot ? 'Root asset' : 'Set as root'}
                    className='shrink-0'
                  >
                    <Icons.star
                      className={`h-4 w-4 ${
                        isRoot
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-muted-foreground/30 hover:text-muted-foreground/60'
                      }`}
                    />
                  </button>
                  <div className='flex-1 min-w-0'>
                    <Link
                      href={`/dashboard/assets/${asset.id}`}
                      className='text-sm font-medium hover:underline'
                    >
                      {asset.name}
                    </Link>
                    <p className='text-xs text-muted-foreground'>{asset.templateName}</p>
                  </div>
                  <Badge
                    variant={
                      asset.currentState === 'RUNNING' || asset.currentState === 'READY'
                        ? 'default'
                        : 'secondary'
                    }
                    className='text-xs'
                  >
                    {asset.currentState}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center py-8 text-center text-muted-foreground'>
            <Icons.asset className='h-8 w-8 mb-2 opacity-30' />
            <p className='text-sm'>No assets bound to this service.</p>
            <p className='text-xs mt-1'>Click &quot;Bind Asset&quot; to link an existing asset.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ServiceViewPageSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-8 w-64' />
      <Skeleton className='h-4 w-full max-w-2xl' />
      <Skeleton className='h-32 w-full' />
      <div className='grid grid-cols-2 gap-6'>
        <Skeleton className='h-32 w-full' />
        <Skeleton className='h-32 w-full' />
      </div>
      <Skeleton className='h-48 w-full' />
    </div>
  );
}
