import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { templateByIdOptions } from '@/features/assets/api/queries';
import PageContainer from '@/components/layout/page-container';
import TemplateViewPage from '@/features/assets/components/template-view-page';

export const metadata = {
  title: 'Dashboard: Edit Template'
};

type PageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function Page(props: PageProps) {
  const { templateId } = await props.params;
  const queryClient = getQueryClient();

  if (templateId !== 'new') {
    void queryClient.prefetchQuery(templateByIdOptions(templateId));
  }

  return (
    <PageContainer>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TemplateViewPage templateId={templateId} />
      </HydrationBoundary>
    </PageContainer>
  );
}
