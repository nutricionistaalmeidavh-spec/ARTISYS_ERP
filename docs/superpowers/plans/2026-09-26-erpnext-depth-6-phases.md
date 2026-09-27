# ERPNext Depth 6 Phases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the six approved depth-expansion workstreams in ArtiSys ERP without replacing existing strong operational modules, and keep the next-stage gate locked until all six phases have implementation, tests, and verification evidence.

**Architecture:** Add focused domain services and migrations per phase, wire them through the existing ERP runtime/router/frontend patterns, and preserve local-first SQLite/Electron behavior. Each phase is independently testable and may be developed in any order, but the roadmap manifest only marks a phase complete after domain/API/UI verification evidence exists.

**Tech Stack:** Node.js 22, CommonJS domain services, SQLite migrations, HTTP API routers, React/Vite frontend, node:test, Playwright/Electron E2E.

**Spec:** `docs/superpowers/specs/2026-09-26-erpnext-depth-6-phases-design.md`

## Global Constraints

- Preserve existing WMS, procurement, finance, sales, fiscal, manufacturing/MRP and traceability contracts.
- Keep implementations native to ArtiSys; ERPNext is a functional benchmark only and GPL code must not be copied.
- Multi-company isolation and RBAC apply to every new domain.
- Posted/accounted state changes use reversal/corrective records rather than destructive mutation where the spec requires auditability.
- The next product stage remains locked until all six phases are completed with non-empty implementation, tests, and verification evidence.

## Review Focus

- Cross-company data leakage must be rejected for every new entity and query.
- Monetary totals and accounting postings must remain integer-cent based and deterministic.
- State transitions must reject invalid/repeated actions and remain idempotent where an external/operational source can retry.
- New operational links must not break existing inventory, finance, procurement, sales, manufacturing or fiscal flows.
- `roadmap:validate` must stay green during partial execution while `roadmap:require-complete` must fail until 6/6.

---

### Task 1: Accounting Core
- [ ] RED: `test/accounting-core.test.js`
- [ ] Migration/service/API/UI wiring
- [ ] GREEN + evidence

### Task 2: Projects 2.0
- [ ] RED: `test/projects-2.test.js`
- [ ] Migration/service/API/UI wiring
- [ ] GREEN + evidence

### Task 3: CRM
- [ ] RED: `test/crm.test.js`
- [ ] Migration/service/API/UI wiring
- [ ] GREEN + evidence

### Task 4: Manufacturing Shop Floor
- [ ] RED: `test/manufacturing-shop-floor.test.js`
- [ ] Migration/service/API/UI wiring
- [ ] GREEN + evidence

### Task 5: Stock Logistics
- [ ] RED: `test/stock-logistics.test.js`
- [ ] Migration/service/API/UI wiring
- [ ] GREEN + evidence

### Task 6: Asset Accounting
- [ ] RED: `test/asset-accounting.test.js`
- [ ] Migration/service/API/UI/accounting wiring
- [ ] GREEN + evidence

### Task 7: Six-Phase Integration and Gate Closure
- [ ] Run all targeted tests
- [ ] Run full `npm run verify`, coverage and E2E
- [ ] Record implementation/test/verification evidence for all six phases
- [ ] Mark 6/6 completed
- [ ] Require `npm run roadmap:require-complete` PASS
