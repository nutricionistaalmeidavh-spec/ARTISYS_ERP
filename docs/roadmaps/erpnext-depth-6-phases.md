# Roadmap — ArtiSys ERP Depth Expansion (6 phases)

Source spec: `docs/superpowers/specs/2026-09-26-erpnext-depth-6-phases-design.md`
Planning branch: `roadmap/erpnext-depth-6-phases`
Execution branch: `feat/erpnext-depth-6-phases`

## Objective

Close the highest-value depth gaps identified against mature ERP patterns while preserving the existing ArtiSys strengths in WMS, procurement, finance management, sales, fiscal, manufacturing/MRP and traceability.

The six phases are peer workstreams. They may be executed sequentially, in parallel, or in a mixed order. The next product stage remains locked until all six are complete with evidence.

## Phase map

| # | Phase | Core outcome | Initial status |
|---|---|---|---|
| 1 | Accounting Core | Double-entry accounting, GL and formal statements | Pending |
| 2 | Projects 2.0 | Timesheets, costs, billing and profitability | Pending |
| 3 | CRM | Lead/opportunity pipeline integrated into quotation | Pending |
| 4 | Manufacturing Shop Floor | Routing, workstations, job execution and quality | Pending |
| 5 | Stock Logistics | Pick/pack/ship, putaway and landed cost | Pending |
| 6 | Asset Accounting | Full asset lifecycle, depreciation and accounting | Pending |

## Phase 1 — Accounting Core

Deliverables:

- chart of accounts;
- periods/locks;
- journal entries;
- balanced debit/credit posting;
- general ledger;
- reversal model;
- trial balance;
- balance sheet;
- accounting income statement;
- operational posting adapters;
- UI/API/tests/E2E.

Exit gate:

- balanced ledger invariant tested;
- period lock tested;
- reversal tested;
- company isolation/RBAC tested;
- statements reproducible from ledger.

## Phase 2 — Projects 2.0

Deliverables:

- richer task/resource model;
- timesheets/timers;
- internal/hourly costs;
- expenses/materials/procurement linked to projects;
- sales/invoicing links;
- budget vs actual;
- hourly/milestone billing;
- profitability/variance;
- UI/API/tests/E2E.

Exit gate:

- at least one end-to-end project contains cost + revenue and reconciles profitability.

## Phase 3 — CRM

Deliverables:

- lead;
- opportunity;
- pipeline stage;
- activity/follow-up;
- assignee/owner;
- source/loss reason;
- lead conversion to customer/contact;
- opportunity conversion to quotation;
- pipeline analytics;
- UI/API/tests/E2E.

Exit gate:

- E2E lead → opportunity → customer/quotation with auditable transitions.

## Phase 4 — Manufacturing Shop Floor

Deliverables:

- operations;
- routings;
- workstations/work centers;
- calendars/capacity;
- setup/run time;
- job execution records;
- operation-level time/labor capture;
- WIP by operation;
- production planning view;
- quality inspection;
- non-conformance/rework hooks;
- integration with current OP/MRP/cost flows.

Exit gate:

- E2E BOM → OP → routing/job execution → inspection → output;
- capacity conflict detection tested;
- actual time/labor reflected in cost.

## Phase 5 — Stock Logistics

Deliverables:

- operational picking entity;
- packing flow/slip;
- shipment/dispatch;
- carrier/tracking metadata;
- putaway rules;
- receiving-to-putaway;
- order-to-pick-to-pack-to-ship;
- landed cost allocation;
- valuation integration;
- preservation of lot/serial/FIFO/FEFO traceability.

Exit gate:

- E2E inbound receipt → putaway;
- E2E outbound order → pick → pack → ship;
- landed cost valuation tested.

## Phase 6 — Asset Accounting

Deliverables:

- acquisition/capitalization;
- asset category;
- custodian;
- location transfer history;
- depreciation methods/schedules;
- accumulated depreciation/book value;
- repair/downtime integration;
- disposal/sale/write-off;
- accounting integration;
- asset register/reports;
- UI/API/tests/E2E.

Exit gate:

- E2E acquisition → depreciation → transfer/maintenance → disposal;
- accounting values reconcile with asset book values.

## Parallel execution rules

1. No phase is required to wait for a numerically earlier phase to start.
2. Shared migrations/contracts must be additive and compatible with work occurring in other phases.
3. If two phases touch the same runtime/router/UI surface, integration work must preserve both sets of acceptance criteria.
4. A phase may remain `blocked` on a cross-phase dependency without blocking independent work in the other phases.
5. A phase cannot be marked `completed` on implementation alone; all required evidence categories must be present.

## Machine-readable status

The execution branch owns:

`roadmap/erpnext-depth-6-phases.json`

This manifest is the authoritative execution state. Documentation checkboxes are informative only.

Valid phase states:

- `pending`
- `in_progress`
- `blocked`
- `completed`

Each completed phase must include non-empty evidence arrays for:

- `implementation`
- `tests`
- `verification`

## Gate commands

`npm run roadmap:validate`

Valid during normal development. It verifies the manifest and completion evidence rules. It also rejects any early next-stage unlock/start.

`npm run roadmap:require-complete`

Final 6/6 gate. It fails unless all six phases are completed with evidence.

`npm run verify`

Must include `roadmap:validate`, so attempts to advance `nextStage.status` before 6/6 fail normal repository verification.

## Next-stage lock

Initial state:

```json
{
  "nextStage": {
    "status": "locked"
  }
}
```

Permitted future states are `unlocked` and `started`, but either state requires 6/6. No manual bypass is part of this design.

## Roadmap completion checklist

- [ ] Phase 1 — Accounting Core
- [ ] Phase 2 — Projects 2.0
- [ ] Phase 3 — CRM
- [ ] Phase 4 — Manufacturing Shop Floor
- [ ] Phase 5 — Stock Logistics
- [ ] Phase 6 — Asset Accounting
- [ ] `npm run roadmap:require-complete` passes
- [ ] normal verification is green
- [ ] next stage may be unlocked
