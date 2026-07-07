import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Icons } from '@/components/icons';
import Link from 'next/link';
import React from 'react';
import { query } from '@/lib/db';

type SD = {
  id: string;
  name: string;
  serviceCount: number;
  linkCount: number;
  boundAssetCount: number;
};
type Cap = { name: string; count: number };
type StateDist = { state: string; count: number };

async function getOverviewData() {
  const [stats, domains, linkTypes, capabilities, states] = await Promise.all([
    Promise.all([
      query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM domains WHERE deleted_at IS NULL'
      ),
      query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM services WHERE deleted_at IS NULL'
      ),
      query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM service_links WHERE deleted_at IS NULL'
      ),
      query<{ count: string }>(
        'SELECT COUNT(DISTINCT asset_id)::text AS count FROM service_asset_bindings WHERE deleted_at IS NULL'
      ),
      query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM asset_instances WHERE deleted_at IS NULL'
      )
    ]),
    query<SD>(
      `SELECT 
        s.id, s.name,
        COUNT(DISTINCT svc.id)::int AS "serviceCount",
        COUNT(DISTINCT sl.id)::int AS "linkCount",
        COUNT(DISTINCT sab.asset_id)::int AS "boundAssetCount"
      FROM domains s
      LEFT JOIN services svc ON svc.subdomain_id = s.id AND svc.deleted_at IS NULL
      LEFT JOIN service_links sl ON sl.subdomain_id = s.id AND sl.deleted_at IS NULL
      LEFT JOIN service_asset_bindings sab ON sab.service_id = svc.id AND sab.deleted_at IS NULL
      WHERE s.deleted_at IS NULL
      GROUP BY s.id, s.name
      ORDER BY s.sort_order ASC, s.name ASC`
    ),
    query<{ linkType: string; count: string }>(
      'SELECT link_type AS "linkType", COUNT(*)::text AS count FROM service_links WHERE deleted_at IS NULL GROUP BY link_type'
    ),
    query<{ name: string; count: string }>(
      `SELECT cap->>'name' AS "name", COUNT(*)::text AS "count"
       FROM asset_instances, jsonb_array_elements(capabilities) AS cap
       WHERE deleted_at IS NULL
       GROUP BY cap->>'name'
       ORDER BY COUNT(*) DESC
       LIMIT 8`
    ),
    query<{ state: string; count: string }>(
      'SELECT current_state AS state, COUNT(*)::text AS count FROM asset_instances WHERE deleted_at IS NULL GROUP BY current_state ORDER BY COUNT(*) DESC'
    )
  ]);

  return {
    domains: parseInt(stats[0][0]?.count ?? '0', 10),
    services: parseInt(stats[1][0]?.count ?? '0', 10),
    links: parseInt(stats[2][0]?.count ?? '0', 10),
    boundAssets: parseInt(stats[3][0]?.count ?? '0', 10),
    totalAssets: parseInt(stats[4][0]?.count ?? '0', 10),
    domainRows: domains as unknown as SD[],
    linkTypes: linkTypes as { linkType: string; count: string }[],
    capabilities: capabilities as { name: string; count: string }[],
    states: states as { state: string; count: string }[]
  };
}

