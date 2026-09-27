# ArtiSys ERP — ERPNext Depth Benchmark: 6-Phase Design

Date: 2026-09-26
Status: Approved design baseline
Canonical product branch: `main`
Planning branch: `roadmap/erpnext-depth-6-phases`
Execution branch: `feat/erpnext-depth-6-phases`

## 1. Goal

Increase the depth of the ArtiSys ERP in six areas identified by comparison with mature ERP capabilities, using ERPNext only as a functional benchmark. The implementation must remain native to the ArtiSys architecture and must not copy GPL implementation code.

The six phases may be developed in parallel or sequentially. No post-roadmap stage may be declared started or unlocked until all six phases are completed with implementation, tests, and verification evidence.

## 2. Existing strengths preserved

The roadmap must not replace working ArtiSys capabilities that are already comparatively strong:

- inventory/WMS: hierarchical locations, lots, serials, tracked positions, FIFO/FEFO, cycle counts, losses, replenishment and analytics;
- procurement: requisitions, quotations, supplier scoring, awards, approvals, purchase orders, receipts, returns and supplier credits;
- finance management: accounts, entries, settlements, reversals, reconciliation, recurrence, DRE, cash flow and reporting;
- sales: quotation/order/invoicing flows, inventory reservation, retail operations and fiscal routing;
- manufacturing: BOM-based manufacturing orders, reservations, real consumption, losses/scrap, output, actual costs and MRP-to-procurement integration;
- fiscal: Brazil-specific fiscal core/runtime/interoperability;
- traceability: cost and commercial facts across operational flows.

The roadmap extends these capabilities rather than rebuilding them.

## 3. Phase 1 — Accounting Core

### Objective

Add formal double-entry accounting beneath the existing managerial finance layer.

### Scope

- chart of accounts with hierarchy, account type, normal balance and active/inactive lifecycle;
- accounting periods and lock/close controls;
- journal entries with balanced debit/credit validation;
- general ledger entries generated atomically from journal posting;
- accounting dimensions compatible with existing company/cost-center concepts;
- trial balance;
- balance sheet;
- income statement mapping from accounting ledger without breaking current managerial DRE;
- posting adapters for selected operational sources (sales, purchases, settlements, inventory valuation and asset depreciation) introduced incrementally;
- reversal/audit model instead of destructive edits to posted accounting events.

### Acceptance criteria

- no posted journal may have debit total different from credit total;
- ledger entries are immutable except by reversal/corrective posting;
- trial balance closes to zero net debit/credit difference;
- balance sheet and accounting income statement are reproducible from ledger data;
- tests cover posting, reversal, period locking, multi-company isolation and RBAC;
- UI provides practical chart-of-accounts, journal and core statements flows.

## 4. Phase 2 — Projects 2.0

### Objective

Turn the existing basic project/task model into an operational and financial project dimension.

### Scope

- project lifecycle and richer task workflow;
- task assignments/resources;
- timesheets and timers;
- hourly/internal cost rates;
- expenses linked to projects;
- inventory/material consumption linked to projects;
- procurement requisitions/orders linked to projects;
- sales/orders/invoices linked to projects where applicable;
- project budget and actual costs;
- billing by hours and/or milestones;
- project profitability and variance reporting;
- audit and company isolation.

### Acceptance criteria

- project profitability reconciles project revenues and directly attributable costs;
- timesheets can feed cost and, when configured, billable value;
- procurement/material/expense links are traceable to the project;
- project reporting exposes budget vs actual and margin;
- E2E tests cover project creation through at least one complete cost/revenue path.

## 5. Phase 3 — CRM

### Objective

Add a pre-sales pipeline before the existing quotation/order flow.

### Scope

- leads;
- opportunities;
- pipeline stages;
- activities/follow-ups;
- owner/assignee;
- lead source and loss reason;
- conversion lead → customer/contact;
- conversion opportunity → quotation;
- pipeline value and conversion analytics;
- reminders/alerts through existing notification capabilities where suitable;
- permissions and company isolation.

### Acceptance criteria

- a lead can progress to opportunity, customer/contact and quotation without duplicated identity records;
- pipeline stages and loss reasons are auditable;
- activities support due dates and completion status;
- CRM analytics expose pipeline value and conversion counts;
- E2E covers lead → opportunity → quotation.

## 6. Phase 4 — Manufacturing Shop Floor

### Objective

Extend the existing manufacturing/MRP foundation into operation-level shop-floor control.

### Scope

- operations;
- routings and ordered operation sequences;
- workstations/work centers;
- calendars and capacity;
- setup/run times;
- job cards or equivalent execution records;
- operation-level start/pause/complete;
- labor/time capture by operation;
- WIP visibility by operation;
- production-plan view consolidating demand where useful;
- quality inspection points;
- non-conformance/rework hooks;
- compatibility with existing manufacturing order, material consumption, loss, output and costing flows.

