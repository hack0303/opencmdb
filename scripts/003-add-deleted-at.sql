-- ═══════════════════════════════════════════════════════════
-- OpenCMDB — Add Logical Deletion Support
-- ═══════════════════════════════════════════════════════════
-- Adds deleted_at column to asset_templates and asset_instances.
-- All existing queries are updated to filter WHERE deleted_at IS NULL.
-- The delete endpoint now performs soft delete (SET deleted_at = now()).
-- ═══════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 1. Add deleted_at to asset_templates
-- ──────────────────────────────────────────────
ALTER TABLE asset_templates
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 部分索引：加速活跃模板的查询
CREATE INDEX IF NOT EXISTS idx_asset_templates_active
    ON asset_templates (updated_at DESC)
    WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────
-- 2. Add deleted_at to asset_instances
-- ──────────────────────────────────────────────
ALTER TABLE asset_instances
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 部分索引：加速活跃资产的查询 + 排序
CREATE INDEX IF NOT EXISTS idx_asset_instances_active
    ON asset_instances (updated_at DESC)
    WHERE deleted_at IS NULL;

-- 复合部分索引：按模板过滤活跃资产
CREATE INDEX IF NOT EXISTS idx_asset_instances_active_template
    ON asset_instances (template_id, updated_at DESC)
    WHERE deleted_at IS NULL;

-- 复合部分索引：按状态过滤活跃资产
CREATE INDEX IF NOT EXISTS idx_asset_instances_active_state
    ON asset_instances (current_state, updated_at DESC)
    WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════
-- 结束
-- ═══════════════════════════════════════════════════════════
