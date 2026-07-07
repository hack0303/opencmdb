'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { domainByIdOptions } from '@/lib/cmdb/domains/queries';
import { TopologyView } from './topology-view';
import { AddLinkDialog } from './add-link-dialog';
import DomainAiView from './domain-ai-view';
import type { Service } from '@/lib/cmdb/services/types';

export function DomainViewPage({
  domainId,
  initialServices = []
}: {
  domainId: string;
  initialServices?: Service[];
}) {
  const { data: domain } = useSuspenseQuery(domainByIdOptions(domainId));

  if (!domain) {
    return (
      <Card>
        <CardContent className='py-10 text-center text-muted-foreground'>
          Domain not found.
        </CardContent>
      </Card>
    );
  }

  const services = initialServices;
  const linkCount = domain.topologyData.edges?.length ?? 0;

  return (
    <Tabs defaultValue='overview' className='space-y-6'>
      <TabsList>
        <TabsTrigger value='overview'>Overview</TabsTrigger>
        <TabsTrigger value='ai'>
          <Icons.sparkles className='mr-1.5 h-3.5 w-3.5' />
          AI View
        </TabsTrigger>
      </TabsList>

      <TabsContent value='overview' className='space-y-6'>
        {/* Header */}
        <div className='flex items-start justify-between'>
          <div>
            <div className='flex items-center gap-2'>
              <Icons.workspace className='h-5 w-5 text-muted-foreground' />
              <h1 className='text-2xl font-bold'>{domain.name}</h1>
              {domain.sortOrder > 0 && (
                <Badge variant='outline' className='text-xs font-mono'>
                  #{domain.sortOrder}
                </Badge>
              )}
            </div>
            <p className='mt-1 text-sm text-muted-foreground max-w-2xl'>{domain.description}</p>
            <div className='mt-2 flex flex-wrap gap-1'>
              {domain.tags?.map((tag: string) => (
                <Badge key={tag} variant='secondary' className='text-xs'>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className='flex gap-2'>
            <Link href={`/dashboard/services?domain=${domain.id}`}>
              <Button variant='outline' size='sm'>
                <Icons.stack2 className='mr-2 h-4 w-4' /> View All
              </Button>
            </Link>
            <Link href={`/dashboard/services/new?domainId=${domain.id}`}>
              <Button variant='outline' size='sm'>
                <Icons.add className='mr-2 h-4 w-4' /> Add Service
              </Button>
            </Link>
          </div>
        </div>

        {/* Service Topology Graph (services + links) */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle className='text-lg flex items-center gap-2'>
              <Icons.share className='h-4 w-4' />
              Service Topology
              <span className='text-sm font-normal text-muted-foreground'>
                ({services.length} services, {domain.topologyData.edges?.length ?? 0} links)
              </span>
            </CardTitle>
            <div className='flex gap-2'>
              {services.length > 0 && (
                <Link href={`/dashboard/services?domain=${domain.id}`}>
                  <Button variant='outline' size='sm'>
                    <Icons.stack2 className='mr-2 h-4 w-4' /> Manage
                  </Button>
                </Link>
              )}
              <AddLinkDialog domainId={domain.id} services={services} />
            </div>
          </CardHeader>
          <CardContent>
            <TopologyView
              domainId={domain.id}
              topologyData={domain.topologyData}
              services={services}
            />
            {services.length === 0 && (
              <div className='flex flex-col items-center py-6 text-center text-muted-foreground'>
                <Icons.stack2 className='h-10 w-10 mb-2 opacity-30' />
                <p className='text-sm'>No services in this domain yet.</p>
                <Link
                  href={`/dashboard/services/new?domainId=${domain.id}`}
                  className='text-xs underline underline-offset-2 hover:text-primary mt-1'
                >
                  Create the first service
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value='ai'>
        <DomainAiView domain={domain} serviceCount={services.length} linkCount={linkCount} />
      </TabsContent>
    </Tabs>
  );
}

export function DomainViewPageSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-8 w-64' />
      <Skeleton className='h-4 w-full max-w-2xl' />
      <Skeleton className='h-64 w-full' />
      <Skeleton className='h-32 w-full' />
    </div>
  );
}
