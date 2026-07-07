import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { servicesQueryOptions } from '@/lib/cmdb/services/queries';
import { ServiceTable, ServiceTableSkeleton } from './services-table';
import { Suspense } from 'react';

export default function ServicesListingPage() {
  const page = searchParamsCache.get('page');
  const search = searchParamsCache.get('name');
  const pageLimit = searchParamsCache.get('perPage');
  const domain = searchParamsCache.get('category') as string | undefined;
  const sort = searchParamsCache.get('sort');

  const filters = {
    page,
    limit: pageLimit,
    ...(search && { search }),
    ...(domain && { domainId: domain }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(servicesQueryOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<ServiceTableSkeleton />}>
        <ServiceTable />
      </Suspense>
    </HydrationBoundary>
  );
}
