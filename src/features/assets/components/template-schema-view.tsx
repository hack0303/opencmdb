'use client';

import type { AssetTemplate } from '../api/types';

/**
 * Displays the JSON Schema properties of a template in a human-readable table.
 * Helps users understand what attributes are expected when registering an asset.
 */
export function TemplateSchemaView({ template }: { template: AssetTemplate }) {
  const schema = template.schema;
  if (!schema?.properties) return null;

  const entries = Object.entries(schema.properties);

  if (entries.length === 0) {
    return <p className='text-xs text-muted-foreground'>No schema properties defined.</p>;
  }

  return (
    <div className='overflow-hidden rounded-md border'>
      <table className='w-full text-xs'>
        <thead>
          <tr className='bg-muted/50'>
            <th className='px-3 py-1.5 text-left font-medium'>Field</th>
            <th className='px-3 py-1.5 text-left font-medium'>Type</th>
            <th className='px-3 py-1.5 text-left font-medium'>Required</th>
            <th className='px-3 py-1.5 text-left font-medium'>Description</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, prop]) => (
            <tr key={key} className='border-t'>
              <td className='px-3 py-1.5 font-mono font-medium'>{key}</td>
              <td className='px-3 py-1.5 text-muted-foreground'>
                <span className='rounded bg-secondary px-1.5 py-0.5 font-mono'>{prop.type}</span>
              </td>
              <td className='px-3 py-1.5'>
                {schema.required?.includes(key) ? (
                  <span className='text-red-500'>Yes</span>
                ) : (
                  <span className='text-muted-foreground'>No</span>
                )}
                {prop.enum && <span className='ml-1 text-muted-foreground'>(enum)</span>}
              </td>
              <td className='px-3 py-1.5 text-muted-foreground'>
                {prop.title && <span className='font-medium'>{prop.title}</span>}
                {prop.description && <span> — {prop.description}</span>}
                {prop.default !== undefined && (
                  <span className='ml-1 text-muted-foreground'>
                    (default: {String(prop.default)})
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
