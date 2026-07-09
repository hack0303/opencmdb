import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { assetsQueryOptions } from '@/lib/cmdb/assets/queries';
import { AssetTable, AssetTableSkeleton } from './assets-table';
import AiListingView from './ai-listing-view';
import { Suspense } from 'react';

export default function AssetsListingPage({ view }: { view?: string }) {
  const page = searchParamsCache.get('page');
  const search = searchParamsCache.get('name');
  const pageLimit = searchParamsCache.get('perPage');
  const state = searchParamsCache.get('state');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page,
    limit: pageLimit,
    ...(search && { search }),
    ...(state && { state }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(assetsQueryOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {view === 'ai' ? (
        <Suspense fallback={<AssetTableSkeleton />}>
          <AiListingView filters={filters} />
        </Suspense>
      ) : (
        <Suspense fallback={<AssetTableSkeleton />}>
          <AssetTable />
        </Suspense>
      )}
    </HydrationBoundary>
  );
}
