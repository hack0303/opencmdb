import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { serviceByIdOptions } from '@/lib/cmdb/services/queries';
import { ServiceViewPage, ServiceViewPageSkeleton } from '@/components/services/service-view-page';
import PageContainer from '@/components/layout/page-container';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard: Service'
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page(props: PageProps) {
  const { id } = await props.params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(serviceByIdOptions(id));

  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<ServiceViewPageSkeleton />}>
          <ServiceViewPage serviceId={id} />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
