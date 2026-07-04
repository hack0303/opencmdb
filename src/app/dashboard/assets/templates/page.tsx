import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import TemplatesListingPage from '@/features/assets/components/templates-listing';
import { searchParamsCache } from '@/lib/searchparams';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';

export const metadata = {
  title: 'Dashboard: Asset Templates'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='Asset Type Templates'
      pageDescription='Define asset type templates — JSON Schema, state mapping, and AI capabilities.'
      pageHeaderAction={
        <Link
          href='/dashboard/assets/templates/new'
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <Icons.add className='mr-2 h-4 w-4' /> New Template
        </Link>
      }
    >
      <TemplatesListingPage />
    </PageContainer>
  );
}
