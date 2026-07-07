'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import type { ServiceWithDetails } from '@/lib/cmdb/services/types';

type Format = 'markdown' | 'yaml';

function toYaml(svc: ServiceWithDetails): string {
  const lines: string[] = [];
  lines.push('service:');
  lines.push(`  name: "${svc.name}"`);
  lines.push(`  description: "${svc.description}"`);
  lines.push(`  domain: "${svc.domainName ?? svc.domainId}"`);
  lines.push(`  tags: [${svc.tags.map((t) => `"${t}"`).join(', ')}]`);
  if (svc.semanticRoles && svc.semanticRoles.length > 0) {
    lines.push('  semantic_roles:');
    for (const r of svc.semanticRoles) {
      lines.push(`    - role: "${r.role}"`);
      lines.push(`      description: "${r.description}"`);
    }
  }
  if (svc.assets && svc.assets.length > 0) {
    lines.push('  bound_assets:');
    for (const a of svc.assets) {
      lines.push(`    - name: "${a.name}"`);
      lines.push(`      type: "${a.templateName}"`);
      lines.push(`      state: ${a.currentState}`);
    }
  }
  if (svc.links) {
    if (svc.links.asSource.length > 0) {
      lines.push('  outgoing_links:');
      for (const l of svc.links.asSource) {
        lines.push(`    - target: "${l.targetName}"`);
        lines.push(`      type: ${l.type}`);
        if (l.label) lines.push(`      label: "${l.label}"`);
      }
    }
    if (svc.links.asTarget.length > 0) {
      lines.push('  incoming_links:');
      for (const l of svc.links.asTarget) {
        lines.push(`    - source: "${l.sourceName}"`);
        lines.push(`      type: ${l.type}`);
        if (l.label) lines.push(`      label: "${l.label}"`);
      }
    }
  }
  return lines.join('\n');
}

function toMarkdown(svc: ServiceWithDetails): string {
  const lines: string[] = [];
  lines.push(`# Service: ${svc.name}`);
  lines.push('');
  lines.push(`| Property | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| **Description** | ${svc.description} |`);
  lines.push(`| **Domain** | ${svc.domainName ?? svc.domainId} |`);
  lines.push(`| **Tags** | ${svc.tags.join(', ')} |`);
  lines.push(`| **Bound Assets** | ${svc.assets?.length ?? 0} |`);
  if (svc.semanticRoles && svc.semanticRoles.length > 0) {
    lines.push('');
    lines.push('### Semantic Roles');
    lines.push('| Role | Description |');
    lines.push('| --- | --- |');
    for (const r of svc.semanticRoles) {
      lines.push(`| \`${r.role}\` | ${r.description} |`);
    }
  }
  if (svc.links) {
    if (svc.links.asSource.length > 0) {
      lines.push('');
      lines.push('### Outgoing Links');
      lines.push('| Target | Type | Label |');
      lines.push('| --- | --- | --- |');
      for (const l of svc.links.asSource) {
        lines.push(`| ${l.targetName} | ${l.type} | ${l.label || '-'} |`);
      }
    }
    if (svc.links.asTarget.length > 0) {
      lines.push('');
      lines.push('### Incoming Links');
      lines.push('| Source | Type | Label |');
      lines.push('| --- | --- | --- |');
      for (const l of svc.links.asTarget) {
        lines.push(`| ${l.sourceName} | ${l.type} | ${l.label || '-'} |`);
      }
    }
  }
  if (svc.assets && svc.assets.length > 0) {
    lines.push('');
    lines.push('### Bound Assets');
    lines.push('| Name | Type | State |');
    lines.push('| --- | --- | --- |');
    for (const a of svc.assets) {
      lines.push(`| ${a.name} | ${a.templateName} | ${a.currentState} |`);
    }
  }
  return lines.join('\n');
}

export default function ServiceAiView({ service }: { service: ServiceWithDetails }) {
  const [format, setFormat] = useState<Format>('yaml');
  const [copied, setCopied] = useState(false);

  const content = format === 'markdown' ? toMarkdown(service) : toYaml(service);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='text-xl'>{service.name}</CardTitle>
              <p className='text-sm text-muted-foreground mt-1'>{service.description}</p>
            </div>
            <div className='flex items-center gap-2'>
              {service.semanticRoles?.slice(0, 2).map((r) => (
                <Badge key={r.role} variant='secondary' className='text-xs font-mono'>
                  {r.role}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
            <div>
              <span className='text-muted-foreground'>Domain</span>
              <p className='font-medium'>{service.domainName ?? '—'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Bound Assets</span>
              <p className='font-medium'>{service.assets?.length ?? 0}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Links</span>
              <p className='font-medium'>
                {(service.links?.asSource.length ?? 0) + (service.links?.asTarget.length ?? 0)}
              </p>
            </div>
            <div>
              <span className='text-muted-foreground'>Tags</span>
              <div className='flex flex-wrap gap-1 mt-0.5'>
                {service.tags.map((t) => (
                  <Badge key={t} variant='secondary' className='text-xs'>
                    {t}
                  </Badge>
                ))}
              </div>
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
