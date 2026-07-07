'use client';

import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as z from 'zod';
import { createDomainMutation, updateDomainMutation } from '@/lib/cmdb/domains/mutations';
import type { Domain } from '@/lib/cmdb/domains/types';

const domainSchema = z.object({
  name: z.string().min(2, 'Domain name must be at least 2 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  tags: z.string().min(1, 'At least one tag is required'),
  sortOrder: z.number().int().min(0)
});

type DomainFormValues = {
  name: string;
  description: string;
  tags: string;
  sortOrder: number;
};

export default function DomainForm({
  initialData,
  pageTitle
}: {
  initialData: Domain | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!initialData;

  const createMutation = useMutation({
    ...createDomainMutation,
    onSuccess: () => {
      toast.success('Domain created successfully');
      router.push('/dashboard/domains');
    },
    onError: () => toast.error('Failed to create domain')
  });

  const updateMutation = useMutation({
    ...updateDomainMutation,
    onSuccess: () => {
      toast.success('Domain updated successfully');
      router.push('/dashboard/domains');
    },
    onError: () => toast.error('Failed to update domain')
  });

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      tags: initialData?.tags?.join(', ') ?? '',
      sortOrder: initialData?.sortOrder ?? 0
    } as DomainFormValues,
    validators: { onSubmit: domainSchema },
    onSubmit: ({ value }) => {
      const payload = {
        name: value.name,
        description: value.description,
        tags: value.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean),
        sortOrder: value.sortOrder,
        topologyData: initialData?.topologyData ?? {
          description: '',
          nodes: [],
          edges: []
        }
      };

      if (isEdit) {
        updateMutation.mutate({ id: initialData.id, values: payload });
      } else {
        createMutation.mutate(payload);
      }
    }
  });

  const { FormTextField, FormTextareaField } = useFormFields<DomainFormValues>();

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
                  label='Domain Name'
                  required
                  placeholder='e.g. Payment System'
                  validators={{
                    onBlur: z.string().min(2, 'Name must be at least 2 characters.')
                  }}
                />
                <FormTextField
                  name='sortOrder'
                  label='Sort Order'
                  type='number'
                  placeholder='1'
                  required
                />
              </div>
              <div className='mt-4'>
                <FormTextareaField
                  name='description'
                  label='Description'
                  required
                  placeholder='Describe this business domain...'
                  rows={3}
                  maxLength={500}
                  validators={{
                    onBlur: z.string().min(5, 'Description must be at least 5 characters.')
                  }}
                />
              </div>
              <div className='mt-4'>
                <FormTextField
                  name='tags'
                  label='Tags (comma-separated)'
                  placeholder='e.g. payment, finance, core'
                />
              </div>
            </div>

            <p className='text-xs text-muted-foreground'>
              <strong>Note:</strong> After creating the domain, you can add services and define the
              service topology graph from the domain detail page.
            </p>

            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => router.back()}>
                Back
              </Button>
              <form.SubmitButton>{isEdit ? 'Update Domain' : 'Create Domain'}</form.SubmitButton>
            </div>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}
