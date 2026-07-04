---
title: "Feature Overview — OpenCMDB Asset Registration"
summary: "Combined reference: core design + feature guide for the dynamic meta-model asset registration system"
read_when:
  - "getting a quick overview of the entire asset registration feature"
  - "navigating between core design and usage documentation"
  - "onboarding new developers to the OpenCMDB project"
scope:
  - assets
  - auth
  - database
  - frontend
status: "active"
updated: "2026-07-04"
---

# OpenCMDB — Asset Registration Feature

## Document Index

This documentation is split into two focused documents:

| Document | Content |
|----------|---------|
| **[feat/core.md](feat/core.md)** | Architecture, dynamic meta-model design, database schema, data flow, indexes, data access layer |
| **[feat01.md](feat01.md)** | Authentication, AI-oriented views, capability-based query, format transformer, usage guide, route map |

## Quick Summary

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Human Admin │────→│  Asset Templates  │────→│   AI Agent  │
│  (define)    │     │  (meta-model)     │     │  (consume)  │
│              │     │                   │     │             │
│  Templates:  │     │  schema_def JSONB │     │  capability │
│  Quarkus     │     │  state_mapping    │     │  -based     │
│  GPU Node   │     │  capabilities     │     │  query      │
│  PostgreSQL │     │                   │     │             │
│  APISIX     │     │  Instances fill:   │     │  Token      │
│  Qdrant     │     │  attributes        │     │  minimizer  │
│              │     │  current_state    │     │             │
│  Login:      │     │  capabilities     │     │  YAML/      │
│  opencmdb/   │     │                   │     │  Markdown   │
│  opencmdb    │     └──────────────────┘     └─────────────┘
```

## Pre-built Data

### 5 Templates

| ID | Name | Category |
|----|------|----------|
| `tmpl-srv-001` | Quarkus Microservice | software |
| `tmpl-hw-001` | GPU Compute Node | hardware |
| `tmpl-db-001` | PostgreSQL Database | storage |
| `tmpl-gw-001` | APISIX Gateway | software |
| `tmpl-vec-001` | Qdrant Vector DB | storage |

### 3 Instances

| ID | Name | Template | State |
|----|------|----------|-------|
| `ast-srv-001` | cland-user-service-01 | Quarkus Microservice | RUNNING |
| `ast-hw-001` | gpu-node-ai-01 | GPU Compute Node | ONLINE |
| `ast-db-001` | cland-db-primary | PostgreSQL Database | RUNNING |

## Quick Start

```bash
# 1. Start dev server
npm run dev

# 2. Open browser
open http://localhost:3002

# 3. Login
Username: opencmdb
Password: opencmdb

# 4. Explore
/dashboard/assets           # 资产列表
/dashboard/assets/new       # 注册新资产
/dashboard/assets/templates # 模板管理
```

## Next Steps

- Read [feat/core.md](feat/core.md) for architecture and database design
- Read [feat01.md](feat01.md) for login, AI views, and usage instructions
- Read [db.md](db.md) for detailed database reference
