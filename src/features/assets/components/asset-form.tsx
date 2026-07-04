'use client';

import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as z from 'zod';
import { createAssetMutation, updateAssetMutation } from '../api/mutations';
import { allTagsOptions } from '../api/queries';
import type { AssetInstance, AssetTemplate } from '../api/types';
import { TemplateSchemaView } from './template-schema-view';

const assetSchema = z.object({
  name: z.string().min(2, 'Asset name must be at least 2 characters'),
  templateId: z.string().min(1, 'Please select a template'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  tags: z.string().min(1, 'At least one tag is required'),
  attributesJson: z.string(),
  statesJson: z.string(),
  capsJson: z.string()
});

type AssetFormValues = {
  name: string;
  templateId: string;
  description: string;
  tags: string;
  attributesJson: string;
  statesJson: string;
  capsJson: string;
};

export default function AssetForm({
  initialData,
  templates,
  pageTitle
}: {
  initialData: AssetInstance | null;
  templates: AssetTemplate[];
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;

  const { data: allTags } = useQuery(allTagsOptions());

  const createMutation = useMutation({
    ...createAssetMutation,
    onSuccess: () => {
      toast.success('Asset registered successfully');
      router.push('/dashboard/assets');
    },
    onError: () => toast.error('Failed to register asset')
  });

  const updateMutation = useMutation({
    ...updateAssetMutation,
    onSuccess: () => {
      toast.success('Asset updated successfully');
      router.push('/dashboard/assets');
    },
    onError: () => toast.error('Failed to update asset')
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? '',
      templateId: initialData?.templateId ?? (templates.length > 0 ? templates[0].id : ''),
      description: initialData?.description ?? '',
      tags: initialData?.tags?.join(', ') ?? '',
      attributesJson: JSON.stringify(initialData?.attributes ?? {}, null, 2),
      statesJson: JSON.stringify(
        initialData?.stateMapping ?? {
          states: ['RUNNING', 'STOPPED'],
          initialState: 'RUNNING',
          conditions: {}
        },
        null,
        2
      ),
      capsJson: JSON.stringify(initialData?.capabilities ?? [], null, 2)
    } as AssetFormValues,
    validators: { onSubmit: assetSchema },
    onSubmit: ({ value }) => {
      let attributes, stateMapping, capabilities;
      try {
        attributes = JSON.parse(value.attributesJson);
        stateMapping = JSON.parse(value.statesJson);
        capabilities = JSON.parse(value.capsJson);
      } catch {
        toast.error('Invalid JSON in one of the code blocks');
        return;
      }

      const payload = {
        templateId: value.templateId,
        name: value.name,
        description: value.description,
        attributes,
        stateMapping,
        currentState: stateMapping.initialState ?? 'UNKNOWN',
        capabilities,
        tags: value.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean)
      };

      if (isEdit) {
        updateMutation.mutate({ id: initialData.id, values: payload });
      } else {
        createMutation.mutate(payload);
      }
    }
  });

  const { FormTextField, FormSelectField, FormTextareaField } = useFormFields<AssetFormValues>();

  const selectedTemplateId = useStore(form.store, (s) => s.values.templateId);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <Card className='mx-auto w-full'>
      <CardHeader>
        <CardTitle className='text-left text-2xl font-bold'>{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className='space-y-8'>
            {/* ── Block 1: Basic Info ── */}
            <div className='rounded-lg border p-4'>
              <h3 className='mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
                ① Basic Information
              </h3>
              <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                <FormTextField
                  name='name'
                  label='Asset Name'
                  required
                  placeholder='e.g. cland-user-service-01'
                  validators={{
                    onBlur: z.string().min(2, 'Name must be at least 2 characters.')
                  }}
                />
                <FormSelectField
                  name='templateId'
                  label='Asset Type Template'
                  required
                  options={templates.map((t) => ({
                    value: t.id,
                    label: `${t.name} (${t.category})`
                  }))}
                  placeholder='Select template'
                />
              </div>
              <div className='mt-4 grid grid-cols-1 gap-6 md:grid-cols-2'>
                <FormTextareaField
                  name='description'
                  label='Description'
                  required
                  placeholder='Describe this asset...'
                  maxLength={500}
                  rows={2}
                  validators={{
                    onBlur: z.string().min(5, 'Description must be at least 5 characters.')
                  }}
                />
                <FormTextField
                  name='tags'
                  label='Tags (comma-separated)'
                  placeholder='e.g. payment, cland, production'
                  description={`Existing tags: ${allTags?.join(', ') ?? ''}`}
                />
              </div>
            </div>

            {/* ── Block 2: Dynamic Attributes ── */}
            <div className='rounded-lg border p-4'>
              <h3 className='mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
                ② Attributes — Type-Specific Properties
              </h3>
              {selectedTemplate && <TemplateSchemaView template={selectedTemplate} />}
              <div className='mt-3'>
                <FormTextareaField
                  name='attributesJson'
                  label='Attributes (JSON)'
                  placeholder='{ "key": "value" }'
                  rows={6}
                  className='font-mono text-xs'
                />
              </div>
            </div>

            {/* ── Block 3: State Mapping ── */}
            <div className='rounded-lg border p-4'>
              <h3 className='mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
                ③ State Mapping — Health Determination Rules
              </h3>
              {selectedTemplate && selectedTemplate.defaultStateMapping && (
                <div className='mb-3 flex flex-wrap gap-2'>
                  <span className='text-xs text-muted-foreground'>Template states:</span>
                  {selectedTemplate.defaultStateMapping.states.map((s: string) => (
                    <span key={s} className='rounded bg-secondary px-2 py-0.5 text-xs font-mono'>
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <FormTextareaField
                name='statesJson'
                label='State Mapping (JSON)'
                placeholder='{ "states": [...], "initialState": "...", "conditions": {...} }'
                rows={6}
                className='font-mono text-xs'
              />
            </div>

            {/* ── Block 4: Capabilities ── */}
            <div className='rounded-lg border p-4'>
              <h3 className='mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
                ④ Capabilities — AI Tool Definitions
              </h3>
              {selectedTemplate && selectedTemplate.defaultCapabilities?.length > 0 && (
                <div className='mb-3 space-y-1'>
                  <span className='text-xs text-muted-foreground'>
                    Template default capabilities:
                  </span>
                  {selectedTemplate.defaultCapabilities.map(
                    (c: { name: string; description: string }, i: number) => (
                      <div key={i} className='flex gap-2 rounded bg-secondary px-2 py-1 text-xs'>
                        <span className='font-semibold font-mono'>{c.name}</span>
                        <span className='text-muted-foreground'>— {c.description}</span>
                      </div>
                    )
                  )}
                </div>
              )}
              <FormTextareaField
                name='capsJson'
                label='Capabilities (JSON array)'
                placeholder='[{ "name": "...", "description": "...", "inputSchema": {...} }]'
                rows={6}
                className='font-mono text-xs'
              />
            </div>

            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => router.back()}>
                Back
              </Button>
              <form.SubmitButton>{isEdit ? 'Update Asset' : 'Register Asset'}</form.SubmitButton>
            </div>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}
