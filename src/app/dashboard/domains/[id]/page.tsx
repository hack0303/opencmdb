import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { domainByIdOptions } from '@/lib/cmdb/domains/queries';
import { getServices } from '@/lib/cmdb/services/service';
import { DomainViewPage, DomainViewPageSkeleton } from '@/components/domains/domain-view-page';
import PageContainer from '@/components/layout/page-container';
import { Suspense } from 'react';
import type { Service } from '@/lib/cmdb/services/types';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard: Domain'
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page(props: PageProps) {
  const { id } = await props.params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(domainByIdOptions(id));

  // Fetch services server-side to avoid pg bundling in client
  const servicesResult = await getServices({ domainId: id, limit: 50 });
  const services = servicesResult.items as Service[];

  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<DomainViewPageSkeleton />}>
          <DomainViewPage domainId={id} initialServices={services} />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
