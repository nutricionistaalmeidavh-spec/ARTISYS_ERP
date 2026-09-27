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

**Files:**
- Create: `js/core/database/migrations/180-accounting-core.js`
- Create: `js/domains/accounting/accounting-service.js`
- Create: `server/routers/accounting-router.js`
- Create: `test/accounting-core.test.js`
- Modify: migration index, ERP runtime, API router registration, frontend administration/intelligence surface as needed.

**Interfaces:**
- Produces: chart-of-accounts CRUD, accounting periods, balanced journal posting/reversal, general-ledger query, trial balance, balance sheet and accounting income statement.

- [ ] Write tests for unbalanced journal rejection, balanced posting, immutable posted journal/reversal, locked period, company isolation and trial balance.
- [ ] Verify tests fail before service/migration exist.
- [ ] Implement migration/service/API/UI wiring.
- [ ] Run unit/API/E2E verification and record evidence.
- [ ] Commit `feat: add accounting core`.

### Task 2: Projects 2.0

**Files:**
- Create: `js/core/database/migrations/181-projects-2.js`
- Create: `js/domains/projects/project-service.js`
- Create: `server/routers/projects-router.js`
- Create: `test/projects-2.test.js`
- Modify: runtime/router/UI integration.

**Interfaces:**
- Produces: richer project/task lifecycle, timesheets, rates, expenses/material/procurement/sales links, budgets, billing records and profitability reporting.

- [ ] Write tests for time/cost capture, project-company isolation, budget-vs-actual and profitability reconciliation.
- [ ] Verify RED.
- [ ] Implement migration/service/API/UI.
- [ ] Verify GREEN and integration.
- [ ] Commit `feat: deepen project operations`.

### Task 3: CRM

**Files:**
- Create: `js/core/database/migrations/182-crm.js`
- Create: `js/domains/crm/crm-service.js`
- Create: `server/routers/crm-router.js`
- Create: `test/crm.test.js`
- Modify: runtime/router/UI integration.

**Interfaces:**
- Produces: lead, opportunity, pipeline stage, activities/follow-up, ownership/source/loss reason, lead-to-customer/contact conversion and opportunity-to-quotation conversion hooks.

- [ ] Write tests for lifecycle/transitions, duplicate conversion prevention, company isolation and pipeline analytics.
- [ ] Verify RED.
- [ ] Implement migration/service/API/UI.
- [ ] Verify GREEN and integration.
- [ ] Commit `feat: add CRM pipeline`.

### Task 4: Manufacturing Shop Floor

**Files:**
- Create: `js/core/database/migrations/183-manufacturing-shop-floor.js`
- Create: `js/domains/manufacturing/shop-floor-service.js`
- Create: `server/routers/manufacturing-shop-floor-router.js`
- Create: `test/manufacturing-shop-floor.test.js`
- Modify: manufacturing runtime/UI integration.

**Interfaces:**
- Consumes: existing manufacturing orders/BOM/MRP.
- Produces: operations, routings, workstations, job cards, operation time/cost capture, WIP progress and quality inspections.

- [ ] Write tests for routing/job sequencing, workstation capacity, job-card time capture and quality pass/fail.
- [ ] Verify RED.
- [ ] Implement migration/service/API/UI.
- [ ] Verify GREEN and integration with current OP lifecycle.
- [ ] Commit `feat: add manufacturing shop floor`.

### Task 5: Stock Logistics

**Files:**
- Create: `js/core/database/migrations/184-stock-logistics.js`
- Create: `js/domains/inventory/stock-logistics-service.js`
- Create: `server/routers/stock-logistics-router.js`
- Create: `test/stock-logistics.test.js`
- Modify: inventory runtime/UI integration.

**Interfaces:**
- Consumes: existing reservations, positions, FIFO/FEFO and sales/procurement sources.
- Produces: pick/pack/ship workflow, putaway rules/suggestions and landed-cost allocation.

- [ ] Write tests for reservation-aware picking, package/shipment states, deterministic putaway and landed-cost allocation/remainder handling.
- [ ] Verify RED.
- [ ] Implement migration/service/API/UI.
- [ ] Verify GREEN and existing inventory invariants.
- [ ] Commit `feat: add stock logistics depth`.

### Task 6: Asset Accounting

**Files:**
- Create: `js/core/database/migrations/185-asset-accounting.js`
- Create: `js/domains/assets/asset-accounting-service.js`
- Create: `server/routers/assets-router.js`
- Create: `test/asset-accounting.test.js`
- Modify: operations/runtime/UI integration and Accounting Core adapter.

**Interfaces:**
- Consumes: existing operational assets/maintenance and Accounting Core.
- Produces: acquisition/capitalization, custody/location moves, depreciation schedules/posting, repair capitalization/expense classification, disposal/write-off.

- [ ] Write tests for depreciation schedule, posting totals, custody movement, disposal gain/loss and company isolation.
- [ ] Verify RED.
- [ ] Implement migration/service/API/UI/accounting adapter.
- [ ] Verify GREEN and accounting reconciliation.
- [ ] Commit `feat: add asset accounting lifecycle`.

### Task 7: Six-Phase Integration and Gate Closure

**Files:**
- Modify: `roadmap/erpnext-depth-6-phases.json`
- Modify: `qa/vertical-coverage.md`
- Add/modify: E2E coverage for all six areas.

**Interfaces:**
- Consumes: all six completed phases.
- Produces: 6/6 completed manifest with implementation/test/verification evidence; next stage remains locked until explicit later decision.

- [ ] Run targeted tests for all six modules.
- [ ] Run `npm run verify`, `npm run coverage`, and relevant Electron E2E.
- [ ] Record evidence in every phase and mark each `completed` only when evidence is non-empty.
- [ ] Run `npm run roadmap:require-complete` and require PASS.
- [ ] Run final branch verification and commit `chore: close ERP depth six-phase gate`.
