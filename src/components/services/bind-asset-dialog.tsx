'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import { bindAssetToService } from '@/lib/cmdb/services/service';
import { serviceKeys } from '@/lib/cmdb/services/queries';
import { assetsQueryOptions } from '@/lib/cmdb/assets/queries';
import { getQueryClient } from '@/lib/query-client';

export function BindAssetDialog({
  serviceId,
  boundAssetIds = []
}: {
  serviceId: string;
  boundAssetIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  // Fetch all assets
  const { data: assetsData, isLoading } = useQuery(assetsQueryOptions({ limit: 200 }));

  // Bind mutation
  const bindMutation = useMutation({
    mutationFn: (assetId: string) =>
      bindAssetToService({ serviceId, assetId, bindingType: 'direct' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
      toast.success('Asset bound to service');
    },
    onError: () => toast.error('Failed to bind asset')
  });

  const allAssets = assetsData?.items ?? [];
  const unboundAssets = allAssets.filter((a) => !boundAssetIds.includes(a.id));

  const filtered = search
    ? unboundAssets.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : unboundAssets;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm'>
          <Icons.add className='mr-2 h-4 w-4' /> Bind Asset
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Bind Asset to Service</DialogTitle>
          <DialogDescription>Select an existing asset to bind to this service.</DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <Input
            placeholder='Search assets...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='h-9'
          />

          <div className='max-h-64 overflow-y-auto space-y-1'>
            {isLoading ? (
              <div className='flex items-center justify-center py-6'>
                <Icons.spinner className='h-5 w-5 animate-spin text-muted-foreground' />
              </div>
            ) : filtered.length === 0 ? (
              <p className='py-6 text-center text-sm text-muted-foreground'>
                {unboundAssets.length === 0
                  ? 'All assets are already bound to this service.'
                  : 'No assets match your search.'}
              </p>
            ) : (
              filtered.map((asset) => (
                <div
                  key={asset.id}
                  className='flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors'
                >
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium truncate'>{asset.name}</p>
                    <p className='text-xs text-muted-foreground truncate'>{asset.templateId}</p>
                  </div>
                  <div className='flex items-center gap-2 shrink-0 ml-2'>
                    <Badge variant='secondary' className='text-xs'>
                      {asset.currentState}
                    </Badge>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 w-7 p-0'
                      disabled={bindMutation.isPending}
                      onClick={() => {
                        bindMutation.mutate(asset.id, {
                          onSuccess: () => setOpen(false)
                        });
                      }}
                    >
                      <Icons.add className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className='sm:justify-start'>
          <p className='text-xs text-muted-foreground'>
            {unboundAssets.length} unbound assets available
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
