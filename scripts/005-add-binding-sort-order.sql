-- ═══════════════════════════════════════════════════════════
-- Migration 005: Add sort_order to service_asset_bindings
-- ═══════════════════════════════════════════════════════════

ALTER TABLE service_asset_bindings
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE service_asset_bindings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
