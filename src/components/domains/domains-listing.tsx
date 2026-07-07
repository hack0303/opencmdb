import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { domainsQueryOptions } from '@/lib/cmdb/domains/queries';
import { DomainTable, DomainTableSkeleton } from './domains-table';
import { Suspense } from 'react';

export default function DomainsListingPage() {
  const page = searchParamsCache.get('page');
  const search = searchParamsCache.get('name');
  const pageLimit = searchParamsCache.get('perPage');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page,
    limit: pageLimit,
    ...(search && { search }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(domainsQueryOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<DomainTableSkeleton />}>
        <DomainTable />
      </Suspense>
    </HydrationBoundary>
  );
}
