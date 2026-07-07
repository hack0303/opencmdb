'use client';

import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as z from 'zod';
import { createTemplateMutation, updateTemplateMutation } from '@/lib/cmdb/assets/mutations';
import type { AssetTemplate } from '@/lib/cmdb/assets/types';

const templateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters'),
  category: z.string().min(1, 'Please select a category'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  tags: z.string().min(1, 'At least one tag is required'),
  schemaJson: z.string(),
  statesJson: z.string(),
  capsJson: z.string()
});

type TemplateFormValues = {
  name: string;
  category: string;
  description: string;
  tags: string;
  schemaJson: string;
  statesJson: string;
  capsJson: string;
};

const CATEGORY_OPTIONS = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'storage', label: 'Storage' }
];

export default function TemplateForm({
  initialData,
  pageTitle
}: {
  initialData: AssetTemplate | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;

  const createMutation = useMutation({
    ...createTemplateMutation,
    onSuccess: () => {
      toast.success('Template created successfully');
      router.push('/dashboard/assets/templates');
    },
    onError: () => toast.error('Failed to create template')
  });

  const updateMutation = useMutation({
    ...updateTemplateMutation,
    onSuccess: () => {
      toast.success('Template updated successfully');
      router.push('/dashboard/assets/templates');
    },
    onError: () => toast.error('Failed to update template')
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? '',
      category: initialData?.category ?? '',
      description: initialData?.description ?? '',
      tags: initialData?.tags?.join(', ') ?? '',
      schemaJson: JSON.stringify(
        initialData?.schema ?? {
          type: 'object',
          properties: {
            exampleField: {
              type: 'string',
              title: 'Example Field',
              description: 'Describe this field'
            }
          },
          required: ['exampleField']
        },
        null,
        2
      ),
      statesJson: JSON.stringify(
        initialData?.defaultStateMapping ?? {
          states: ['RUNNING', 'STOPPED'],
          initialState: 'RUNNING',
          conditions: {}
        },
        null,
        2
      ),
      capsJson: JSON.stringify(
        initialData?.defaultCapabilities ?? [
          {
            name: 'example_tool',
            description: 'Describe what this tool does',
            inputSchema: { type: 'object', properties: {} },
            outputSchema: { type: 'object', properties: {} }
          }
        ],
        null,
        2
      )
    } as TemplateFormValues,
    validators: { onSubmit: templateSchema },
    onSubmit: ({ value }) => {
      let schema, stateMapping, capabilities;
      try {
        schema = JSON.parse(value.schemaJson);
        stateMapping = JSON.parse(value.statesJson);
        capabilities = JSON.parse(value.capsJson);
      } catch {
        toast.error('Invalid JSON in one of the code blocks');
        return;
      }

      const payload = {
        name: value.name,
        category: value.category,
        description: value.description,
        schema,
        defaultStateMapping: stateMapping,
        defaultCapabilities: capabilities,
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

  const { FormTextField, FormSelectField, FormTextareaField } = useFormFields<TemplateFormValues>();

  return (
    <Card className='mx-auto w-full'>
      <CardHeader>
        <CardTitle className='text-left text-2xl font-bold'>{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className='space-y-8'>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <FormTextField
                name='name'
                label='Template Name'
                required
                placeholder='e.g. Quarkus Microservice'
                validators={{
                  onBlur: z.string().min(2, 'Name must be at least 2 characters.')
                }}
              />
              <FormSelectField
                name='category'
                label='Category'
                required
                options={CATEGORY_OPTIONS}
                placeholder='Select category'
                validators={{
                  onBlur: z.string().min(1, 'Please select a category')
                }}
              />
            </div>

            <FormTextareaField
              name='description'
              label='Description'
              required
              placeholder='Describe this asset type...'
              maxLength={500}
              rows={3}
              validators={{
                onBlur: z.string().min(5, 'Description must be at least 5 characters.')
              }}
            />

            <FormTextField
              name='tags'
              label='Tags (comma-separated)'
              placeholder='e.g. microservice, java, quarkus'
              validators={{
                onBlur: z.string().min(1, 'At least one tag is required')
              }}
            />

            <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
              <FormTextareaField
                name='schemaJson'
                label='Attributes Schema (JSON)'
                placeholder='{ "type": "object", "properties": {...} }'
                rows={8}
                className='font-mono text-xs'
              />
              <FormTextareaField
                name='statesJson'
                label='State Mapping (JSON)'
                placeholder='{ "states": [...], "initialState": "..." }'
                rows={8}
                className='font-mono text-xs'
              />
              <FormTextareaField
                name='capsJson'
                label='Capabilities (JSON)'
                placeholder='[{ "name": "...", "description": "..." }]'
                rows={8}
                className='font-mono text-xs'
              />
            </div>

            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => router.back()}>
                Back
              </Button>
              <form.SubmitButton>
                {isEdit ? 'Update Template' : 'Create Template'}
              </form.SubmitButton>
            </div>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}
