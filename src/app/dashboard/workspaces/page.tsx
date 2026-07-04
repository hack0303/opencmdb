import PageContainer from '@/components/layout/page-container';

export default async function Page() {
  return (
    <PageContainer pageTitle='Workspaces' pageDescription='Organization management (dev mode)'>
      <div className='text-muted-foreground p-8 text-center'>
        Organization management is disabled in development mode.
      </div>
    </PageContainer>
  );
}
