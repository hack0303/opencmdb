// ═══════════════════════════════════════════════════════════
// Asset Service — Data Access Layer
// ═══════════════════════════════════════════════════════════
// Pattern: Server Actions + Direct PostgreSQL
// ═══════════════════════════════════════════════════════════

'use server';

import { query, queryOne } from '@/lib/db';
import type {
  AssetTemplate,
  AssetInstance,
  TemplateFilters,
  TemplatesResponse,
  TemplateMutationPayload,
  AssetFilters,
  AssetsResponse,
  AssetMutationPayload
} from './types';

// ──────────── Helper ────────────

function buildWhereClause(
  filters: Record<string, unknown>,
  allowed: string[]
): [string, unknown[]] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    const val = filters[key];
    if (val === undefined || val === null || val === '') continue;

    switch (key) {
      case 'search':
        clauses.push(
          `(a.name ILIKE $${idx} OR a.description ILIKE $${idx} OR array_to_string(a.tags, ',') ILIKE $${idx})`
        );
        params.push(`%${val}%`);
        idx++;
        break;
      case 'category':
        clauses.push(`a.category = $${idx}`);
        params.push(val);
        idx++;
        break;
      case 'templateId':
        clauses.push(`a.template_id = $${idx}`);
        params.push(val);
        idx++;
        break;
      case 'state':
        clauses.push(`a.current_state = $${idx}`);
        params.push(val);
        idx++;
        break;
      case 'tag':
        clauses.push(`$${idx} = ANY(a.tags)`);
        params.push(val);
        idx++;
        break;
    }
  }

  // All queries filter out soft-deleted records by default
  const deletedClause = 'a.deleted_at IS NULL';
  const finalWhere =
    clauses.length > 0
      ? `WHERE ${deletedClause} AND ${clauses.join(' AND ')}`
      : `WHERE ${deletedClause}`;
  return [finalWhere, params];
}

// ──────────── Template Queries ────────────

export async function getTemplates(filters: TemplateFilters): Promise<TemplatesResponse> {
  const { page = 1, limit = 10, sort } = filters;

  const [whereClause, whereParams] = buildWhereClause(filters as Record<string, unknown>, [
    'search',
    'category'
  ]);

  let orderBy = 'ORDER BY a.updated_at DESC';
  if (sort) {
    try {
      const sortItems = JSON.parse(sort) as { id: string; desc: boolean }[];
      if (sortItems.length > 0) {
        const { id, desc } = sortItems[0];
        const colMap: Record<string, string> = {
          name: 'a.name',
          category: 'a.category',
          updatedAt: 'a.updated_at'
        };
        const col = colMap[id];
        if (col) orderBy = `ORDER BY ${col} ${desc ? 'DESC' : 'ASC'}`;
      }
    } catch {
      /* ignore */
    }
  }

  const offset = (page - 1) * limit;

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM asset_templates a ${whereClause}`,
    whereParams
  );
  const total = parseInt(countResult[0]?.count ?? '0', 10);

  const items = await query<Record<string, unknown>>(
    `SELECT 
      a.id, a.name, a.category, a.description,
      a.schema_def AS "schema",
      a.state_mapping AS "defaultStateMapping",
      a.capabilities AS "defaultCapabilities",
      a.tags,
      a.created_at AS "createdAt",
      a.updated_at AS "updatedAt"
    FROM asset_templates a ${whereClause} ${orderBy}
    LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`,
    [...whereParams, limit, offset]
  );

  return { items: items as unknown as AssetTemplate[], total_items: total };
}

export async function getTemplateById(id: string): Promise<AssetTemplate | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT 
      id, name, category, description,
      schema_def AS "schema",
      state_mapping AS "defaultStateMapping",
      capabilities AS "defaultCapabilities",
      tags,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM asset_templates WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return row as unknown as AssetTemplate | null;
}

export async function createTemplate(data: TemplateMutationPayload): Promise<AssetTemplate> {
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO asset_templates (id, name, category, description, schema_def, state_mapping, capabilities, tags)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)
     RETURNING 
       id, name, category, description,
       schema_def AS "schema",
       state_mapping AS "defaultStateMapping",
       capabilities AS "defaultCapabilities",
       tags,
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    [
      `tmpl-${Date.now()}`,
      data.name,
      data.category,
      data.description,
      JSON.stringify(data.schema),
      JSON.stringify(data.defaultStateMapping),
      JSON.stringify(data.defaultCapabilities),
      data.tags
    ]
  );
  return row as unknown as AssetTemplate;
}

export async function updateTemplate(
  id: string,
  data: Partial<TemplateMutationPayload>
): Promise<AssetTemplate | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(data.name);
  }
  if (data.category !== undefined) {
    sets.push(`category = $${idx++}`);
    params.push(data.category);
  }
  if (data.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(data.description);
  }
  if (data.schema !== undefined) {
    sets.push(`schema_def = $${idx++}::jsonb`);
    params.push(JSON.stringify(data.schema));
  }
  if (data.defaultStateMapping !== undefined) {
    sets.push(`state_mapping = $${idx++}::jsonb`);
    params.push(JSON.stringify(data.defaultStateMapping));
  }
  if (data.defaultCapabilities !== undefined) {
    sets.push(`capabilities = $${idx++}::jsonb`);
    params.push(JSON.stringify(data.defaultCapabilities));
  }
  if (data.tags !== undefined) {
    sets.push(`tags = $${idx++}`);
    params.push(data.tags);
  }

  if (sets.length === 0) return getTemplateById(id);
  sets.push(`updated_at = now()`);
  params.push(id);

  const row = await queryOne<Record<string, unknown>>(
    `UPDATE asset_templates SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING 
       id, name, category, description,
       schema_def AS "schema",
       state_mapping AS "defaultStateMapping",
       capabilities AS "defaultCapabilities",
       tags,
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    params
  );
  return row as unknown as AssetTemplate | null;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  await query(
    'UPDATE asset_templates SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return true;
}

