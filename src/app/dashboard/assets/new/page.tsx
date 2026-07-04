import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { templatesQueryOptions } from '@/features/assets/api/queries';
import PageContainer from '@/components/layout/page-container';
import AssetViewPage from '@/features/assets/components/asset-view-page';

export const metadata = {
  title: 'Dashboard: Register Asset'
};

export default async function Page() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(templatesQueryOptions({ limit: 100 }));

  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AssetViewPage assetId='new' />
      </HydrationBoundary>
    </PageContainer>
  );
}
