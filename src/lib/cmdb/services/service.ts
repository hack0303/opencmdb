// ═══════════════════════════════════════════════════════════
// Service Service — Data Access Layer
// ═══════════════════════════════════════════════════════════
// Pattern: Server Actions + Direct PostgreSQL
// ═══════════════════════════════════════════════════════════

'use server';

import { query, queryOne } from '@/lib/db';
import type {
  Service,
  ServiceWithDetails,
  ServiceFilters,
  ServicesResponse,
  ServiceMutationPayload
} from './types';

// ──────────── Helper ────────────

function buildWhereClause(
  filters: Record<string, unknown>,
  allowed: string[]
): [string, unknown[]] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  const tableAlias = 'svc';

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
      case 'domainId':
        clauses.push(`${tableAlias}.domain_id = $${idx}`);
        params.push(val);
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

export async function getServices(filters: ServiceFilters): Promise<ServicesResponse> {
  const { page = 1, limit = 10, sort } = filters;

  const [whereClause, whereParams] = buildWhereClause(filters as Record<string, unknown>, [
    'search',
    'domainId',
    'tag'
  ]);

  let orderBy = 'ORDER BY svc.sort_order ASC, svc.name ASC';
  if (sort) {
    try {
      const sortItems = JSON.parse(sort) as { id: string; desc: boolean }[];
      if (sortItems.length > 0) {
        const { id, desc } = sortItems[0];
        const colMap: Record<string, string> = {
          name: 'svc.name',
          domainName: 'sub.name',
          sortOrder: 'svc.sort_order',
          updatedAt: 'svc.updated_at'
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
    `SELECT COUNT(*) FROM services svc ${whereClause}`,
    whereParams
  );
  const total = parseInt(countResult[0]?.count ?? '0', 10);

  const items = await query<Record<string, unknown>>(
    `SELECT 
      svc.id, svc.name, svc.description,
      svc.domain_id AS "domainId",
      sub.name AS "domainName",
      svc.tags,
      svc.semantic_roles AS "semanticRoles",
      svc.sort_order AS "sortOrder",
      svc.created_at AS "createdAt",
      svc.updated_at AS "updatedAt"
    FROM services svc
    LEFT JOIN domains sub ON sub.id = svc.domain_id AND sub.deleted_at IS NULL
    ${whereClause} ${orderBy}
    LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`,
    [...whereParams, limit, offset]
  );

  return { items: items as unknown as Service[], total_items: total };
}

export async function getServiceById(id: string): Promise<ServiceWithDetails | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT 
      svc.id, svc.name, svc.description,
      svc.domain_id AS "domainId",
      sub.name AS "domainName",
      svc.tags,
      svc.semantic_roles AS "semanticRoles",
      svc.sort_order AS "sortOrder",
      svc.created_at AS "createdAt",
      svc.updated_at AS "updatedAt"
    FROM services svc
    LEFT JOIN domains sub ON sub.id = svc.domain_id AND sub.deleted_at IS NULL
    WHERE svc.id = $1 AND svc.deleted_at IS NULL`,
    [id]
  );

  if (!row) return null;

  const service = row as unknown as ServiceWithDetails;

  // Get asset bindings via service_asset_bindings
  const assets = await query<Record<string, unknown>>(
    `SELECT 
      ast.id, ast.name,
      ast.template_id AS "templateId",
      tmpl.name AS "templateName",
      ast.current_state AS "currentState"
    FROM service_asset_bindings sab
    JOIN asset_instances ast ON ast.id = sab.asset_id AND ast.deleted_at IS NULL
    LEFT JOIN asset_templates tmpl ON tmpl.id = ast.template_id
    WHERE sab.service_id = $1 AND sab.deleted_at IS NULL
    ORDER BY sab.sort_order ASC NULLS LAST, ast.name ASC`,
    [id]
  );
  service.assets = assets as ServiceWithDetails['assets'];

  // Get link relationships
  const asSource = await query<Record<string, unknown>>(
    `SELECT 
      sl.target_svc_id AS "targetId",
      tgt.name AS "targetName",
      sl.link_type AS "type",
      sl.label
    FROM service_links sl
    LEFT JOIN services tgt ON tgt.id = sl.target_svc_id AND tgt.deleted_at IS NULL
    WHERE sl.source_svc_id = $1 AND sl.deleted_at IS NULL
    ORDER BY sl.link_type, sl.label`,
    [id]
  );
  type LinksShape = NonNullable<ServiceWithDetails['links']>;

  service.links = {
    asSource: asSource as LinksShape['asSource'],
    asTarget: []
  };

  const asTarget = await query<Record<string, unknown>>(
    `SELECT 
      sl.source_svc_id AS "sourceId",
      src.name AS "sourceName",
      sl.link_type AS "type",
      sl.label
    FROM service_links sl
    LEFT JOIN services src ON src.id = sl.source_svc_id AND src.deleted_at IS NULL
    WHERE sl.target_svc_id = $1 AND sl.deleted_at IS NULL
    ORDER BY sl.link_type, sl.label`,
    [id]
  );
  service.links.asTarget = asTarget as LinksShape['asTarget'];

  return service;
}

// ──────────── Mutations ────────────

export async function createService(data: ServiceMutationPayload): Promise<Service> {
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO services (id, name, description, domain_id, tags, semantic_roles, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING 
       id, name, description, domain_id AS "domainId",
       tags, semantic_roles AS "semanticRoles",
       sort_order AS "sortOrder",
       created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      `svc-${Date.now()}`,
      data.name,
      data.description,
      data.domainId,
      data.tags,
      JSON.stringify(data.semanticRoles),
      data.sortOrder ?? 0
    ]
  );
  return row as unknown as Service;
}

export async function updateService(
  id: string,
  data: Partial<ServiceMutationPayload>
): Promise<Service | null> {
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
  if (data.domainId !== undefined) {
    sets.push(`domain_id = $${idx++}`);
    params.push(data.domainId);
  }
  if (data.tags !== undefined) {
    sets.push(`tags = $${idx++}`);
    params.push(data.tags);
  }
  if (data.semanticRoles !== undefined) {
    sets.push(`semantic_roles = $${idx++}::jsonb`);
    params.push(JSON.stringify(data.semanticRoles));
  }
  if (data.sortOrder !== undefined) {
    sets.push(`sort_order = $${idx++}`);
    params.push(data.sortOrder);
  }

  if (sets.length === 0) return null;
  sets.push(`updated_at = now()`);
  params.push(id);

  const row = await queryOne<Record<string, unknown>>(
    `UPDATE services SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING 
       id, name, description, domain_id AS "domainId",
       tags, semantic_roles AS "semanticRoles",
       sort_order AS "sortOrder",
       created_at AS "createdAt", updated_at AS "updatedAt"`,
    params
  );
  return row as unknown as Service | null;
}

export async function deleteService(id: string): Promise<boolean> {
  await query(
    'UPDATE services SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return true;
}

// ──────────── Service Links ────────────

export async function createServiceLink(data: {
  domainId: string;
  sourceSvcId: string;
  targetSvcId: string;
  linkType: 'sync' | 'async_command' | 'async_event';
  label: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const linkId = `lnk-${Date.now()}`;

  await query(
    `INSERT INTO service_links (id, domain_id, source_svc_id, target_svc_id, link_type, label, metadata)
     VALUES ($1, $2, $3, $4, $5::link_type, $6, $7::jsonb)
     ON CONFLICT (domain_id, source_svc_id, target_svc_id, link_type) DO UPDATE
       SET label = EXCLUDED.label, metadata = EXCLUDED.metadata, deleted_at = NULL`,
    [
      linkId,
      data.domainId,
      data.sourceSvcId,
      data.targetSvcId,
      data.linkType,
      data.label,
      JSON.stringify(data.metadata ?? {})
    ]
  );

  // Also update domain topology_data so the graph shows the new edge immediately
  const newEdge = JSON.stringify({
    id: linkId,
    source: data.sourceSvcId,
    target: data.targetSvcId,
    label: data.label,
    type: data.linkType
  });
  await query(
    `UPDATE domains
     SET topology_data = jsonb_set(
       topology_data,
       '{edges}',
       COALESCE(topology_data->'edges', '[]'::jsonb) || $1::jsonb,
       true
     )
     WHERE id = $2 AND deleted_at IS NULL`,
    [newEdge, data.domainId]
  );

  return true;
}

export async function createServiceLinks(
  items: {
    domainId: string;
    sourceSvcId: string;
    targetSvcId: string;
    linkType: 'sync' | 'async_command' | 'async_event';
    label: string;
    metadata?: Record<string, unknown>;
  }[]
): Promise<number> {
  if (items.length === 0) return 0;

  const domainId = items[0].domainId;
  const ts = Date.now();
  const edges: Record<string, unknown>[] = [];
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (let i = 0; i < items.length; i++) {
    const d = items[i];
    const linkId = `lnk-${ts}-${i}`;
    placeholders.push(
      `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}::link_type, $${idx + 5}, $${idx + 6}::jsonb)`
    );
    values.push(
      linkId,
      d.domainId,
      d.sourceSvcId,
      d.targetSvcId,
      d.linkType,
      d.label,
      JSON.stringify(d.metadata ?? {})
    );
    idx += 7;

    edges.push({
      id: linkId,
      source: d.sourceSvcId,
      target: d.targetSvcId,
      label: d.label,
      type: d.linkType
    });
  }

  await query(
    `INSERT INTO service_links (id, domain_id, source_svc_id, target_svc_id, link_type, label, metadata)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (domain_id, source_svc_id, target_svc_id, link_type) DO UPDATE
       SET label = EXCLUDED.label, metadata = EXCLUDED.metadata, deleted_at = NULL`,
    values
  );

  // Batch update domain topology_data with all edges at once
  const edgesJson = JSON.stringify(edges);
  await query(
    `UPDATE domains
     SET topology_data = jsonb_set(
       topology_data,
       '{edges}',
       COALESCE(topology_data->'edges', '[]'::jsonb) || $1::jsonb,
       true
     )
     WHERE id = $2 AND deleted_at IS NULL`,
    [edgesJson, domainId]
  );

  return items.length;
}

export async function updateServiceLink(data: {
  linkId: string;
  domainId: string;
  sourceSvcId: string;
  targetSvcId: string;
  linkType: 'sync' | 'async_command' | 'async_event';
  label: string;
}): Promise<boolean> {
  // Strategy: delete old + create new (avoids complex JSONB in-place update)
  // 1. Delete old link
  await query('UPDATE service_links SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', [
    data.linkId
  ]);
  // 2. Remove old edge from topology_data
  await query(
    `UPDATE domains
     SET topology_data = jsonb_set(
       topology_data,
       '{edges}',
       COALESCE(
         (SELECT jsonb_agg(elem) FROM jsonb_array_elements(topology_data->'edges') AS elem WHERE elem->>'id' <> $1),
         '[]'::jsonb
       ),
       true
     )
     WHERE id = $2 AND deleted_at IS NULL`,
    [data.linkId, data.domainId]
  );

  // 3. Re-insert with same ID (ON CONFLICT handles the soft-deleted old row)
  const newLinkId = data.linkId;
  await query(
    `INSERT INTO service_links (id, domain_id, source_svc_id, target_svc_id, link_type, label, metadata)
     VALUES ($1, $2, $3, $4, $5::link_type, $6, $7::jsonb)
     ON CONFLICT (domain_id, source_svc_id, target_svc_id, link_type) DO UPDATE
       SET id = EXCLUDED.id, label = EXCLUDED.label, deleted_at = NULL, updated_at = now()`,
    [newLinkId, data.domainId, data.sourceSvcId, data.targetSvcId, data.linkType, data.label, '{}']
  );

  // 4. Ensure topology_data edge has the correct ID
  await query(
    `UPDATE domains
     SET topology_data = jsonb_set(
       topology_data,
       '{edges}',
       (SELECT COALESCE(
         jsonb_agg(
           CASE WHEN elem->>'id' = $1 THEN
             jsonb_build_object('id', $1, 'source', $2, 'target', $3, 'label', $4, 'type', $5)
           ELSE elem END
         ),
         '[]'::jsonb
       )
       FROM jsonb_array_elements(COALESCE(topology_data->'edges', '[]'::jsonb)) AS elem),
       true
     )
     WHERE id = $6 AND deleted_at IS NULL`,
    [newLinkId, data.sourceSvcId, data.targetSvcId, data.label, data.linkType, data.domainId]
  );

  return true;
}

export async function deleteServiceLink(linkId: string, domainId: string): Promise<boolean> {
  await query('UPDATE service_links SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', [
    linkId
  ]);

  // Remove edge from topology_data
  await query(
    `UPDATE domains
     SET topology_data = jsonb_set(
       topology_data,
       '{edges}',
       (
         SELECT COALESCE(jsonb_agg(elem) FILTER (WHERE elem->>'id' <> $1), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(topology_data->'edges', '[]'::jsonb)) AS elem
       ),
       true
     )
     WHERE id = $2 AND deleted_at IS NULL`,
    [linkId, domainId]
  );

  return true;
}

// ──────────── Service-Asset Bindings ────────────

export type ServiceBinding = {
  id: string;
  serviceId: string;
  assetId: string;
  assetName: string;
  assetTemplateName: string;
  assetState: string;
  bindingType: string;
  semanticRole: string | null;
  createdAt: string;
};

export async function getServiceBindings(serviceId: string): Promise<ServiceBinding[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT 
      sab.id, sab.service_id AS "serviceId",
      sab.asset_id AS "assetId",
      ast.name AS "assetName",
      tmpl.name AS "assetTemplateName",
      ast.current_state AS "assetState",
      sab.binding_type AS "bindingType",
      sab.semantic_role AS "semanticRole",
      sab.created_at AS "createdAt"
    FROM service_asset_bindings sab
    JOIN asset_instances ast ON ast.id = sab.asset_id AND ast.deleted_at IS NULL
    LEFT JOIN asset_templates tmpl ON tmpl.id = ast.template_id
    WHERE sab.service_id = $1 AND sab.deleted_at IS NULL
    ORDER BY sab.created_at DESC`,
    [serviceId]
  );
  return rows as ServiceBinding[];
}