### Acceptance criteria

- manufacturing order execution can be split into ordered operations;
- workstation capacity conflicts are detectable;
- operation time/labor feeds actual production cost;
- WIP state is queryable by operation/workstation;
- inspection can block/release relevant production progression;
- E2E covers BOM → order → routing/job execution → output.

## 7. Phase 5 — Stock Logistics

### Objective

Deepen outbound/inbound warehouse execution without replacing the current WMS foundation.

### Scope

- picking document/entity separated from a generic pick plan where beneficial;
- packing workflow and packing slip data;
- shipment/dispatch entity;
- carrier/tracking metadata;
- putaway rules for automatic destination suggestion;
- inbound receiving-to-putaway flow;
- outbound order-to-pick-to-pack-to-ship flow;
- landed cost allocation across received items;
- valuation integration for freight/insurance/other landed costs;
- preservation of lot/serial/FIFO/FEFO constraints;
- operational status and audit trails.

### Acceptance criteria

- shipped quantity cannot exceed valid picked/packed availability;
- lot/serial traceability survives pick/pack/ship;
- landed cost changes inventory valuation reproducibly without rewriting historical receipt quantities;
- putaway recommendations respect location rules;
- E2E covers receipt → putaway and order → pick → pack → ship.

## 8. Phase 6 — Asset Accounting

### Objective

Extend operational assets/maintenance into a full asset lifecycle with accounting integration.

### Scope

- acquisition value and capitalization date;
- asset category/class;
- custodian/responsible person;
- location and transfer history;
- depreciation methods and schedules;
- accumulated depreciation and book value;
- repair/downtime records linked to service/maintenance where appropriate;
- disposal/sale/write-off;
- optional capitalization of qualifying repairs;
- accounting postings through Phase 1 core;
- asset register and movement/depreciation reports.

### Acceptance criteria

- depreciation schedule is deterministic and auditable;
- depreciation postings reconcile to asset book values;
- transfers preserve full history;
- disposal prevents further depreciation and creates required accounting effects;
- maintenance history remains linked after transfers/disposal;
- E2E covers acquisition → depreciation → transfer/maintenance → disposal.

## 9. Parallelism model

All six phases are peer workstreams.

Allowed:

- 1 → 2 → 3 → 4 → 5 → 6 sequentially;
- 1, 2, 3, 4, 5 and 6 in parallel;
- any mixed order.

Cross-phase dependencies must be handled by stable contracts or temporary adapters. Phase completion may depend on another phase only when the acceptance criteria truly require the shared capability (for example, final Asset Accounting journal integration depends on Accounting Core). Such dependency does not prohibit parallel implementation; it only prevents a phase from being marked `completed` until its acceptance criteria are satisfied.

## 10. Completion evidence contract

A phase may be marked `completed` only when its manifest evidence contains all three categories:

1. `implementation` — code paths/commits/files implementing the scope;
2. `tests` — unit/integration/E2E evidence appropriate to the phase;
3. `verification` — successful verification/CI evidence or explicit verification record.

Empty evidence arrays are valid for `pending`, `in_progress` and `blocked`; they are invalid for `completed`.

## 11. Gate contract

The execution branch contains a machine-readable manifest and gate script.

### `roadmap:validate`

Must pass during normal development and validates:

- exact roadmap ID;
- exactly six known phases, no duplicates;
- valid phase states: `pending`, `in_progress`, `blocked`, `completed`;
- evidence structure;
- completed phases have implementation, tests and verification evidence;
- valid `nextStage.status`.

If `nextStage.status` is anything other than `locked`, validation also enforces full six-phase completion.

### `roadmap:require-complete`

Fails unless all six phases are validly `completed` with evidence.

### Next-stage rule

`nextStage.status` starts as `locked` and may only become `unlocked` or `started` after 6/6 completion. Because `roadmap:validate` is part of the normal `npm run verify`, an early unlock/start makes the repository verification fail.

## 12. Non-goals

- no GPL code copy/transliteration from ERPNext;
- no migration to Frappe/Python;
- no rewrite of already-working ArtiSys modules merely to resemble ERPNext;
- no requirement to finish the six phases in numerical order;
- no merge to `main` implied by this roadmap;
- no future stage is defined until the six-phase gate is satisfied.

## 13. Definition of roadmap completion

The six-phase roadmap is complete only when:

- all six manifest phases are `completed`;
- all evidence requirements are satisfied;
- `npm run roadmap:require-complete` passes;
- normal repository verification remains green;
- the next-stage gate can be unlocked without bypasses or manual exceptions.
