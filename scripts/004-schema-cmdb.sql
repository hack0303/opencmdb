-- ═══════════════════════════════════════════════════════════
-- OpenCMDB — Agent-Native CMDB: Domain & Service Layers
-- ═══════════════════════════════════════════════════════════
-- 三层语义架构：
--   1. 子域层 (domains) — 商业业务宏观切片，含服务链路拓扑
--   2. 服务层 (services) — 限界上下文，统一底层资产语义抽象
--   3. 资产层 (asset_instances) — 纯数据台账，无业务关联
-- 服务↔资产通过 service_asset_bindings 独立关联，归属 Layer 2 管辖
-- ═══════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 1. 子域表 (Domains) — 第一层：域/子域层
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domains (
    id              VARCHAR(64)     PRIMARY KEY,               -- 如 sub-payment-001
    name            VARCHAR(255)    NOT NULL,                   -- 子域名称，如 "Payment Processing"
    description     TEXT            NOT NULL DEFAULT '',        -- 业务描述
    tags            TEXT[]          NOT NULL DEFAULT '{}',      -- 标签
    topology_data   JSONB           NOT NULL DEFAULT '{}'::jsonb, -- 服务链路拓扑图 (nodes/edges)
    sort_order      INTEGER         NOT NULL DEFAULT 0,        -- 排序号
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ     DEFAULT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_domains_tags_gin ON domains USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_domains_active ON domains (sort_order, name) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────
-- 2. 服务表 (Services) — 第二层：服务/限界上下文
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
    id              VARCHAR(64)     PRIMARY KEY,               -- 如 svc-payment-ledger
    name            VARCHAR(255)    NOT NULL,                   -- 服务名，如 "Payment Ledger Service"
    description     TEXT            NOT NULL DEFAULT '',        -- 服务描述
    domain_id    VARCHAR(64)     REFERENCES domains(id) ON DELETE RESTRICT,  -- 所属子域
    tags            TEXT[]          NOT NULL DEFAULT '{}',      -- 标签
    -- 语义角色声明：如 "Ledger_DB", "Primary_Compute", "Command_Pipeline"
    semantic_roles  JSONB           NOT NULL DEFAULT '[]'::jsonb,
    sort_order      INTEGER         NOT NULL DEFAULT 0,        -- 排序号
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ     DEFAULT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_services_domain ON services (domain_id);
CREATE INDEX IF NOT EXISTS idx_services_tags_gin ON services USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_services_active ON services (sort_order, name) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────
-- 3. 服务链路表 (Service Links) — 拓扑边
-- ──────────────────────────────────────────────
CREATE TYPE link_type AS ENUM ('sync', 'async_command', 'async_event');

CREATE TABLE IF NOT EXISTS service_links (
    id              VARCHAR(64)     PRIMARY KEY,               -- 如 lnk-pymnt-ledger-001
    domain_id    VARCHAR(64)     NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    source_svc_id   VARCHAR(64)     NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    target_svc_id   VARCHAR(64)     NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    link_type       link_type       NOT NULL DEFAULT 'sync',   -- 链路类型
    label           VARCHAR(255)    NOT NULL DEFAULT '',        -- 链路描述，如 "POST /api/ledger/transactions"
    metadata        JSONB           NOT NULL DEFAULT '{}'::jsonb, -- 额外元数据（协议、端口等）
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ     DEFAULT NULL,
    CONSTRAINT uq_service_link UNIQUE (domain_id, source_svc_id, target_svc_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_service_links_domain ON service_links (domain_id);
CREATE INDEX IF NOT EXISTS idx_service_links_source ON service_links (source_svc_id);
CREATE INDEX IF NOT EXISTS idx_service_links_target ON service_links (target_svc_id);

-- ──────────────────────────────────────────────
-- 4. 服务-资产绑定表 (Service Asset Bindings) — 纯关联，不污染资产层
-- ──────────────────────────────────────────────
-- 资产层(Layer 3)为纯数据台账，不持有任何业务关联。
-- 服务对资产的引用通过独立的绑定表实现，归属服务层(Layer 2)。
CREATE TABLE IF NOT EXISTS service_asset_bindings (
    id              VARCHAR(64)     PRIMARY KEY,               -- 如 bind-ledger-db-001
    service_id      VARCHAR(64)     NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    asset_id        VARCHAR(64)     NOT NULL REFERENCES asset_instances(id) ON DELETE CASCADE,
    binding_type    VARCHAR(32)     NOT NULL DEFAULT 'direct', -- direct | semantic | capability
    semantic_role   VARCHAR(64),                                -- 如 Ledger_DB, Primary_Compute
    metadata        JSONB           NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ     DEFAULT NULL,
    CONSTRAINT uq_service_asset_binding UNIQUE (service_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_svc_asset_bindings_service ON service_asset_bindings (service_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_svc_asset_bindings_asset ON service_asset_bindings (asset_id) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────
-- 5. 触发器：自动更新 updated_at
-- ──────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_domains_updated_at') THEN
        CREATE TRIGGER trg_domains_updated_at
            BEFORE UPDATE ON domains
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_services_updated_at') THEN
        CREATE TRIGGER trg_services_updated_at
            BEFORE UPDATE ON services
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- ──────────────────────────────────────────────
-- 6. 权限
-- ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO opencmdb_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO opencmdb_ro;

-- ──────────────────────────────────────────────
-- 7. 种子数据：示例子域与服务
-- ──────────────────────────────────────────────

-- 子域：Payment System
INSERT INTO domains (id, name, description, tags, topology_data, sort_order) VALUES
(
    'sub-payment',
    'Payment System',
    'Payment processing, ledger management, and transaction settlement. The core financial backbone handling all money movement.',
    ARRAY['payment', 'finance', 'core'],
    '{
        "description": "Payment System Service Topology",
        "nodes": [],
        "edges": []
    }'::jsonb,
    1
),
(
    'sub-user',
    'User Management',
    'User registration, authentication, profile management, and role-based access control.',
    ARRAY['user', 'auth', 'identity'],
    '{
        "description": "User Management Service Topology",
        "nodes": [],
        "edges": []
    }'::jsonb,
    2
),
(
    'sub-notification',
    'Notification & Messaging',
    'Push notifications, email delivery, SMS alerts, and in-app messaging across all channels.',
    ARRAY['notification', 'messaging', 'communication'],
    '{
        "description": "Notification Service Topology",
        "nodes": [],
        "edges": []
    }'::jsonb,
    3
);

-- 服务：Payment System 下
INSERT INTO services (id, name, description, domain_id, tags, semantic_roles, sort_order) VALUES
(
    'svc-payment-ledger',
    'Payment Ledger Service',
    'Core double-entry ledger for all financial transactions. Records debits, credits, and maintains account balances.',
    'sub-payment',
    ARRAY['payment', 'ledger', 'java', 'quarkus'],
    '[
        {"role": "Ledger_DB", "description": "账本数据库 — 所有交易记录的权威数据源"},
        {"role": "Primary_Compute", "description": "核心算力节点 — 交易校验与余额计算"}
    ]'::jsonb,
    1
),
(
    'svc-payment-gateway',
    'Payment Gateway Service',
    'External payment provider integration. Routes transactions to upstream processors and handles callbacks.',
    'sub-payment',
    ARRAY['payment', 'gateway', 'node'],
    '[
        {"role": "Command_Pipeline", "description": "运维命令管道 — 外部支付路由"},
        {"role": "Primary_Compute", "description": "核心算力节点 — 交易路由与重试逻辑"}
    ]'::jsonb,
    2
),
(
    'svc-payment-clearing',
    'Clearing Service',
    'Transaction clearing and settlement between internal accounts and external partners.',
    'sub-payment',
    ARRAY['payment', 'clearing', 'settlement', 'java'],
    '[
        {"role": "Ledger_DB", "description": "清算台账 — 对账记录与结算状态"},
        {"role": "Command_Pipeline", "description": "运维命令管道 — 清算批次处理"}
    ]'::jsonb,
    3
);

