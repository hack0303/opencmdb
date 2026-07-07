'use client';

import { useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import * as z from 'zod';
import { createServiceMutation, updateServiceMutation } from '@/lib/cmdb/services/mutations';
import { domainSummaryOptions } from '@/lib/cmdb/domains/queries';
import type { Service, ServiceMutationPayload } from '@/lib/cmdb/services/types';

const serviceSchema = z.object({
  name: z.string().min(2, 'Service name must be at least 2 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  domainId: z.string().min(1, 'Please select a domain'),
  tags: z.string(),
  sortOrder: z.number().int().min(0)
});

type ServiceFormValues = {
  name: string;
  description: string;
  domainId: string;
  tags: string;
  sortOrder: number;
};

export default function ServiceForm({
  initialData,
  pageTitle
}: {
  initialData: Service | null;
  pageTitle: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDomain = searchParams.get('domainId');
  const isEdit = !!initialData;

  const { data: domains = [] } = useQuery(domainSummaryOptions());

  const createMutation = useMutation({
    ...createServiceMutation,
    onSuccess: () => {
      toast.success('Service created successfully');
      router.push('/dashboard/services');
    },
    onError: () => toast.error('Failed to create service')
  });

  const updateMutation = useMutation({
    ...updateServiceMutation,
    onSuccess: () => {
      toast.success('Service updated successfully');
      router.push('/dashboard/services');
    },
    onError: () => toast.error('Failed to update service')
  });

  const [semanticRolesStr, setSemanticRolesStr] = useState('');

  const form = useAppForm({
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      domainId:
        initialData?.domainId ?? preselectedDomain ?? (domains.length > 0 ? domains[0].id : ''),
      tags: initialData?.tags?.join(', ') ?? '',
      sortOrder: initialData?.sortOrder ?? 0
    } as ServiceFormValues,
    validators: { onSubmit: serviceSchema },
    onSubmit: ({ value }) => {
      let semanticRoles = [];
      try {
        semanticRoles = JSON.parse(semanticRolesStr || '[]');
        if (!Array.isArray(semanticRoles)) throw new Error('Must be an array');
      } catch {
        toast.error('Invalid JSON in semantic roles');
        return;
      }

      const payload: ServiceMutationPayload = {
        name: value.name,
        description: value.description,
        domainId: value.domainId,
        tags: value.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean),
        semanticRoles,
        sortOrder: value.sortOrder
      };

      if (isEdit) {
        updateMutation.mutate({ id: initialData.id, values: payload });
      } else {
        createMutation.mutate(payload);
      }
    }
  });

  const { FormTextField, FormTextareaField, FormSelectField } = useFormFields<ServiceFormValues>();

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
                  label='Service Name'
                  required
                  placeholder='e.g. Payment Ledger Service'
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
              <div className='mt-4 grid grid-cols-1 gap-6 md:grid-cols-2'>
                <FormSelectField
                  name='domainId'
                  label='Parent Domain'
                  required
                  options={domains.map((s) => ({
                    value: s.id,
                    label: s.name
                  }))}
                  placeholder='Select domain'
                />
                <FormTextField
                  name='tags'
                  label='Tags (comma-separated)'
                  placeholder='e.g. payment, ledger, java'
                />
              </div>
              <div className='mt-4'>
                <FormTextareaField
                  name='description'
                  label='Description'
                  required
                  placeholder='Describe this service...'
                  rows={3}
                  maxLength={500}
                  validators={{
                    onBlur: z.string().min(5, 'Description must be at least 5 characters.')
                  }}
                />
              </div>
            </div>

            {/* ── Block 2: Semantic Roles ── */}
            <div className='rounded-lg border p-4'>
              <h3 className='mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
                ② Semantic Roles — AI Semantic Abstraction
              </h3>
              <p className='mb-3 text-xs text-muted-foreground'>
                Define semantic role bindings that map this service to abstract business roles.
                These roles reduce AI token consumption by replacing low-level identifiers with
                high-level semantic labels.
              </p>
              <div className='space-y-1 mb-3'>
                <label className='text-sm font-medium'>Semantic Roles (JSON array)</label>
                <textarea
                  className='flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                  placeholder={JSON.stringify(
                    [
                      { role: 'Ledger_DB', description: '账本数据库 — 所有交易记录的权威数据源' },
                      { role: 'Primary_Compute', description: '核心算力节点 — 交易校验与余额计算' }
                    ],
                    null,
                    2
                  )}
                  value={semanticRolesStr}
                  onChange={(e) => setSemanticRolesStr(e.target.value)}
                />
              </div>
            </div>

            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => router.back()}>
                Back
              </Button>
              <form.SubmitButton>{isEdit ? 'Update Service' : 'Create Service'}</form.SubmitButton>
            </div>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}
