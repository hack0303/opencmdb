'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import type { Domain, TopologyEdge } from '@/lib/cmdb/domains/types';

type Format = 'markdown' | 'yaml';

function toYaml(domain: Domain, svcCount: number, linkCount: number): string {
  const lines: string[] = [];
  lines.push('domain:');
  lines.push(`  name: "${domain.name}"`);
  lines.push(`  description: "${domain.description}"`);
  lines.push(`  tags: [${domain.tags.map((t) => `"${t}"`).join(', ')}]`);
  lines.push(`  services: ${svcCount}`);
  lines.push(`  topology_links: ${linkCount}`);
  if (domain.topologyData.edges.length > 0) {
    lines.push('  links:');
    for (const e of domain.topologyData.edges) {
      lines.push(`    - source: "${e.source}"`);
      lines.push(`      target: "${e.target}"`);
      lines.push(`      type: ${e.type}`);
      if (e.label) lines.push(`      label: "${e.label}"`);
    }
  }
  return lines.join('\n');
}

function toMarkdown(domain: Domain, svcCount: number, linkCount: number): string {
  const lines: string[] = [];
  lines.push(`# Domain: ${domain.name}`);
  lines.push('');
  lines.push(`| Property | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| **Description** | ${domain.description} |`);
  lines.push(`| **Tags** | ${domain.tags.join(', ')} |`);
  lines.push(`| **Services** | ${svcCount} |`);
  lines.push(`| **Topology Links** | ${linkCount} |`);
  if (domain.topologyData.edges.length > 0) {
    lines.push('');
    lines.push('### Topology Links');
    lines.push('| Source | Target | Type | Label |');
    lines.push('| --- | --- | --- | --- |');
    for (const e of domain.topologyData.edges) {
      lines.push(`| ${e.source} | ${e.target} | ${e.type} | ${e.label || '-'} |`);
    }
  }
  return lines.join('\n');
}

export default function DomainAiView({
  domain,
  serviceCount,
  linkCount
}: {
  domain: Domain;
  serviceCount: number;
  linkCount: number;
}) {
  const [format, setFormat] = useState<Format>('yaml');
  const [copied, setCopied] = useState(false);

  const content =
    format === 'markdown'
      ? toMarkdown(domain, serviceCount, linkCount)
      : toYaml(domain, serviceCount, linkCount);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // Fallback for HTTP / insecure context
        const ta = document.createElement('textarea');
        ta.value = content;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='text-xl'>{domain.name}</CardTitle>
              <p className='text-sm text-muted-foreground mt-1'>{domain.description}</p>
            </div>
            <div className='flex items-center gap-2'>
              <Badge variant='outline'>{serviceCount} services</Badge>
              <Badge variant='outline'>{linkCount} links</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
            <div>
              <span className='text-muted-foreground'>Domain ID</span>
              <p className='font-mono font-medium'>{domain.id}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Tags</span>
              <div className='flex flex-wrap gap-1 mt-0.5'>
                {domain.tags.map((t) => (
                  <Badge key={t} variant='secondary' className='text-xs'>
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <span className='text-muted-foreground'>Sort Order</span>
              <p className='font-medium'>{domain.sortOrder}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Icons.sparkles className='h-5 w-5 text-primary' />
              <CardTitle className='text-lg'>AI-Optimized View</CardTitle>
            </div>
            <Button variant='outline' size='sm' onClick={copy}>
              {copied ? (
                <>
                  <Icons.check className='mr-1.5 h-3.5 w-3.5' /> Copied
                </>
              ) : (
                <>
                  <Icons.clipboardText className='mr-1.5 h-3.5 w-3.5' /> Copy
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='yaml' value={format} onValueChange={(v) => setFormat(v as Format)}>
            <TabsList className='mb-4'>
              <TabsTrigger value='yaml'>
                <Icons.code className='mr-1.5 h-3.5 w-3.5' />
                YAML
              </TabsTrigger>
              <TabsTrigger value='markdown'>
                <Icons.text className='mr-1.5 h-3.5 w-3.5' />
                Markdown
              </TabsTrigger>
            </TabsList>
            <TabsContent value='yaml'>
              <pre className='overflow-auto rounded-lg bg-secondary/50 p-4 text-xs leading-relaxed'>
                <code>{content}</code>
              </pre>
            </TabsContent>
            <TabsContent value='markdown'>
              <pre className='overflow-auto rounded-lg bg-secondary/50 p-4 text-xs leading-relaxed'>
                <code>{content}</code>
              </pre>
            </TabsContent>
          </Tabs>
          <p className='mt-3 text-xs text-muted-foreground'>
            <Icons.info className='mr-1 inline h-3 w-3' />
            Token-minimized view. Internal fields stripped. Ready for AI consumption.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
