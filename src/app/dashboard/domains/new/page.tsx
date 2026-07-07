import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { domainSummaryOptions } from '@/lib/cmdb/domains/queries';
import PageContainer from '@/components/layout/page-container';
import DomainForm from '@/components/domains/domain-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard: New Domain'
};

export default async function Page() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(domainSummaryOptions());

  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DomainForm initialData={null} pageTitle='Create New Domain' />
      </HydrationBoundary>
    </PageContainer>
  );
}
