'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import type { AssetTemplate } from '@/lib/cmdb/assets/types';

export const columns: ColumnDef<AssetTemplate>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Template Name' />,
    meta: { label: 'Name', placeholder: 'Search templates...', variant: 'text', icon: Icons.text },
    enableColumnFilter: true,
    cell: ({ cell }) => <span className='font-medium'>{cell.getValue<string>()}</span>
  },
  {
    id: 'category',
    accessorKey: 'category',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Category' />,
    cell: ({ cell }) => {
      const val = cell.getValue<string>();
      const colors: Record<string, string> = {
        hardware: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        software: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        storage: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      };
      return (
        <Badge variant='outline' className={`capitalize ${colors[val] ?? ''}`}>
          {val}
        </Badge>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Category',
      variant: 'multiSelect',
      options: [
        { value: 'hardware', label: 'Hardware' },
        { value: 'software', label: 'Software' },
        { value: 'storage', label: 'Storage' }
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
    id: 'updatedAt',
    accessorKey: 'updatedAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Updated' />,
    cell: ({ cell }) => {
      const val = cell.getValue<string>();
      return (
        <span className='text-muted-foreground text-sm'>{new Date(val).toLocaleDateString()}</span>
      );
    }
  }
];
