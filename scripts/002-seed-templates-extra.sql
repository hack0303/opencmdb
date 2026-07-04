-- ═══════════════════════════════════════════════════════════
-- OpenCMDB — Additional Seed Data: Templates 4-5
-- ═══════════════════════════════════════════════════════════

INSERT INTO asset_templates (id, name, category, description, schema_def, state_mapping, capabilities, tags) VALUES
(
    'tmpl-gw-001',
    'APISIX Gateway',
    'software',
    'Apache APISIX API Gateway instance',
    '{
        "type": "object",
        "properties": {
            "version": {"type": "string", "title": "APISIX Version", "description": "e.g. 3.9"},
            "adminPort": {"type": "number", "title": "Admin API Port", "default": 9180},
            "httpPort": {"type": "number", "title": "HTTP Proxy Port", "default": 9080},
            "httpsPort": {"type": "number", "title": "HTTPS Proxy Port", "default": 9443},
            "upstreamCount": {"type": "number", "title": "Configured Upstreams"}
        },
        "required": ["version", "adminPort"]
    }'::jsonb,
    '{
        "states": ["INIT", "RUNNING", "DEGRADED", "DOWN"],
        "initialState": "INIT",
        "conditions": {
            "RUNNING": "admin_api_ok === true && routes_loaded === true",
            "DEGRADED": "admin_api_ok === true && routes_loaded === false",
            "DOWN": "admin_api_ok === false"
        }
    }'::jsonb,
    '[
        {"name": "list_routes", "description": "List all configured routes", "method": "GET", "endpoint": "/apisix/admin/routes", "inputSchema": {}, "outputSchema": {"type": "object", "properties": {"routes": {"type": "array"}}}},
        {"name": "reload", "description": "Hot-reload gateway configuration", "inputSchema": {}, "outputSchema": {"type": "object", "properties": {"success": {"type": "boolean"}}}}
    ]'::jsonb,
    ARRAY['gateway', 'apisix', 'proxy', 'software']
),
(
    'tmpl-vec-001',
    'Qdrant Vector DB',
    'storage',
    'Qdrant vector database for embeddings',
    '{
        "type": "object",
        "properties": {
            "version": {"type": "string", "title": "Qdrant Version"},
            "grpcPort": {"type": "number", "title": "gRPC Port", "default": 6334},
            "httpPort": {"type": "number", "title": "HTTP Port", "default": 6333},
            "collectionCount": {"type": "number", "title": "Number of Collections"},
            "vectorSize": {"type": "number", "title": "Default Vector Dimension"}
        },
        "required": ["version", "httpPort"]
    }'::jsonb,
    '{
        "states": ["STARTING", "READY", "DEGRADED", "STOPPED"],
        "initialState": "STARTING",
        "conditions": {
            "READY": "api_reachable === true && collections_loaded === true",
            "DEGRADED": "api_reachable === true && collections_loaded === false",
            "STOPPED": "api_reachable === false"
        }
    }'::jsonb,
    '[
        {"name": "search", "description": "Search nearest vectors", "method": "POST", "endpoint": "/collections/{name}/points/search", "inputSchema": {"type": "object", "properties": {"collection": {"type": "string"}, "vector": {"type": "array", "items": {"type": "number"}}, "limit": {"type": "number", "default": 10}}, "required": ["collection", "vector"]}, "outputSchema": {"type": "object", "properties": {"result": {"type": "array"}}}},
        {"name": "collection_stats", "description": "Get collection statistics", "method": "GET", "endpoint": "/collections/{name}", "inputSchema": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}, "outputSchema": {"type": "object", "properties": {"status": {"type": "string"}, "pointsCount": {"type": "number"}}}}
    ]'::jsonb,
    ARRAY['database', 'vector', 'qdrant', 'embeddings']
)
ON CONFLICT (id) DO NOTHING;
