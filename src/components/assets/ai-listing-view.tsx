'use client';

import { useMemo, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import { assetsQueryOptions } from '@/lib/cmdb/assets/queries';
import type { AssetFilters, AssetInstance } from '@/lib/cmdb/assets/types';

type Format = 'yaml' | 'markdown';

// ─────────────────────────────────────────────
// Helper: token-efficient asset reducer
// ─────────────────────────────────────────────

interface AssetSummary {
  name: string;
  type: string;
  state: string;
  description: string;
  tags: string[];
  capabilities: { name: string; method?: string; endpoint?: string }[];
  attributes: Record<string, unknown>;
}

function minimize(asset: AssetInstance): AssetSummary {
  return {
    name: asset.name,
    type: asset.templateId,
    state: asset.currentState,
    description: asset.description,
    tags: asset.tags,
    capabilities: asset.capabilities.map((c) => ({
      name: c.name,
      ...(c.method && { method: c.method }),
      ...(c.endpoint && { endpoint: c.endpoint })
    })),
    attributes: asset.attributes
  };
}

// ─────────────────────────────────────────────
// Format: Strict YAML (all assets)
// ─────────────────────────────────────────────

function toYaml(assets: AssetInstance[]): string {
  const lines: string[] = [];
  lines.push('# Asset Inventory — AI-Optimized View');
  lines.push(`# Total: ${assets.length}`);
  lines.push('');

  for (const a of assets) {
    const m = minimize(a);
    lines.push(`- name: "${m.name}"`);
    lines.push(`  type: "${m.type}"`);
    lines.push(`  state: ${m.state}`);
    if (m.description) lines.push(`  description: "${m.description}"`);
    if (m.tags.length > 0) lines.push(`  tags: [${m.tags.map((t) => `"${t}"`).join(', ')}]`);
    if (Object.keys(m.attributes).length > 0) {
      lines.push('  attributes:');
      for (const [k, v] of Object.entries(m.attributes)) {
        if (typeof v === 'number' || typeof v === 'boolean') {
          lines.push(`    ${k}: ${v}`);
        } else {
          lines.push(`    ${k}: "${v}"`);
        }
      }
    }
    if (m.capabilities.length > 0) {
      lines.push('  capabilities:');
      for (const c of m.capabilities) {
        lines.push(`    - name: "${c.name}"`);
        if (c.method) lines.push(`      method: ${c.method}`);
        if (c.endpoint) lines.push(`      endpoint: "${c.endpoint}"`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// Format: Markdown (all assets)
// ─────────────────────────────────────────────

function toMarkdown(assets: AssetInstance[]): string {
  const lines: string[] = [];

  lines.push('# Asset Inventory — AI-Optimized View');
  lines.push('');
  lines.push(`**Total Assets:** ${assets.length}  `);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('| Asset | Type | State | Tags |');
  lines.push('| --- | --- | --- | --- |');

  for (const a of assets) {
    const m = minimize(a);
    const tagStr = m.tags.slice(0, 3).join(', ') + (m.tags.length > 3 ? '...' : '');
    lines.push(`| **${m.name}** | \`${m.type}\` | ${m.state} | ${tagStr} |`);
  }

  // Detailed sections
  lines.push('');
  lines.push('## Details');
  for (const a of assets) {
    const m = minimize(a);
    lines.push('');
    lines.push(`### ${m.name}`);
    lines.push(`- **Type:** \`${m.type}\``);
    lines.push(`- **State:** ${m.state}`);
    if (m.description) lines.push(`- **Description:** ${m.description}`);
    if (m.tags.length > 0) lines.push(`- **Tags:** ${m.tags.join(', ')}`);

    if (Object.keys(m.attributes).length > 0) {
      lines.push('- **Attributes:**');
      for (const [k, v] of Object.entries(m.attributes)) {
        lines.push(`  - ${k}: \`${String(v)}\``);
      }
    }

    if (m.capabilities.length > 0) {
      lines.push('- **Capabilities:**');
      for (const c of m.capabilities) {
        const parts = [`"${c.name}"`];
        if (c.method) parts.push(c.method);
        if (c.endpoint) parts.push(c.endpoint);
        lines.push(`  - ${parts.join(' | ')}`);
      }
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// Summary stats
// ─────────────────────────────────────────────

function useStats(assets: AssetInstance[]) {
  return useMemo(() => {
    const byState: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalCaps = 0;

    for (const a of assets) {
      byState[a.currentState] = (byState[a.currentState] || 0) + 1;
      byType[a.templateId] = (byType[a.templateId] || 0) + 1;
      totalCaps += a.capabilities.length;
    }

    return { byState, byType, totalCaps };
  }, [assets]);
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function AiListingView({ filters }: { filters: AssetFilters }) {
  const [format, setFormat] = useState<Format>('yaml');
  const [copied, setCopied] = useState(false);

  const { data } = useSuspenseQuery(assetsQueryOptions(filters));
  const assets = data.items;
  const stats = useStats(assets);

  const content = format === 'yaml' ? toYaml(assets) : toMarkdown(assets);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const stateEntries = Object.entries(stats.byState);
  const typeEntries = Object.entries(stats.byType);

  return (
    <div className='space-y-6'>
      {/* Summary Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Total Assets</CardTitle>
            <Icons.asset className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{data.total_items}</div>
            <p className='text-xs text-muted-foreground'>
              {assets.length} loaded · {stats.totalCaps} capabilities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>By State</CardTitle>
            <Icons.trendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='flex flex-wrap gap-1.5'>
              {stateEntries.slice(0, 4).map(([state, count]) => (
                <Badge key={state} variant='outline' className='text-xs'>
                  {state}: {count}
                </Badge>
              ))}
              {stateEntries.length > 4 && (
                <Badge variant='secondary' className='text-xs'>
                  +{stateEntries.length - 4}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>By Type</CardTitle>
            <Icons.stack2 className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='flex flex-wrap gap-1.5'>
              {typeEntries.slice(0, 3).map(([type, count]) => (
                <Badge key={type} variant='secondary' className='text-xs font-mono'>
                  {type}: {count}
                </Badge>
              ))}
              {typeEntries.length > 3 && (
                <Badge variant='outline' className='text-xs'>
                  +{typeEntries.length - 3}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-medium'>Healthy</CardTitle>
            <Icons.circleCheck className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              {assets.filter((a) => ['RUNNING', 'ONLINE', 'READY'].includes(a.currentState)).length}
            </div>
            <p className='text-xs text-muted-foreground'>
              {
                assets.filter((a) =>
                  ['DEGRADED', 'STOPPED', 'DOWN', 'OFFLINE'].includes(a.currentState)
                ).length
              }{' '}
              degraded
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Content Card */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Icons.sparkles className='h-5 w-5 text-primary' />
              <CardTitle className='text-lg'>AI-Optimized View</CardTitle>
              <Badge variant='outline' className='text-xs font-mono'>
                {assets.length} assets
              </Badge>
            </div>
            <Button variant='outline' size='sm' onClick={copyToClipboard}>
              {copied ? (
                <>
                  <Icons.check className='mr-1.5 h-3.5 w-3.5' /> Copied
                </>
              ) : (
                <>
                  <Icons.clipboardText className='mr-1.5 h-3.5 w-3.5' /> Copy All
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
            <TabsList className='mb-4'>
              <TabsTrigger value='yaml' className='flex items-center gap-1.5'>
                <Icons.code className='h-3.5 w-3.5' /> Strict YAML
              </TabsTrigger>
              <TabsTrigger value='markdown' className='flex items-center gap-1.5'>
                <Icons.text className='h-3.5 w-3.5' /> Markdown
              </TabsTrigger>
            </TabsList>
            <TabsContent value='yaml'>
              <pre className='max-h-[600px] overflow-auto rounded-lg bg-secondary/50 p-4 text-xs leading-relaxed'>
                <code>{content}</code>
              </pre>
            </TabsContent>
            <TabsContent value='markdown'>
              <pre className='max-h-[600px] overflow-auto rounded-lg bg-secondary/50 p-4 text-xs leading-relaxed'>
                <code>{content}</code>
              </pre>
            </TabsContent>
          </Tabs>
          <p className='mt-3 text-xs text-muted-foreground'>
            <Icons.info className='mr-1 inline h-3 w-3' />
            Internal fields (IDs, timestamps) are stripped. Copy and paste directly into an AI
            prompt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
