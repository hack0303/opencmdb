-- ═══════════════════════════════════════════════════════════
-- OpenCMDB — Asset Meta-Model Schema
-- ═══════════════════════════════════════════════════════════
-- 设计原则：
--   1. 动态元模型：属性/状态映射/能力契约 均以 JSONB 存储
--   2. 标签数组 + GIN 索引：支持能力检索和跨类型查询
--   3. 模板与实例通过 template_id 关联
-- ═══════════════════════════════════════════════════════════

-- 扩展（用于增强搜索，如不可用可注释掉）
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ──────────────────────────────────────────────
-- 1. 资产类型模板表 (Asset Templates)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_templates (
    id              VARCHAR(64)     PRIMARY KEY,               -- 如 tmpl-srv-001
    name            VARCHAR(255)    NOT NULL,                   -- 模板名，如 "Quarkus Microservice"
    category        VARCHAR(64)     NOT NULL,                   -- 分类: hardware / software / storage
    description     TEXT            NOT NULL DEFAULT '',
    
    -- 动态属性 JSON Schema（定义该类资产的可配置属性）
    schema_def      JSONB           NOT NULL DEFAULT '{}'::jsonb,
    
    -- 默认状态映射
    state_mapping   JSONB           NOT NULL DEFAULT '{}'::jsonb,
    
    -- 默认能力契约
    capabilities    JSONB           NOT NULL DEFAULT '[]'::jsonb,
    
    -- 标签（用于分类检索）
    tags            TEXT[]          NOT NULL DEFAULT '{}',
    
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- 约束
    CONSTRAINT chk_category CHECK (category IN ('hardware', 'software', 'storage'))
);

-- 标签索引（GIN 用于数组包含查询）
CREATE INDEX idx_asset_templates_tags_gin ON asset_templates USING GIN (tags);
CREATE INDEX idx_asset_templates_category ON asset_templates (category);

