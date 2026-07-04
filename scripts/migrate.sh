#!/bin/bash
# ═══════════════════════════════════════════════════════════
# OpenCMDB — 数据库迁移脚本
# 用法: ./scripts/migrate.sh [选项]
# ═══════════════════════════════════════════════════════════

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-opencmdb}"
DB_USER="${DB_USER:-opencmdb_rw}"
DB_PASS="${DB_PASS:-}"
MIGRATIONS_DIR="$(dirname "$0")"

export PGPASSWORD="$DB_PASS"

usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --dry-run         Preview SQL without executing"
    echo "  --host HOST       Database host (default: $DB_HOST)"
    echo "  --port PORT       Database port (default: $DB_PORT)"
    echo "  --user USER       Database user (default: $DB_USER)"
    echo "  --dbname NAME     Database name (default: $DB_NAME)"
    echo "  --seed-only       Only run seed data (skip schema)"
    echo "  --schema-only     Only run schema (skip seed data)"
    echo "  -h, --help        Show this help"
    exit 0
}

DRY_RUN=false
SEED_ONLY=false
SCHEMA_ONLY=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)   DRY_RUN=true; shift ;;
        --host)      DB_HOST="$2"; shift 2 ;;
        --port)      DB_PORT="$2"; shift 2 ;;
        --user)      DB_USER="$2"; shift 2 ;;
        --dbname)    DB_NAME="$2"; shift 2 ;;
        --seed-only) SEED_ONLY=true; shift ;;
        --schema-only) SCHEMA_ONLY=true; shift ;;
        -h|--help)   usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

echo "═══════════════════════════════════════════"
echo " OpenCMDB Migration"
echo " Host:     $DB_HOST:$DB_PORT"
echo " Database: $DB_NAME"
echo " User:     $DB_USER"
echo "═══════════════════════════════════════════"

# ── 1. Schema ──
if [ "$SEED_ONLY" = false ]; then
    SCHEMA_FILE="$MIGRATIONS_DIR/001-schema-assets.sql"
    echo ""
    echo "▶ [1/2] Applying schema: $(basename "$SCHEMA_FILE")"

    if [ "$DRY_RUN" = true ]; then
        echo "  [DRY-RUN] Would execute:"
        head -5 "$SCHEMA_FILE"
        echo "  ... (truncated)"
    else
        $PSQL_CMD -f "$SCHEMA_FILE"
        echo "  ✅ Schema applied"
    fi
fi

# ── 2. Seed Data (if schema-only is not set) ──
if [ "$SCHEMA_ONLY" = false ] && [ "$SEED_ONLY" = false ]; then
    echo ""
    echo "▶ [2/2] Schema + seed data applied"
elif [ "$SEED_ONLY" = true ]; then
    echo ""
    echo "▶ Seed data applied"
fi

echo ""
echo "═══════════════════════════════════════════"
echo " ✅ Migration complete"
echo "═══════════════════════════════════════════"
