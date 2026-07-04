'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import type { AssetInstance } from '../api/types';

type Format = 'markdown' | 'yaml';

// ─────────────────────────────────────────────
// Token Minimizer: strip internal fields
// ─────────────────────────────────────────────

function minimizeForAI(asset: AssetInstance) {
  return {
    name: asset.name,
    type: asset.templateId,
    description: asset.description,
    state: asset.currentState,
    attributes: asset.attributes,
    capabilities: asset.capabilities.map((c) => ({
      name: c.name,
      description: c.description,
      ...(c.method && { method: c.method }),
      ...(c.endpoint && { endpoint: c.endpoint }),
      ...(c.inputSchema && Object.keys(c.inputSchema).length > 0 && { input: c.inputSchema }),
      ...(c.outputSchema && Object.keys(c.outputSchema).length > 0 && { output: c.outputSchema })
    })),
    tags: asset.tags
  };
}

// ─────────────────────────────────────────────
// Format: Markdown Table
// ─────────────────────────────────────────────

function toMarkdownTable(asset: AssetInstance): string {
  const m = minimizeForAI(asset);
  const lines: string[] = [];

  lines.push(`# Asset: ${m.name}`);
  lines.push('');
  lines.push(`| Property | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| **Type** | \`${m.type}\` |`);
  lines.push(`| **Description** | ${m.description} |`);
  lines.push(`| **State** | ${m.state} |`);
  lines.push(`| **Tags** | ${m.tags.join(', ')} |`);

  if (m.attributes && Object.keys(m.attributes).length > 0) {
    lines.push('');
    lines.push('### Attributes');
    lines.push('| Key | Value |');
    lines.push('| --- | --- |');
    for (const [k, v] of Object.entries(m.attributes)) {
      lines.push(`| **${k}** | \`${String(v)}\` |`);
    }
  }

  if (m.capabilities.length > 0) {
    lines.push('');
    lines.push('### Capabilities');
    lines.push('| Name | Description | Method | Endpoint |');
    lines.push('| --- | --- | --- | --- |');
    for (const c of m.capabilities) {
      lines.push(
        `| \`${c.name}\` | ${c.description} | ${c.method ?? '-'} | ${c.endpoint ?? '-'} |`
      );
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// Format: Strict YAML
// ─────────────────────────────────────────────

function toStrictYaml(asset: AssetInstance): string {
  const m = minimizeForAI(asset);
  const lines: string[] = [];

  lines.push('asset:');
  lines.push(`  name: "${m.name}"`);
  lines.push(`  type: "${m.type}"`);
  lines.push(`  description: "${m.description}"`);
  lines.push(`  state: ${m.state}`);
  lines.push(`  tags: [${m.tags.map((t: string) => `"${t}"`).join(', ')}]`);

  if (m.attributes && Object.keys(m.attributes).length > 0) {
    lines.push('  attributes:');
    for (const [k, v] of Object.entries(m.attributes)) {
      if (typeof v === 'number') {
        lines.push(`    ${k}: ${v}`);
      } else if (typeof v === 'boolean') {
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
      lines.push(`      description: "${c.description}"`);
      if (c.method) lines.push(`      method: ${c.method}`);
      if (c.endpoint) lines.push(`      endpoint: "${c.endpoint}"`);
      if (c.input && Object.keys(c.input).length > 0) {
        lines.push(`      input: ${JSON.stringify(c.input)}`);
      }
      if (c.output && Object.keys(c.output).length > 0) {
        lines.push(`      output: ${JSON.stringify(c.output)}`);
      }
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function AiaView({ asset }: { asset: AssetInstance }) {
  const [format, setFormat] = useState<Format>('yaml');
  const [copied, setCopied] = useState(false);

  const content = format === 'markdown' ? toMarkdownTable(asset) : toStrictYaml(asset);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className='space-y-6'>
      {/* Asset Overview Card */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='text-xl'>{asset.name}</CardTitle>
              <p className='text-sm text-muted-foreground mt-1'>{asset.description}</p>
            </div>
            <Badge
              variant='outline'
              className={`text-sm px-3 py-1 ${
                ['RUNNING', 'ONLINE', 'READY'].includes(asset.currentState)
                  ? 'border-green-500 text-green-600'
                  : asset.currentState === 'DEGRADED'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-red-500 text-red-600'
              }`}
            >
              {asset.currentState}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
            <div>
              <span className='text-muted-foreground'>Template</span>
              <p className='font-mono font-medium'>{asset.templateId}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Capabilities</span>
              <p className='font-medium'>{asset.capabilities.length}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Tags</span>
              <div className='flex flex-wrap gap-1 mt-0.5'>
                {asset.tags.slice(0, 4).map((t) => (
                  <Badge key={t} variant='secondary' className='text-xs'>
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <span className='text-muted-foreground'>Updated</span>
              <p className='font-medium'>{new Date(asset.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI View: Format Switch + Output */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Icons.sparkles className='h-5 w-5 text-primary' />
              <CardTitle className='text-lg'>AI-Optimized View</CardTitle>
            </div>
            <Button variant='outline' size='sm' onClick={copyToClipboard}>
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
              <TabsTrigger value='yaml' className='flex items-center gap-1.5'>
                <Icons.code className='h-3.5 w-3.5' /> Strict YAML
              </TabsTrigger>
              <TabsTrigger value='markdown' className='flex items-center gap-1.5'>
                <Icons.text className='h-3.5 w-3.5' /> Markdown Table
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
            Internal fields (IDs, timestamps) are automatically removed. AI reads only what matters.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