-- ──────────────────────────────────────────────
-- 2. 资产实例表 (Asset Instances)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_instances (
    id              VARCHAR(64)     PRIMARY KEY,               -- 如 ast-srv-001
    template_id     VARCHAR(64)     NOT NULL REFERENCES asset_templates(id) ON DELETE RESTRICT,
    name            VARCHAR(255)    NOT NULL,                   -- 资产名，如 "cland-user-service-01"
    description     TEXT            NOT NULL DEFAULT '',
    
    -- ① 固有属性：动态键值对，由模板 schema_def 定义形状
    attributes      JSONB           NOT NULL DEFAULT '{}'::jsonb,
    
    -- ② 状态映射：当前状态枚举 + 判定条件
    state_mapping   JSONB           NOT NULL DEFAULT '{}'::jsonb,
    
    -- 当前状态
    current_state   VARCHAR(64)     NOT NULL DEFAULT 'UNKNOWN',
    
    -- ③ 语义能力契约：工具定义列表
    capabilities    JSONB           NOT NULL DEFAULT '[]'::jsonb,
    
    -- 标签（用于能力检索、跨类型查询）
    tags            TEXT[]          NOT NULL DEFAULT '{}',
    
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_asset_instances_template ON asset_instances (template_id);
CREATE INDEX idx_asset_instances_state ON asset_instances (current_state);
CREATE INDEX idx_asset_instances_tags_gin ON asset_instances USING GIN (tags);

-- JSONB 索引：支持对 attributes 字段的高效查询
CREATE INDEX idx_asset_instances_attrs_gin ON asset_instances USING GIN (attributes);

-- 能力名称索引（GIN 表达式索引 → 支持 "查询具备 Payment 能力的资产"）
CREATE INDEX idx_asset_instances_cap_names_gin 
    ON asset_instances USING GIN (jsonb_path_query_array(capabilities, '$.name'));

-- 更新时间索引（排序用）
CREATE INDEX idx_asset_instances_updated_desc ON asset_instances (updated_at DESC);

-- ──────────────────────────────────────────────
-- 3. 自动更新 updated_at 触发器
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_asset_templates_updated_at') THEN
        CREATE TRIGGER trg_asset_templates_updated_at
            BEFORE UPDATE ON asset_templates
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_asset_instances_updated_at') THEN
        CREATE TRIGGER trg_asset_instances_updated_at
            BEFORE UPDATE ON asset_instances
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- ──────────────────────────────────────────────
-- 4. 权限
-- ──────────────────────────────────────────────
-- 读写角色
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO opencmdb_rw;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO opencmdb_rw;

-- 只读角色
GRANT SELECT ON ALL TABLES IN SCHEMA public TO opencmdb_ro;

-- ──────────────────────────────────────────────
-- 5. 种子数据：预置资产类型模板
-- ──────────────────────────────────────────────
INSERT INTO asset_templates (id, name, category, description, schema_def, state_mapping, capabilities, tags) VALUES
(
    'tmpl-srv-001',
    'Quarkus Microservice',
    'software',
    'Quarkus-based Java microservice with REST API',
    '{
        "type": "object",
        "properties": {
            "version": {"type": "string", "title": "Runtime Version", "description": "e.g. Java 21, Java 25"},
            "port": {"type": "number", "title": "Service Port", "description": "HTTP listen port"},
            "apiPrefix": {"type": "string", "title": "API Prefix", "description": "e.g. /api/v1"},
            "upstreamDeps": {"type": "string", "title": "Upstream Dependencies", "description": "Comma-separated upstream services"}
        },
        "required": ["version", "port"]
    }'::jsonb,
    '{
        "states": ["BOOTING", "RUNNING", "DEGRADED", "STOPPED"],
        "initialState": "BOOTING",
        "conditions": {
            "RUNNING": "health === \"ok\" && uptime > 30",
            "DEGRADED": "health === \"degraded\"",
            "STOPPED": "health === \"down\""
        }
    }'::jsonb,
    '[
        {"name": "health_check", "description": "Check service health status", "method": "GET", "endpoint": "/health", "inputSchema": {}, "outputSchema": {"type": "object", "properties": {"status": {"type": "string"}}}},
        {"name": "metrics", "description": "Fetch Prometheus metrics", "method": "GET", "endpoint": "/metrics", "inputSchema": {}, "outputSchema": {"type": "object", "properties": {"data": {"type": "string"}}}}
    ]'::jsonb,
    ARRAY['service', 'java', 'quarkus', 'microservice']
),
(
    'tmpl-hw-001',
    'GPU Compute Node',
    'hardware',
    'NVIDIA GPU server for AI/ML workloads',
    '{
        "type": "object",
        "properties": {
            "cpu": {"type": "string", "title": "CPU Spec", "description": "e.g. 32c 64t"},
            "ram": {"type": "string", "title": "Memory", "description": "e.g. 256GB DDR5"},
            "gpu": {"type": "string", "title": "GPU Model", "description": "e.g. Tesla P40, A100"},
            "gpuCount": {"type": "number", "title": "GPU Count"},
            "ipmiAddr": {"type": "string", "title": "IPMI Address", "description": "Out-of-band management IP"},
            "location": {"type": "string", "title": "Physical Location", "description": "Rack, row, datacenter"}
        },
        "required": ["cpu", "gpu", "ipmiAddr"]
    }'::jsonb,
    '{
        "states": ["OFFLINE", "ONLINE", "DEGRADED", "MAINTENANCE"],
        "initialState": "OFFLINE",
        "conditions": {
            "ONLINE": "power === \"on\" && nvidia_smi_ok === true",
            "DEGRADED": "power === \"on\" && nvidia_smi_ok === false",
            "MAINTENANCE": "power === \"on\" && maintenance_mode === true"
        }
    }'::jsonb,
    '[
        {"name": "power_off", "description": "Gracefully power off the node", "inputSchema": {"type": "object", "properties": {"force": {"type": "boolean"}}}, "outputSchema": {"type": "object", "properties": {"success": {"type": "boolean"}}}},
        {"name": "reboot", "description": "Reboot the compute node", "inputSchema": {}, "outputSchema": {"type": "object", "properties": {"success": {"type": "boolean"}}}},
        {"name": "gpu_info", "description": "Query GPU utilization and memory", "method": "GET", "endpoint": "/nvidia-smi", "inputSchema": {}, "outputSchema": {"type": "object", "properties": {"gpuCount": {"type": "number"}, "utilization": {"type": "number"}, "memoryUsed": {"type": "string"}}}}
    ]'::jsonb,
    ARRAY['hardware', 'gpu', 'compute', 'nvidia']
),
(
    'tmpl-db-001',
    'PostgreSQL Database',
    'storage',
    'PostgreSQL relational database instance',
    '{
        "type": "object",
        "properties": {
            "version": {"type": "string", "title": "PG Version", "description": "e.g. 15, 16"},
            "connectionString": {"type": "string", "title": "JDBC Connection String"},
            "maxConnections": {"type": "number", "title": "Max Connections", "default": 100},
            "readReplicas": {"type": "number", "title": "Read Replica Count", "default": 0},
            "storageGB": {"type": "number", "title": "Storage (GB)"}
        },
        "required": ["version", "connectionString"]
    }'::jsonb,
    '{
        "states": ["PROVISIONING", "RUNNING", "DEGRADED", "STOPPED"],
        "initialState": "PROVISIONING",
        "conditions": {
            "RUNNING": "pg_is_ready === true && connections < maxConnections",
            "DEGRADED": "pg_is_ready === true && connections >= maxConnections * 0.9",
            "STOPPED": "pg_is_ready === false"
        }
    }'::jsonb,
    '[
        {"name": "query", "description": "Execute a read-only SQL query", "inputSchema": {"type": "object", "properties": {"sql": {"type": "string", "description": "SELECT query only"}}, "required": ["sql"]}, "outputSchema": {"type": "object", "properties": {"rows": {"type": "array"}}}},
        {"name": "pg_stat", "description": "Fetch database statistics", "method": "GET", "endpoint": "/pg_stat", "inputSchema": {}, "outputSchema": {"type": "object", "properties": {"activeConnections": {"type": "number"}, "replicationLag": {"type": "string"}, "cacheHitRatio": {"type": "number"}}}}
    ]'::jsonb,
    ARRAY['database', 'postgresql', 'storage', 'sql']
)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 结束
-- ═══════════════════════════════════════════════════════════