-- 服务：User Management 下
INSERT INTO services (id, name, description, domain_id, tags, semantic_roles, sort_order) VALUES
(
    'svc-user-auth',
    'Auth Service',
    'Authentication and authorization service. Handles OAuth2, JWT issuance, session management, and RBAC.',
    'sub-user',
    ARRAY['auth', 'security', 'oauth', 'node'],
    '[
        {"role": "Primary_Compute", "description": "核心算力节点 — 令牌签发与验证"},
        {"role": "Command_Pipeline", "description": "运维命令管道 — 会话管理"}
    ]'::jsonb,
    1
),
(
    'svc-user-profile',
    'Profile Service',
    'User profile management. Stores preferences, settings, and personal information.',
    'sub-user',
    ARRAY['user', 'profile', 'storage'],
    '[
        {"role": "Ledger_DB", "description": "用户台账 — 个人数据存储"},
        {"role": "Primary_Compute", "description": "核心算力节点 — 画像计算"}
    ]'::jsonb,
    2
);

-- 服务：Notification & Messaging 下
INSERT INTO services (id, name, description, domain_id, tags, semantic_roles, sort_order) VALUES
(
    'svc-notify-push',
    'Push Notification Service',
    'Mobile push notification delivery via APNS, FCM, and WebSocket channels.',
    'sub-notification',
    ARRAY['notification', 'push', 'websocket'],
    '[
        {"role": "Command_Pipeline", "description": "运维命令管道 — 推送路由与投递"}
    ]'::jsonb,
    1
),
(
    'svc-notify-email',
    'Email Service',
    'Transactional email delivery with template management and delivery tracking.',
    'sub-notification',
    ARRAY['notification', 'email', 'template'],
    '[
        {"role": "Command_Pipeline", "description": "运维命令管道 — 邮件队列处理"}
    ]'::jsonb,
    2
);

-- 服务链路拓扑 (Payment System)
INSERT INTO service_links (id, domain_id, source_svc_id, target_svc_id, link_type, label, metadata) VALUES
(
    'lnk-pymnt-gw-ledger',
    'sub-payment',
    'svc-payment-gateway',
    'svc-payment-ledger',
    'sync',
    'POST /api/ledger/transactions',
    '{"protocol": "gRPC", "port": 8081, "timeout_ms": 5000}'::jsonb
),
(
    'lnk-pymnt-ledger-clearing',
    'sub-payment',
    'svc-payment-ledger',
    'svc-payment-clearing',
    'async_command',
    'clearing:batch:settle',
    '{"channel": "kafka", "topic": "payment.clearing.settle.v1", "consumer_group": "clearing-service"}'::jsonb
),
(
    'lnk-pymnt-gw-clearing',
    'sub-payment',
    'svc-payment-gateway',
    'svc-payment-clearing',
    'async_event',
    'payment.transaction.settled',
    '{"channel": "kafka", "topic": "payment.transaction.settled.v1", "type": "fanout"}'::jsonb
);

ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 结束
-- ═══════════════════════════════════════════════════════════