export async function bindAssetToService(data: {
  serviceId: string;
  assetId: string;
  bindingType?: string;
  semanticRole?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  // Get next sort_order for this service
  const maxRow = await queryOne<{ max_sort: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS max_sort
     FROM service_asset_bindings
     WHERE service_id = $1 AND deleted_at IS NULL`,
    [data.serviceId]
  );
  const nextSort = maxRow?.max_sort ?? 0;

  await query(
    `INSERT INTO service_asset_bindings (id, service_id, asset_id, binding_type, semantic_role, metadata, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (service_id, asset_id) DO UPDATE
       SET binding_type = EXCLUDED.binding_type,
           semantic_role = EXCLUDED.semantic_role,
           metadata = EXCLUDED.metadata,
           sort_order = EXCLUDED.sort_order,
           updated_at = now(),
           deleted_at = NULL`,
    [
      `bind-${Date.now()}`,
      data.serviceId,
      data.assetId,
      data.bindingType ?? 'direct',
      data.semanticRole ?? null,
      JSON.stringify(data.metadata ?? {}),
      nextSort
    ]
  );
  return true;
}

// ──────────── Root / Primary ────────────

export async function setRootBinding(serviceId: string, assetId: string): Promise<boolean> {
  // Clear root from all other bindings for this service
  await query(
    `UPDATE service_asset_bindings
     SET sort_order = 1, updated_at = now()
     WHERE service_id = $1 AND asset_id != $2 AND deleted_at IS NULL AND sort_order = 0`,
    [serviceId, assetId]
  );
  // Set this asset as root
  await query(
    `UPDATE service_asset_bindings
     SET sort_order = 0, updated_at = now()
     WHERE service_id = $1 AND asset_id = $2 AND deleted_at IS NULL`,
    [serviceId, assetId]
  );
  return true;
}

export async function unbindAssetFromService(bindingId: string): Promise<boolean> {
  await query(
    'UPDATE service_asset_bindings SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [bindingId]
  );
  return true;
}

export async function unlinkAllServiceAssets(serviceId: string): Promise<boolean> {
  await query(
    'UPDATE service_asset_bindings SET deleted_at = now() WHERE service_id = $1 AND deleted_at IS NULL',
    [serviceId]
  );
  return true;
}
