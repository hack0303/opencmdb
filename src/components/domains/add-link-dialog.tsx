'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import { domainKeys } from '@/lib/cmdb/domains/queries';
import type { Service } from '@/lib/cmdb/services/types';

const LINK_TYPES = [
  { value: 'sync', label: 'Sync (HTTP/gRPC)' },
  { value: 'async_command', label: 'Async Command (Kafka)' },
  { value: 'async_event', label: 'Async Event (Broadcast)' }
] as const;

export function AddLinkDialog({
  domainId,
  services,
  defaultSourceId,
  defaultTargetId,
  open: controlledOpen,
  onClose
}: {
  domainId: string;
  services: Service[];
  defaultSourceId?: string;
  defaultTargetId?: string;
  open?: boolean;
  onClose?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [linkType, setLinkType] = useState('sync');
  const [label, setLabel] = useState('');
  const queryClient = useQueryClient();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  // Sync sourceId/targetId when defaults change
  useEffect(() => {
    if (open) {
      if (defaultSourceId) setSourceId(defaultSourceId);
      if (defaultTargetId) setTargetId(defaultTargetId);
    }
  }, [open, defaultSourceId, defaultTargetId]);

  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    if (!v && onClose) onClose();
    if (!v) {
      setTargetId('');
      setLinkType('sync');
      setLabel('');
    }
  };

  const addLink = useMutation({
    mutationFn: async () => {
      const { createServiceLink } = await import('@/lib/cmdb/services/service');
      return createServiceLink({
        domainId,
        sourceSvcId: sourceId,
        targetSvcId: targetId,
        linkType: linkType as 'sync' | 'async_command' | 'async_event',
        label
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainKeys.detail(domainId) });
      toast.success('Service link added');
      setOpen(false);
      setSourceId('');
      setTargetId('');
      setLinkType('sync');
      setLabel('');
    },
    onError: () => toast.error('Failed to add link')
  });

  const valid = sourceId && targetId && sourceId !== targetId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant='outline' size='sm'>
            <Icons.add className='mr-2 h-4 w-4' /> Add Link
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Add Service Link</DialogTitle>
          <DialogDescription>
            Define how two services communicate — sync call, async command, or event broadcast.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>Source Service (caller)</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger>
                <SelectValue placeholder='Select source service' />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label>Target Service (callee)</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder='Select target service' />
              </SelectTrigger>
              <SelectContent>
                {services
                  .filter((s) => s.id !== sourceId)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label>Link Type</Label>
            <Select value={linkType} onValueChange={setLinkType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label>Label</Label>
            <Input
              placeholder='e.g. POST /api/ledger/transactions'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => addLink.mutate()} disabled={!valid || addLink.isPending}>
            {addLink.isPending ? (
              <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Icons.add className='mr-2 h-4 w-4' />
            )}
            Add Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
