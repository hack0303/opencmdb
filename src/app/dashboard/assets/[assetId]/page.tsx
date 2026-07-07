import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { assetByIdOptions, templatesQueryOptions } from '@/lib/cmdb/assets/queries';
import PageContainer from '@/components/layout/page-container';
import AssetViewPage from '@/components/assets/asset-view-page';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard: Asset Details'
};

type PageProps = {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function Page(props: PageProps) {
  const { assetId } = await props.params;
  const searchParams = await props.searchParams;
  const queryClient = getQueryClient();

  // Always load templates (needed for the form)
  void queryClient.prefetchQuery(templatesQueryOptions({ limit: 100 }));

  if (assetId !== 'new') {
    void queryClient.prefetchQuery(assetByIdOptions(assetId));
  }

  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AssetViewPage assetId={assetId} view={searchParams.view} />
      </HydrationBoundary>
    </PageContainer>
  );
}
