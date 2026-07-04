'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { assetByIdOptions, templatesQueryOptions } from '../api/queries';
import AssetForm from './asset-form';
import AiaView from './ai-view';

export default function AssetViewPage({ assetId, view }: { assetId: string; view?: string }) {
  const { data: templatesData } = useSuspenseQuery(templatesQueryOptions({ limit: 100 }));
  const templates = templatesData.items;

  if (assetId === 'new') {
    return <AssetForm initialData={null} templates={templates} pageTitle='Register New Asset' />;
  }

  return <EditAssetView assetId={assetId} templates={templates} view={view} />;
}

function EditAssetView({
  assetId,
  templates,
  view
}: {
  assetId: string;
  templates: import('@/constants/mock-api-assets').AssetTemplate[];
  view?: string;
}) {
  const { data } = useSuspenseQuery(assetByIdOptions(assetId));

  if (!data) {
    notFound();
  }

  // AI-oriented view
  if (view === 'ai') {
    return <AiaView asset={data} />;
  }

  // Edit form
  return <AssetForm initialData={data} templates={templates} pageTitle={`Edit: ${data.name}`} />;
}
