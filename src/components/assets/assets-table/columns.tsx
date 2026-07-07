'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import type { AssetInstance } from '@/lib/cmdb/assets/types';
import { CellAction } from './cell-action';

const STATE_COLORS: Record<string, string> = {
  RUNNING: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ONLINE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  READY: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  BOOTING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  STARTING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  INIT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PROVISIONING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  DEGRADED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  STOPPED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  OFFLINE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  DOWN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  MAINTENANCE: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
};

export const columns: ColumnDef<AssetInstance>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Asset Name' />,
    meta: { label: 'Name', placeholder: 'Search assets...', variant: 'text', icon: Icons.text },
    enableColumnFilter: true,
    cell: ({ cell }) => <span className='font-medium'>{cell.getValue<string>()}</span>
  },
  {
    id: 'currentState',
    accessorKey: 'currentState',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
    cell: ({ cell }) => {
      const state = cell.getValue<string>();
      return (
        <Badge variant='outline' className={`capitalize ${STATE_COLORS[state] ?? ''}`}>
          <span
            className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
              ['RUNNING', 'ONLINE', 'READY'].includes(state)
                ? 'bg-green-500'
                : ['DEGRADED'].includes(state)
                  ? 'bg-orange-500'
                  : 'bg-red-500'
            }`}
          />
          {state}
        </Badge>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Status',
      variant: 'multiSelect',
      options: [
        { value: 'RUNNING', label: 'Running' },
        { value: 'ONLINE', label: 'Online' },
        { value: 'READY', label: 'Ready' },
        { value: 'BOOTING', label: 'Booting' },
        { value: 'STARTING', label: 'Starting' },
        { value: 'INIT', label: 'Init' },
        { value: 'PROVISIONING', label: 'Provisioning' },
        { value: 'DEGRADED', label: 'Degraded' },
        { value: 'STOPPED', label: 'Stopped' },
        { value: 'OFFLINE', label: 'Offline' },
        { value: 'DOWN', label: 'Down' },
        { value: 'MAINTENANCE', label: 'Maintenance' }
      ]
    }
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
    cell: ({ cell }) => (
      <span className='text-muted-foreground line-clamp-1 max-w-xs'>{cell.getValue<string>()}</span>
    )
  },
  {
    id: 'tags',
    accessorKey: 'tags',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Tags' />,
    cell: ({ cell }) => {
      const tags = cell.getValue<string[]>();
      return (
        <div className='flex flex-wrap gap-1'>
          {tags?.slice(0, 3).map((t) => (
            <Badge key={t} variant='secondary' className='text-xs'>
              {t}
            </Badge>
          ))}
          {tags?.length > 3 && (
            <Badge variant='outline' className='text-xs'>
              +{tags.length - 3}
            </Badge>
          )}
        </div>
      );
    }
  },
  {
    id: 'templateId',
    accessorKey: 'templateId',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Type' />,
    cell: ({ row }) => {
      const tid = row.getValue<string>('templateId');
      return (
        <Badge variant='secondary' className='text-xs font-mono'>
          {tid}
        </Badge>
      );
    }
  },
  {
    id: 'updatedAt',
    accessorKey: 'updatedAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Updated' />,
    cell: ({ cell }) => {
      const val = cell.getValue<string>();
      return (
        <span className='text-muted-foreground text-sm'>{new Date(val).toLocaleDateString()}</span>
      );
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
