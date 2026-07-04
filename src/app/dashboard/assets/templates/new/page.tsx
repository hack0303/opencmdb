import PageContainer from '@/components/layout/page-container';
import TemplateViewPage from '@/features/assets/components/template-view-page';

export const metadata = {
  title: 'Dashboard: Create Template'
};

export default async function Page() {
  return (
    <PageContainer>
      <TemplateViewPage templateId='new' />
    </PageContainer>
  );
}
