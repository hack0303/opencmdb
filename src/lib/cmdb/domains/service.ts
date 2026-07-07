// ═══════════════════════════════════════════════════════════
// Domain Service — Data Access Layer
// ═══════════════════════════════════════════════════════════
// Pattern: Server Actions + Direct PostgreSQL
// ═══════════════════════════════════════════════════════════

'use server';

import { query, queryOne } from '@/lib/db';
import type { Domain, DomainFilters, DomainsResponse, DomainMutationPayload } from './types';

// ──────────── Helper ────────────

function buildWhereClause(
  filters: Record<string, unknown>,
  allowed: string[]
): [string, unknown[]] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  const tableAlias = 's';

  for (const key of allowed) {
    const val = filters[key];
    if (val === undefined || val === null || val === '') continue;

    switch (key) {
      case 'search':
        clauses.push(
          `(${tableAlias}.name ILIKE $${idx} OR ${tableAlias}.description ILIKE $${idx} OR array_to_string(${tableAlias}.tags, ',') ILIKE $${idx})`
        );
        params.push(`%${val}%`);
        idx++;
        break;
      case 'tag':
        clauses.push(`$${idx} = ANY(${tableAlias}.tags)`);
        params.push(val);
        idx++;
        break;
    }
  }

  const deletedClause = `${tableAlias}.deleted_at IS NULL`;
  const finalWhere =
    clauses.length > 0
      ? `WHERE ${deletedClause} AND ${clauses.join(' AND ')}`
      : `WHERE ${deletedClause}`;
  return [finalWhere, params];
}

// ──────────── Query ────────────

export async function getDomains(filters: DomainFilters): Promise<DomainsResponse> {
  const { page = 1, limit = 10, sort } = filters;

  const [whereClause, whereParams] = buildWhereClause(filters as Record<string, unknown>, [
    'search',
    'tag'
  ]);

  let orderBy = 'ORDER BY s.sort_order ASC, s.name ASC';
  if (sort) {
    try {
      const sortItems = JSON.parse(sort) as { id: string; desc: boolean }[];
      if (sortItems.length > 0) {
        const { id, desc } = sortItems[0];
        const colMap: Record<string, string> = {
          name: 's.name',
          sortOrder: 's.sort_order',
          updatedAt: 's.updated_at'
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
    `SELECT COUNT(*) FROM domains s ${whereClause}`,
    whereParams
  );
  const total = parseInt(countResult[0]?.count ?? '0', 10);

  const items = await query<Record<string, unknown>>(
    `SELECT 
      s.id, s.name, s.description, s.tags,
      s.topology_data AS "topologyData",
      s.sort_order AS "sortOrder",
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt"
    FROM domains s ${whereClause} ${orderBy}
    LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`,
    [...whereParams, limit, offset]
  );

  return { items: items as unknown as Domain[], total_items: total };
}

export async function getDomainById(id: string): Promise<Domain | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT 
      s.id, s.name, s.description, s.tags,
      s.topology_data AS "topologyData",
      s.sort_order AS "sortOrder",
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt"
    FROM domains s WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [id]
  );
  return row as unknown as Domain | null;
}

// ──────────── Mutations ────────────

export async function createDomain(data: DomainMutationPayload): Promise<Domain> {
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO domains (id, name, description, tags, topology_data, sort_order)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING 
       id, name, description, tags,
       topology_data AS "topologyData",
       sort_order AS "sortOrder",
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    [
      `sub-${Date.now()}`,
      data.name,
      data.description,
      data.tags,
      JSON.stringify(data.topologyData),
      data.sortOrder ?? 0
    ]
  );
  return row as unknown as Domain;
}

export async function updateDomain(
  id: string,
  data: Partial<DomainMutationPayload>
): Promise<Domain | null> {
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
  if (data.tags !== undefined) {
    sets.push(`tags = $${idx++}`);
    params.push(data.tags);
  }
  if (data.topologyData !== undefined) {
    sets.push(`topology_data = $${idx++}::jsonb`);
    params.push(JSON.stringify(data.topologyData));
  }
  if (data.sortOrder !== undefined) {
    sets.push(`sort_order = $${idx++}`);
    params.push(data.sortOrder);
  }

  if (sets.length === 0) return getDomainById(id);
  sets.push(`updated_at = now()`);
  params.push(id);

  const row = await queryOne<Record<string, unknown>>(
    `UPDATE domains SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING 
       id, name, description, tags,
       topology_data AS "topologyData",
       sort_order AS "sortOrder",
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    params
  );
  return row as unknown as Domain | null;
}

export async function deleteDomain(id: string): Promise<boolean> {
  await query(
    'UPDATE domains SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return true;
}

// ──────────── Summary ────────────

export async function getDomainSummary(): Promise<
  { id: string; name: string; serviceCount: number; assetCount: number }[]
> {
  const rows = await query<Record<string, unknown>>(
    `SELECT 
      s.id, s.name,
      COUNT(DISTINCT svc.id)::int AS "serviceCount",
      COUNT(DISTINCT sab.asset_id)::int AS "assetCount"
    FROM domains s
    LEFT JOIN services svc ON svc.domain_id = s.id AND svc.deleted_at IS NULL
    LEFT JOIN service_asset_bindings sab ON sab.service_id = svc.id AND sab.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
    GROUP BY s.id, s.name
    ORDER BY s.sort_order ASC, s.name ASC`
  );
  return rows as {
    id: string;
    name: string;
    serviceCount: number;
    assetCount: number;
  }[];
}
