import PageContainer from '@/components/layout/page-container';
import TemplateViewPage from '@/components/assets/template-view-page';

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