// ──────────── Asset Instance Queries ────────────

export async function getAssets(filters: AssetFilters): Promise<AssetsResponse> {
  const { page = 1, limit = 10, sort } = filters;

  const [whereClause, whereParams] = buildWhereClause(filters as Record<string, unknown>, [
    'search',
    'templateId',
    'state',
    'tag'
  ]);

  let orderBy = 'ORDER BY a.updated_at DESC';
  if (sort) {
    try {
      const sortItems = JSON.parse(sort) as { id: string; desc: boolean }[];
      if (sortItems.length > 0) {
        const { id, desc } = sortItems[0];
        const colMap: Record<string, string> = {
          name: 'a.name',
          currentState: 'a.current_state',
          updatedAt: 'a.updated_at'
        };
        const col = colMap[id];
        if (col) orderBy = `ORDER BY ${col} ${desc ? 'DESC' : 'ASC'}`;
      }
    } catch {
      /* ignore */
    }
  }

  const offset = (page - 1) * limit;

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM asset_instances a ${whereClause}`,
    whereParams
  );
  const total = parseInt(countResult[0]?.count ?? '0', 10);

  const items = await query<Record<string, unknown>>(
    `SELECT 
      a.id, a.template_id AS "templateId", a.name, a.description,
      a.attributes, a.state_mapping AS "stateMapping",
      a.current_state AS "currentState",
      a.capabilities, a.tags,
      a.created_at AS "createdAt",
      a.updated_at AS "updatedAt"
    FROM asset_instances a ${whereClause} ${orderBy}
    LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`,
    [...whereParams, limit, offset]
  );

  return { items: items as unknown as AssetInstance[], total_items: total };
}

export async function getAssetById(id: string): Promise<AssetInstance | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT 
      id, template_id AS "templateId", name, description,
      attributes, state_mapping AS "stateMapping",
      current_state AS "currentState",
      capabilities, tags,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM asset_instances WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return row as unknown as AssetInstance | null;
}

export async function createAsset(data: AssetMutationPayload): Promise<AssetInstance> {
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO asset_instances (id, template_id, name, description, attributes, state_mapping, current_state, capabilities, tags)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9)
     RETURNING 
       id, template_id AS "templateId", name, description,
       attributes, state_mapping AS "stateMapping",
       current_state AS "currentState",
       capabilities, tags,
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    [
      `ast-${Date.now()}`,
      data.templateId,
      data.name,
      data.description,
      JSON.stringify(data.attributes),
      JSON.stringify(data.stateMapping),
      data.currentState,
      JSON.stringify(data.capabilities),
      data.tags
    ]
  );
  return row as unknown as AssetInstance;
}

export async function updateAsset(
  id: string,
  data: Partial<AssetMutationPayload>
): Promise<AssetInstance | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(data.name);
  }
  if (data.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(data.description);
  }
  if (data.templateId !== undefined) {
    sets.push(`template_id = $${idx++}`);
    params.push(data.templateId);
  }
  if (data.attributes !== undefined) {
    sets.push(`attributes = $${idx++}::jsonb`);
    params.push(JSON.stringify(data.attributes));
  }
  if (data.stateMapping !== undefined) {
    sets.push(`state_mapping = $${idx++}::jsonb`);
    params.push(JSON.stringify(data.stateMapping));
  }
  if (data.currentState !== undefined) {
    sets.push(`current_state = $${idx++}`);
    params.push(data.currentState);
  }
  if (data.capabilities !== undefined) {
    sets.push(`capabilities = $${idx++}::jsonb`);
    params.push(JSON.stringify(data.capabilities));
  }
  if (data.tags !== undefined) {
    sets.push(`tags = $${idx++}`);
    params.push(data.tags);
  }

  if (sets.length === 0) return getAssetById(id);
  sets.push(`updated_at = now()`);
  params.push(id);

  const row = await queryOne<Record<string, unknown>>(
    `UPDATE asset_instances SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING 
       id, template_id AS "templateId", name, description,
       attributes, state_mapping AS "stateMapping",
       current_state AS "currentState",
       capabilities, tags,
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    params
  );
  return row as unknown as AssetInstance | null;
}

export async function deleteAsset(id: string): Promise<boolean> {
  await query(
    'UPDATE asset_instances SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return true;
}

// ──────────── AI-oriented Queries ────────────

export async function queryByCapability(queryStr: string): Promise<AssetInstance[]> {
  const items = await query<Record<string, unknown>>(
    `SELECT 
      id, template_id AS "templateId", name, description,
      attributes, state_mapping AS "stateMapping",
      current_state AS "currentState",
      capabilities, tags,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM asset_instances
    WHERE deleted_at IS NULL
      AND ($1 ILIKE ANY(tags)
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(capabilities) AS cap
        WHERE cap->>'name' ILIKE $1 OR cap->>'description' ILIKE $1
      ))
    ORDER BY updated_at DESC`,
    [`%${queryStr}%`]
  );
  return items as unknown as AssetInstance[];
}

export async function getAllTags(): Promise<string[]> {
  const rows = await query<{ tag: string }>(
    `SELECT DISTINCT unnest(tags) AS tag FROM asset_instances WHERE deleted_at IS NULL ORDER BY tag`
  );
  return rows.map((r) => r.tag);
}