export default async function OverViewLayout({
  sales,
  pie_stats,
  bar_stats,
  area_stats
}: {
  sales: React.ReactNode;
  pie_stats: React.ReactNode;
  bar_stats: React.ReactNode;
  area_stats: React.ReactNode;
}) {
  const d = await getOverviewData();

  const boundPct = d.totalAssets > 0 ? Math.round((d.boundAssets / d.totalAssets) * 100) : 0;

  const linkTypeBreakdown = { sync: 0, async_command: 0, async_event: 0 };
  for (const row of d.linkTypes) {
    const key = row.linkType as keyof typeof linkTypeBreakdown;
    if (key in linkTypeBreakdown) linkTypeBreakdown[key] = parseInt(row.count, 10);
  }

  const topCapabilities = d.capabilities.map((r) => ({
    name: r.name,
    count: parseInt(r.count, 10)
  }));
  const stateDist = d.states.map((r) => ({ state: r.state, count: parseInt(r.count, 10) }));
  const totalStateCount = stateDist.reduce((s, r) => s + r.count, 0);

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold tracking-tight'>Hi, Welcome back 👋</h2>
        </div>

        {/* ── CMDB Service Metrics Cards ── */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'>
          <Link href='/dashboard/domains' className='group'>
            <Card className='h-full transition-colors group-hover:border-primary/50'>
              <CardContent className='p-4 flex items-start gap-3'>
                <div className='rounded-full bg-sky-100 dark:bg-sky-950/30 p-2 shrink-0'>
                  <Icons.workspace className='h-5 w-5 text-sky-600 dark:text-sky-400' />
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Domains</p>
                  <p className='text-2xl font-bold tabular-nums'>{d.domains}</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>Business domains</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href='/dashboard/services' className='group'>
            <Card className='h-full transition-colors group-hover:border-primary/50'>
              <CardContent className='p-4 flex items-start gap-3'>
                <div className='rounded-full bg-violet-100 dark:bg-violet-950/30 p-2 shrink-0'>
                  <Icons.stack2 className='h-5 w-5 text-violet-600 dark:text-violet-400' />
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Services</p>
                  <p className='text-2xl font-bold tabular-nums'>{d.services}</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>Bounded contexts</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href='/dashboard/services' className='group'>
            <Card className='h-full transition-colors group-hover:border-primary/50'>
              <CardContent className='p-4 flex items-start gap-3'>
                <div className='rounded-full bg-amber-100 dark:bg-amber-950/30 p-2 shrink-0'>
                  <Icons.share className='h-5 w-5 text-amber-600 dark:text-amber-400' />
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Service Links</p>
                  <p className='text-2xl font-bold tabular-nums'>{d.links}</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>Topology edges</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href='/dashboard/assets' className='group'>
            <Card className='h-full transition-colors group-hover:border-primary/50'>
              <CardContent className='p-4 flex items-start gap-3'>
                <div className='rounded-full bg-emerald-100 dark:bg-emerald-950/30 p-2 shrink-0'>
                  <Icons.asset className='h-5 w-5 text-emerald-600 dark:text-emerald-400' />
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Bound Assets</p>
                  <p className='text-2xl font-bold tabular-nums'>{d.boundAssets}</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>{boundPct}% of total</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href='/dashboard/assets' className='group'>
            <Card className='h-full transition-colors group-hover:border-primary/50'>
              <CardContent className='p-4 flex items-start gap-3'>
                <div className='rounded-full bg-neutral-100 dark:bg-neutral-800 p-2 shrink-0'>
                  <Icons.clipboardText className='h-5 w-5' />
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Total Assets</p>
                  <p className='text-2xl font-bold tabular-nums'>{d.totalAssets}</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>In inventory</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ── Charts Grid (parallel routes) ── */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
          <div className='col-span-4'>{bar_stats}</div>
          <div className='col-span-4 md:col-span-3'>{sales}</div>
          <div className='col-span-4'>{area_stats}</div>
          <div className='col-span-4 min-h-0 md:col-span-3'>{pie_stats}</div>
        </div>

        {/* ── CMDB Detail: domain breakdown, capabilities, state ── */}
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6'>
          {/* Domain Breakdown */}
          <Card className='lg:col-span-2'>
            <CardHeader className='flex flex-row items-center justify-between'>
              <CardTitle className='text-lg'>Domain Breakdown</CardTitle>
              <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                <span className='flex items-center gap-1'>
                  <Icons.share className='h-3 w-3' /> S:{linkTypeBreakdown.sync}
                </span>
                <span className='flex items-center gap-1'>
                  <Icons.chevronsRight className='h-3 w-3' /> C:{linkTypeBreakdown.async_command}
                </span>
                <span className='flex items-center gap-1'>
                  <Icons.send className='h-3 w-3' /> E:{linkTypeBreakdown.async_event}
                </span>
              </div>
            </CardHeader>
            <CardContent className='p-0'>
              {d.domainRows.length === 0 ? (
                <div className='flex flex-col items-center py-10 text-muted-foreground'>
                  <Icons.workspace className='h-10 w-10 mb-2 opacity-30' />
                  <p className='text-sm'>No domains defined yet.</p>
                </div>
              ) : (
                <div className='divide-y'>
                  {d.domainRows.map((sd) => {
                    const maxCount = Math.max(...d.domainRows.map((s) => s.serviceCount), 1);
                    return (
                      <Link
                        key={sd.id}
                        href={`/dashboard/domains/${sd.id}`}
                        className='flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors'
                      >
                        <Icons.workspace className='h-4 w-4 shrink-0 text-muted-foreground' />
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-medium truncate'>{sd.name}</p>
                          <div className='flex items-center gap-2 mt-1'>
                            <Progress
                              value={Math.round((sd.serviceCount / maxCount) * 100)}
                              className='h-1.5 flex-1 max-w-[160px]'
                            />
                            <span className='text-xs text-muted-foreground tabular-nums'>
                              {sd.serviceCount} svc
                            </span>
                          </div>
                        </div>
                        <div className='flex items-center gap-3 shrink-0 text-xs text-muted-foreground'>
                          <span className='flex items-center gap-1'>
                            <Icons.share className='h-3 w-3' />
                            {sd.linkCount}
                          </span>
                          <span className='flex items-center gap-1'>
                            <Icons.asset className='h-3 w-3' />
                            {sd.boundAssetCount}
                          </span>
                        </div>
                        <Icons.chevronRight className='h-4 w-4 shrink-0 text-muted-foreground' />
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Capabilities */}
          <Card>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-2'>
                <Icons.badgeCheck className='h-4 w-4 text-primary' />
                Top Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topCapabilities.length === 0 ? (
                <p className='text-sm text-muted-foreground py-4 text-center'>None yet.</p>
              ) : (
                <div className='space-y-2'>
                  {topCapabilities.map((cap, i) => {
                    const maxCap = Math.max(...topCapabilities.map((c) => c.count), 1);
                    return (
                      <div key={cap.name} className='flex items-center gap-3'>
                        <span className='text-xs text-muted-foreground w-5 text-right tabular-nums'>
                          {i + 1}
                        </span>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center justify-between'>
                            <span className='text-sm font-mono truncate'>{cap.name}</span>
                            <span className='text-xs text-muted-foreground tabular-nums ml-2'>
                              {cap.count}
                            </span>
                          </div>
                          <Progress
                            value={Math.round((cap.count / maxCap) * 100)}
                            className='h-1 mt-1'
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* State Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-2'>
                <Icons.alertCircle className='h-4 w-4 text-primary' />
                Asset State Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stateDist.length === 0 ? (
                <p className='text-sm text-muted-foreground py-4 text-center'>No assets yet.</p>
              ) : (
                <div className='space-y-3'>
                  {stateDist.map((st) => {
                    const pct =
                      totalStateCount > 0 ? Math.round((st.count / totalStateCount) * 100) : 0;
                    return (
                      <div key={st.state} className='flex items-center gap-3'>
                        <Badge
                          variant={
                            ['RUNNING', 'READY', 'ONLINE'].includes(st.state)
                              ? 'default'
                              : 'secondary'
                          }
                          className='w-24 shrink-0 justify-center text-xs font-mono'
                        >
                          {st.state}
                        </Badge>
                        <div className='flex-1 flex items-center gap-2'>
                          <Progress value={pct} className='h-2 flex-1' />
                          <span className='text-xs text-muted-foreground tabular-nums w-20 text-right'>
                            {st.count} ({pct}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
