'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Icons } from '@/components/icons';
import type { Service } from '@/lib/cmdb/services/types';
import { CellAction } from './cell-action';

export const columns: ColumnDef<Service>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Name' />,
    cell: ({ row }) => (
      <div className='flex items-center gap-2'>
        <Icons.stack2 className='h-4 w-4 text-muted-foreground shrink-0' />
        <span className='max-w-[200px] truncate font-medium'>{row.getValue('name')}</span>
      </div>
    )
  },
  {
    accessorKey: 'domainName',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Domain' />,
    cell: ({ row }) => {
      const name: string = row.getValue('domainName') ?? '';
      return (
        <div className='flex items-center gap-1.5'>
          <Icons.workspace className='h-3.5 w-3.5 text-muted-foreground shrink-0' />
          <span className='max-w-[150px] truncate text-sm'>{name || '—'}</span>
        </div>
      );
    }
  },
  {
    accessorKey: 'description',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
    cell: ({ row }) => (
      <span className='max-w-[250px] truncate text-muted-foreground'>
        {row.getValue('description')}
      </span>
    )
  },
  {
    accessorKey: 'sortOrder',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Order' />,
    cell: ({ row }) => (
      <span className='font-mono text-xs text-muted-foreground'>{row.getValue('sortOrder')}</span>
    )
  },
  {
    accessorKey: 'tags',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Tags' />,
    cell: ({ row }) => {
      const tags: string[] = row.getValue('tags') ?? [];
      return (
        <div className='flex flex-wrap gap-1'>
          {tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant='secondary' className='text-xs'>
              {tag}
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge variant='outline' className='text-xs'>
              +{tags.length - 2}
            </Badge>
          )}
        </div>
      );
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
