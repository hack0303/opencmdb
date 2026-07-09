'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import { domainKeys } from '@/lib/cmdb/domains/queries';
import type { Service } from '@/lib/cmdb/services/types';

const LINK_TYPES = [
  { value: 'sync', label: 'Sync (HTTP/gRPC)' },
  { value: 'async_command', label: 'Async Command (Kafka)' },
  { value: 'async_event', label: 'Async Event (Broadcast)' }
] as const;

type LinkRow = {
  id: number;
  sourceId: string;
  targetId: string;
  linkType: string;
  label: string;
};

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
  const [rows, setRows] = useState<LinkRow[]>([
    { id: 1, sourceId: '', targetId: '', linkType: 'sync', label: '' }
  ]);
  const nextId = useRef(2);
  const queryClient = useQueryClient();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  // Pre-fill first row when opened with defaults (drag-to-link flow)
  useEffect(() => {
    if (open && defaultSourceId) {
      setRows([
        {
          id: 1,
          sourceId: defaultSourceId,
          targetId: defaultTargetId ?? '',
          linkType: 'sync',
          label: ''
        }
      ]);
      nextId.current = 2;
    }
  }, [open, defaultSourceId, defaultTargetId]);

  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    if (!v && onClose) onClose();
    if (!v) {
      setRows([{ id: 1, sourceId: '', targetId: '', linkType: 'sync', label: '' }]);
      nextId.current = 2;
    }
  };

  const batchAdd = useMutation({
    mutationFn: async () => {
      const { createServiceLinks } = await import('@/lib/cmdb/services/service');
      const validItems = rows
        .filter((r) => r.sourceId && r.targetId && r.sourceId !== r.targetId)
        .map((r) => ({
          domainId,
          sourceSvcId: r.sourceId,
          targetSvcId: r.targetId,
          linkType: r.linkType as 'sync' | 'async_command' | 'async_event',
          label: r.label
        }));
      return createServiceLinks(validItems);
    },
    onSuccess: (count: number) => {
      queryClient.invalidateQueries({ queryKey: domainKeys.detail(domainId) });
      toast.success(`${count} link(s) added`);
      setOpen(false);
    },
    onError: () => toast.error('Failed to add links')
  });

  function addRow() {
    const id = nextId.current++;
    setRows((prev) => [...prev, { id, sourceId: '', targetId: '', linkType: 'sync', label: '' }]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, field: keyof LinkRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  const validRows = rows.filter((r) => r.sourceId && r.targetId && r.sourceId !== r.targetId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant='outline' size='sm'>
            <Icons.add className='mr-2 h-4 w-4' /> Add Link
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className='sm:max-w-3xl max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Add Service Link{rows.length > 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Define how services communicate — sync call, async command, or event broadcast.
            {rows.length > 1 && ' Add multiple links at once.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          {/* Header */}
          <div className='grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1'>
            <div className='col-span-3'>Source Service</div>
            <div className='col-span-3'>Target Service</div>
            <div className='col-span-2'>Type</div>
            <div className='col-span-3'>Label</div>
            <div className='col-span-1' />
          </div>

          {rows.map((row) => (
            <div key={row.id} className='grid grid-cols-12 gap-2 items-end'>
              <div className='col-span-3'>
                <Select
                  value={row.sourceId}
                  onValueChange={(v) => updateRow(row.id, 'sourceId', v)}
                >
                  <SelectTrigger className='h-9 text-xs'>
                    <SelectValue placeholder='Source' />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id} className='text-xs'>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='col-span-3'>
                <Select
                  value={row.targetId}
                  onValueChange={(v) => updateRow(row.id, 'targetId', v)}
                >
                  <SelectTrigger className='h-9 text-xs'>
                    <SelectValue placeholder='Target' />
                  </SelectTrigger>
                  <SelectContent>
                    {services
                      .filter((s) => s.id !== row.sourceId)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id} className='text-xs'>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='col-span-2'>
                <Select
                  value={row.linkType}
                  onValueChange={(v) => updateRow(row.id, 'linkType', v)}
                >
                  <SelectTrigger className='h-9 text-xs'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className='text-xs'>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='col-span-3'>
                <Input
                  className='h-9 text-xs'
                  placeholder='e.g. REST /api/...'
                  value={row.label}
                  onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                />
              </div>
              <div className='col-span-1 flex justify-center'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-9 w-9'
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                >
                  <Icons.close className='h-4 w-4' />
                </Button>
              </div>
            </div>
          ))}

          <Button variant='ghost' size='sm' onClick={addRow} className='w-full'>
            <Icons.add className='mr-2 h-4 w-4' /> Add Row
          </Button>
        </div>

        <DialogFooter className='flex items-center justify-between'>
          <p className='text-xs text-muted-foreground'>{validRows.length} valid link(s)</p>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => batchAdd.mutate()}
              disabled={validRows.length === 0 || batchAdd.isPending}
            >
              {batchAdd.isPending ? (
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Icons.add className='mr-2 h-4 w-4' />
              )}
              Add {validRows.length > 0 ? `(${validRows.length})` : ''} Link
              {validRows.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
