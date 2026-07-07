'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { templateByIdOptions } from '@/lib/cmdb/assets/queries';
import TemplateForm from './template-form';

export default function TemplateViewPage({ templateId }: { templateId: string }) {
  if (templateId === 'new') {
    return <TemplateForm initialData={null} pageTitle='Create Asset Type Template' />;
  }

  return <EditTemplateView templateId={templateId} />;
}

function EditTemplateView({ templateId }: { templateId: string }) {
  const { data } = useSuspenseQuery(templateByIdOptions(templateId));

  if (!data) {
    notFound();
  }

  return <TemplateForm initialData={data} pageTitle='Edit Template' />;
}
