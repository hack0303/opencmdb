import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { domainSummaryOptions } from '@/lib/cmdb/domains/queries';
import PageContainer from '@/components/layout/page-container';
import ServiceForm from '@/components/services/service-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard: New Service'
};

export default async function Page() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(domainSummaryOptions());

  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ServiceForm initialData={null} pageTitle='Create New Service' />
      </HydrationBoundary>
    </PageContainer>
  );
}
