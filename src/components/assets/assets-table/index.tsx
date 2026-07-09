'use client';

import * as React from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useSearchParams } from 'next/navigation';
import { getSortingStateParser } from '@/lib/parsers';
import { useDataTable } from '@/hooks/use-data-table';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { Skeleton } from '@/components/ui/skeleton';
import { assetsQueryOptions, templatesQueryOptions } from '@/lib/cmdb/assets/queries';
import { columns } from './columns';

const columnIds = columns.map((c) => c.id).filter(Boolean) as string[];

export function AssetTable() {
  // Read templateId from raw URL to avoid parser conflicts with useDataTable
  const searchParams = useSearchParams();
  const rawTemplateId = searchParams.get('templateId');

  const [params] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(10),
      name: parseAsString,
      desc: parseAsString,
      state: parseAsString,
      sort: getSortingStateParser(columnIds).withDefault([])
    },
    {
      history: 'replace',
      shallow: true
    }
  );

  // Fetch all templates to populate the type filter options
  const { data: templatesData } = useSuspenseQuery(templatesQueryOptions({ limit: 100 }));

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.name && { search: params.name }),
    ...(params.desc && { description: params.desc }),
    ...(params.state && { state: params.state }),
    ...(rawTemplateId && { templateId: rawTemplateId }),
    ...(params.sort.length > 0 && { sort: JSON.stringify(params.sort) })
  };

  const { data } = useSuspenseQuery(assetsQueryOptions(filters));
  const pageCount = Math.ceil(data.total_items / params.perPage);

  // Inject template options into the templateId column meta
  const templateOptions = React.useMemo(
    () =>
      templatesData.items.map((t) => ({
        value: t.id,
        label: t.name
      })),
    [templatesData.items]
  );

  // Build columns with template options injected
  const columnsWithOptions = React.useMemo(
    () =>
      columns.map((col) => {
        if (col.id === 'templateId') {
          return {
            ...col,
            meta: { ...col.meta, options: templateOptions }
          };
        }
        return col;
      }) as typeof columns,
    [templateOptions]
  );

  const { table } = useDataTable({
    data: data.items,
    columns: columnsWithOptions,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: { columnPinning: { right: ['actions'] } }
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

export function AssetTableSkeleton() {
  return (
    <div className='space-y-4'>
      <Skeleton className='h-10 w-full' />
      <Skeleton className='h-64 w-full' />
    </div>
  );
}
