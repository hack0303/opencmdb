import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import AssetsListingPage from '@/components/assets/assets-listing';
import { searchParamsCache } from '@/lib/searchparams';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard: Assets'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);
  const view = searchParamsCache.get('view') ?? undefined;

  return (
    <PageContainer
      pageTitle='Assets'
      pageDescription='Register and manage all infrastructure assets — hardware, software, databases.'
      pageHeaderAction={
        <div className='flex gap-2'>
          {/* View Toggle */}
          <Link
            href={view === 'ai' ? '/dashboard/assets' : '/dashboard/assets?view=ai'}
            className={cn(
              buttonVariants({ variant: view === 'ai' ? 'default' : 'outline' }),
              'text-xs md:text-sm'
            )}
          >
            {view === 'ai' ? (
              <>
                <Icons.table className='mr-2 h-4 w-4' /> Table
              </>
            ) : (
              <>
                <Icons.sparkles className='mr-2 h-4 w-4' /> AI View
              </>
            )}
          </Link>
          <Link
            href='/dashboard/assets/templates'
            className={cn(buttonVariants({ variant: 'outline' }), 'text-xs md:text-sm')}
          >
            <Icons.stack2 className='mr-2 h-4 w-4' /> Templates
          </Link>
          <Link href='/dashboard/assets/new' className={cn(buttonVariants(), 'text-xs md:text-sm')}>
            <Icons.add className='mr-2 h-4 w-4' /> Register Asset
          </Link>
        </div>
      }
    >
      <AssetsListingPage view={view} />
    </PageContainer>
  );
}
