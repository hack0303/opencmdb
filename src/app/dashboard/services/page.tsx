import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import ServicesListingPage from '@/components/services/services-listing';
import { searchParamsCache } from '@/lib/searchparams';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard: Services'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='Services'
      pageDescription='Bounded contexts — semantic abstraction layer for AI-driven infrastructure management.'
      pageHeaderAction={
        <Link href='/dashboard/services/new' className={cn(buttonVariants(), 'text-xs md:text-sm')}>
          <Icons.add className='mr-2 h-4 w-4' /> New Service
        </Link>
      }
    >
      <ServicesListingPage />
    </PageContainer>
  );
}
