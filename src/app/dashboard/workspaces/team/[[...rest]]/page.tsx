import PageContainer from '@/components/layout/page-container';

export default async function Page() {
  return (
    <PageContainer pageTitle='Team' pageDescription='Team management (dev mode)'>
      <div className='text-muted-foreground p-8 text-center'>
        Team management is disabled in development mode.
      </div>
    </PageContainer>
  );
}
