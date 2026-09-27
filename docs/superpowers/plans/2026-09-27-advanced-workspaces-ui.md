# Advanced Workspaces UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal `DepthPage` with six operational React workspaces for Accounting, Projects 2.0, CRM, Manufacturing Shop Floor, Stock Logistics and Asset Accounting, using `frontEnds` as the UI/UX reference without making it a runtime dependency.

**Architecture:** Keep `gestao-avancada` as the single top-level navigation entry. Add ERP-local reusable workspace components modeled after `frontEnds`, add only company-scoped read/list APIs missing from the existing domain services, and keep all write/business rules in the current runtime services. `DepthPage.tsx` remains a compatibility entry point that renders the new `AdvancedManagementPage` and preserves `data-testid="view-depth"`.

**Tech Stack:** Node.js >=22, CommonJS backend services/routers, SQLite, React 19, TypeScript 5.9, Vite 7, Electron 39, Playwright/Node test runner, existing CSS stack only.

**Spec:** `docs/superpowers/specs/2026-09-27-advanced-workspaces-ui-design.md`

## Global Constraints

- `ARTISYS_ERP` remains the source of truth for business rules, permissions, workflows and persistence.
- `nutricionistaalmeidavh-spec/frontEnds` is visual/UX reference only; no runtime import, submodule or package dependency.
- Do not add Tailwind solely to reuse reference components.
- Preserve local-first Electron behavior, current session/auth model, company isolation and existing API contracts.
- Preserve `ViewId = 'gestao-avancada'` and `data-testid="view-depth"`.
- Add read/list endpoints only where needed to expose existing data; do not duplicate write logic in routers or React.
- Preserve all existing six-phase roadmap gates and existing E2E identifiers until compatible replacements are covered.
- Do not change fiscal, procurement, sales or inventory business behavior except the read models explicitly required here.

## Review Focus

- **Company isolation:** every new list/read method must filter by `company_id`; add cross-company tests in the task that owns each read model.
- **Empty datasets:** each workspace must render a useful empty state without requiring seed data; E2E must cover at least one empty-list path.
- **API failure recovery:** failed loads/mutations must show recoverable feedback while leaving navigation usable; shared UI task adds the pattern and one workspace E2E pins it.
- **No manual-ID primary flow:** Projects, Logistics and Assets must select existing records from lists; E2E must prove selection-based operation instead of typing database IDs.
- **Backward compatibility:** the existing six-phase E2E contract must continue to find `view-depth` and the six domain labels or an explicit compatibility alias; the integration task owns this assertion.

---

## File Structure

### Backend read models

- Modify `js/domains/accounting/accounting-service.js` — add period/journal listing.
- Modify `server/routers/accounting-router.js` — expose GET period/journal lists.
- Modify `js/domains/crm/crm-service.js` — add lead/opportunity/stage lists.
- Modify `server/routers/crm-router.js` — expose CRM read endpoints.
- Modify `js/domains/manufacturing/shop-floor-service.js` — add operation/workstation/routing/job-card lists.
- Modify `server/routers/shop-floor-router.js` — expose shop-floor read endpoints.
- Modify `js/domains/inventory/stock-logistics-service.js` — add putaway/pick/package lists.
- Modify `server/routers/stock-logistics-router.js` — expose logistics read endpoints.
- Modify `js/domains/assets/asset-accounting-service.js` — add asset-book/depreciation lists.
- Modify `server/routers/asset-accounting-router.js` — expose asset-accounting read endpoints.
- Add/modify `test/depth-read-api.test.js` — HTTP contract and company-isolation coverage.

### Shared frontend

- Create `frontend/src/components/advanced/WorkspaceNav.tsx` — internal six-workspace navigation.
- Create `frontend/src/components/advanced/WorkspaceHeader.tsx` — title/subtitle/action header.
- Create `frontend/src/components/advanced/DataTable.tsx` — responsive operational table + empty row.
- Create `frontend/src/components/advanced/KpiCard.tsx` — summary metric card.
- Create `frontend/src/components/advanced/StatusBadge.tsx` — normalized statuses.
- Create `frontend/src/components/advanced/FeedbackBanner.tsx` — loading/error/success feedback.
- Create `frontend/src/components/advanced/ActionDialog.tsx` — accessible form/confirm dialog.
- Create `frontend/src/components/advanced/FormField.tsx` — consistent label/input wrapper.
- Modify `frontend/src/styles.css` — ERP-local styles adapted from the `frontEnds` patterns.

### Workspaces

- Create `frontend/src/pages/advanced/AdvancedManagementPage.tsx`.
- Create `frontend/src/pages/advanced/AccountingWorkspace.tsx`.
- Create `frontend/src/pages/advanced/ProjectsWorkspace.tsx`.
- Create `frontend/src/pages/advanced/CrmWorkspace.tsx`.
- Create `frontend/src/pages/advanced/ShopFloorWorkspace.tsx`.
- Create `frontend/src/pages/advanced/StockLogisticsWorkspace.tsx`.
- Create `frontend/src/pages/advanced/AssetAccountingWorkspace.tsx`.
- Modify `frontend/src/pages/DepthPage.tsx` — compatibility wrapper only.

### E2E

- Modify `qa/e2e/depth-phases.test.js` — preserve legacy coverage while exercising new workspaces.
- Create `qa/e2e/advanced-workspaces.test.js` only if keeping `depth-phases.test.js` focused avoids an oversized test; otherwise extend the existing file.

---

### Task 1: Accounting read models

**Files:**
- Modify: `js/domains/accounting/accounting-service.js`
- Modify: `server/routers/accounting-router.js`
- Test: `test/depth-read-api.test.js`

**Interfaces:**
- Produces: `listPeriods(a)`, `listJournals({from?,to?}={},a)` and GET `/api/v1/accounting/periods`, GET `/api/v1/accounting/journals?from=&to=`.
- Return values must use existing `periodMap` and `journalMap` shapes.

- [ ] **Step 1: Write failing HTTP tests** for period/journal listing, date filtering and cross-company isolation.
- [ ] **Step 2: Run** `node --test test/depth-read-api.test.js` and verify the new accounting GET cases fail with route/method absence.
- [ ] **Step 3: Add** `listPeriods(a)` and `listJournals({from=null,to=null}={},a)` to `accounting-service.js`, always filtering by `company_id`; journal dates use inclusive `from/to` filters.
- [ ] **Step 4: Wire** the two GET routes in `accounting-router.js` without changing existing POST/GET-by-id routes.
- [ ] **Step 5: Re-run** `node --test test/depth-read-api.test.js`; expected PASS.
- [ ] **Step 6: Commit** `feat: expose accounting read models`.

### Task 2: CRM read models

**Files:**
- Modify: `js/domains/crm/crm-service.js`
- Modify: `server/routers/crm-router.js`
- Test: `test/depth-read-api.test.js`

**Interfaces:**
- Produces: `listLeads({status?,ownerId?}={},a)`, `listOpportunities({stageId?,ownerId?}={},a)`, `listStages(a)`.
- HTTP: GET `/api/v1/crm/leads`, GET `/api/v1/crm/opportunities`, GET `/api/v1/crm/stages`.

- [ ] **Step 1: Add failing tests** for empty lists, filters, expected mapped fields and cross-company isolation.
- [ ] **Step 2: Run** `node --test test/depth-read-api.test.js`; expected CRM read cases FAIL.
- [ ] **Step 3: Implement** list methods using existing `leadMap`, `oppMap` and `ensureStages`; no write behavior changes.
- [ ] **Step 4: Add** GET routes in `crm-router.js`; preserve existing POST semantics.
- [ ] **Step 5: Re-run** the test file; expected PASS.
- [ ] **Step 6: Commit** `feat: expose CRM read models`.

### Task 3: Shop-floor, logistics and asset-accounting read models

**Files:**
- Modify: `js/domains/manufacturing/shop-floor-service.js`
- Modify: `server/routers/shop-floor-router.js`
- Modify: `js/domains/inventory/stock-logistics-service.js`
- Modify: `server/routers/stock-logistics-router.js`
- Modify: `js/domains/assets/asset-accounting-service.js`
- Modify: `server/routers/asset-accounting-router.js`
- Test: `test/depth-read-api.test.js`

**Interfaces:**
- Shop floor produces `listOperations(a)`, `listWorkstations(a)`, `listRoutings(a)`, `listJobCards({orderId?,status?}={},a)`.
- Logistics produces `listPutawayRules(a)`, `listPicks({status?}={},a)`, `listPackages({status?}={},a)`.
- Asset accounting produces `listBooks(a)`, `listDepreciation(assetId,a)`.
- GET routes follow the exact paths approved in the spec.

- [ ] **Step 1: Add failing tests** for each list, status/order filtering, nested routing/pick shapes, depreciation history and company isolation.
- [ ] **Step 2: Run** `node --test test/depth-read-api.test.js`; expected new cases FAIL.
- [ ] **Step 3: Implement shop-floor list methods** using existing table maps; `listRoutings` returns `getRouting` shapes and `listJobCards` returns `mapCard` shapes.
- [ ] **Step 4: Implement logistics list methods** using existing `pickMap`/`getPackage` shapes and normalized putaway rows.
- [ ] **Step 5: Implement asset list methods** using `mapBook` and mapped depreciation entries; never expose another company's records.
- [ ] **Step 6: Wire GET routes** in the three routers.
- [ ] **Step 7: Re-run** `node --test test/depth-read-api.test.js`; expected PASS.
- [ ] **Step 8: Run** `npm test`; expected no regression.
- [ ] **Step 9: Commit** `feat: expose advanced operational read models`.

### Task 4: Shared advanced-workspace UI kit

**Files:**
- Create: `frontend/src/components/advanced/WorkspaceNav.tsx`
- Create: `frontend/src/components/advanced/WorkspaceHeader.tsx`
- Create: `frontend/src/components/advanced/DataTable.tsx`
- Create: `frontend/src/components/advanced/KpiCard.tsx`
- Create: `frontend/src/components/advanced/StatusBadge.tsx`
- Create: `frontend/src/components/advanced/FeedbackBanner.tsx`
- Create: `frontend/src/components/advanced/ActionDialog.tsx`
- Create: `frontend/src/components/advanced/FormField.tsx`
- Modify: `frontend/src/styles.css`
- Test: compile check via `npm run frontend:check`

**Interfaces:**
- Components are ERP-local equivalents of the approved `frontEnds` navigation/table/dashboard/dialog/feedback patterns.
- No Tailwind classes or external UI package dependency.
- `ActionDialog` props: `{open:boolean,title:string,description?:string,onClose:()=>void,children:ReactNode,footer?:ReactNode}`.
- `FeedbackBanner` supports `info|success|warning|danger` and optional retry/action node.

- [ ] **Step 1: Create component files** with semantic HTML, keyboard-operable controls and CSS class names prefixed `advanced-` where practical.
- [ ] **Step 2: Add styles** to `frontend/src/styles.css` for workspace tabs, KPI grids, responsive tables, dialogs, badges, loading/empty/error states; adapt the slate/white administrative visual language of `frontEnds` to current ArtiSys colors.
- [ ] **Step 3: Run** `npm run frontend:check`; expected PASS.
- [ ] **Step 4: Run** `npm run frontend:build`; expected PASS.
- [ ] **Step 5: Commit** `feat: add advanced workspace UI primitives`.

### Task 5: Accounting workspace

**Files:**
- Create: `frontend/src/pages/advanced/AccountingWorkspace.tsx`
- Reuse: `frontend/src/services/api.ts`, advanced UI kit
- E2E: `qa/e2e/depth-phases.test.js`

**Interfaces:**
- Loads accounts, periods and trial-balance summary on entry.
- Tabs/sections: `Plano de contas`, `Lançamentos`, `Demonstrativos`.
- Primary actions: create account, create/close period, post journal, reverse journal, inspect journal, apply date filter.

- [ ] **Step 1: Add failing E2E assertions** that open Contabilidade, see account list/empty state, create one account through the UI, refresh and observe it without typing a database ID.
- [ ] **Step 2: Run** `node --test --test-concurrency=1 qa/e2e/depth-phases.test.js`; expected FAIL on missing workspace controls.
- [ ] **Step 3: Implement** `AccountingWorkspace` using only existing/new Accounting APIs and shared components.
- [ ] **Step 4: Add** recoverable load error and mutation success/error feedback.
- [ ] **Step 5: Re-run** targeted E2E; expected accounting assertions PASS.
- [ ] **Step 6: Commit** `feat: add accounting workspace`.

### Task 6: Projects 2.0 workspace

**Files:**
- Create: `frontend/src/pages/advanced/ProjectsWorkspace.tsx`
- E2E: `qa/e2e/depth-phases.test.js`

**Interfaces:**
- List source: GET `/api/v1/ops/projects`.
- Detail source: GET `/api/v1/ops/projects/:id`.
- Depth actions use existing `/api/v1/projects/:id/*` routes.
- The selected project ID comes from list selection, never a primary manual ID input.

- [ ] **Step 1: Add failing E2E** that selects `UI-PROJ` by name/list row and views profitability without filling `depth-project-id`.
- [ ] **Step 2: Run targeted E2E**; expected FAIL on missing list-based project selection.
- [ ] **Step 3: Implement** list/detail selection, KPI profitability, tasks, budget/time/expense/material/revenue/milestone action dialogs.
- [ ] **Step 4: Ensure** an empty project list renders an actionable empty state and API failure can retry.
- [ ] **Step 5: Re-run targeted E2E**; expected PASS.
- [ ] **Step 6: Commit** `feat: add projects 2 workspace`.

### Task 7: CRM workspace

**Files:**
- Create: `frontend/src/pages/advanced/CrmWorkspace.tsx`
- E2E: `qa/e2e/depth-phases.test.js`

**Interfaces:**
- Sections: Pipeline, Leads, Oportunidades, Atividades.
- Uses new CRM GET routes plus existing write routes.

- [ ] **Step 1: Add failing E2E** for create lead → row visible → create opportunity/observe pipeline, plus empty state before seed where practical.
- [ ] **Step 2: Run targeted E2E**; expected FAIL on missing CRM workspace controls.
- [ ] **Step 3: Implement** pipeline KPI/stage cards, lead/opportunity/activity tables and action dialogs for conversion/stage/loss/quote/completion.
- [ ] **Step 4: Add** load/mutation feedback and preserve navigation after a failed API request.
- [ ] **Step 5: Re-run targeted E2E**; expected PASS.
- [ ] **Step 6: Commit** `feat: add CRM workspace`.

### Task 8: Shop-floor workspace

**Files:**
- Create: `frontend/src/pages/advanced/ShopFloorWorkspace.tsx`
- E2E: `qa/e2e/depth-phases.test.js`

**Interfaces:**
- Sections: Operações, Postos, Roteiros, Job Cards, Qualidade.
- Uses new read routes and current create/generate/start/complete/inspection routes.

- [ ] **Step 1: Add failing E2E** that creates an operation through UI and sees the resulting row; add list visibility for workstations/routings/job cards.
- [ ] **Step 2: Run targeted E2E**; expected FAIL.
- [ ] **Step 3: Implement** operational tables and dialogs; routing form selects operation/workstation records from lists rather than raw IDs where records are available.
- [ ] **Step 4: Implement** job-card status actions and quality-inspection dialog with clear validation feedback.
- [ ] **Step 5: Re-run targeted E2E**; expected PASS.
- [ ] **Step 6: Commit** `feat: add shop floor workspace`.

### Task 9: Stock Logistics workspace

**Files:**
- Create: `frontend/src/pages/advanced/StockLogisticsWorkspace.tsx`
- E2E: `qa/e2e/depth-phases.test.js`

**Interfaces:**
- Sections: Armazenagem, Picking, Packing/Expedição, Landed Cost.
- Uses new read routes plus current putaway/pick/package/shipment/landed-cost routes.
- Product/location options should be loaded from existing catalog/inventory APIs already used elsewhere in the ERP where available.

- [ ] **Step 1: Add failing E2E** proving putaway suggestion uses selected product from a UI list/control rather than a raw product-ID text box.
- [ ] **Step 2: Run targeted E2E**; expected FAIL.
- [ ] **Step 3: Implement** putaway rules/suggestion, picks, packages/shipment and landed-cost forms/tables.
- [ ] **Step 4: Ensure** status transitions refresh rows and show success/error feedback.
- [ ] **Step 5: Re-run targeted E2E**; expected PASS.
- [ ] **Step 6: Commit** `feat: add stock logistics workspace`.

### Task 10: Asset Accounting workspace

**Files:**
- Create: `frontend/src/pages/advanced/AssetAccountingWorkspace.tsx`
- E2E: `qa/e2e/depth-phases.test.js`

**Interfaces:**
- Asset master list: GET `/api/v1/ops/assets`.
- Book/depreciation data: asset-accounting read routes.
- Actions: capitalize, depreciate, move custody, dispose; account selectors use accounting account list.

- [ ] **Step 1: Add failing E2E** that selects `UI-ASSET` from the asset table and reads its book value without filling a raw asset ID.
- [ ] **Step 2: Run targeted E2E**; expected FAIL.
- [ ] **Step 3: Implement** asset list + book detail + depreciation/custody history and lifecycle action dialogs.
- [ ] **Step 4: Add** disposed/active status badges and gain/loss feedback after disposal.
- [ ] **Step 5: Re-run targeted E2E**; expected PASS.
- [ ] **Step 6: Commit** `feat: add asset accounting workspace`.

### Task 11: Advanced-management integration and compatibility

**Files:**
- Create: `frontend/src/pages/advanced/AdvancedManagementPage.tsx`
- Modify: `frontend/src/pages/DepthPage.tsx`
- Modify only if needed: `frontend/src/app/App.tsx`
- E2E: `qa/e2e/depth-phases.test.js`

**Interfaces:**
- `AdvancedManagementPage({api}:{api:ErpApi})` owns workspace selection.
- Workspace IDs: `accounting|projects|crm|shop-floor|stock-logistics|assets`.
- `DepthPage` preserves `data-testid="view-depth"` and renders the new page.

- [ ] **Step 1: Add failing compatibility assertions** for the six workspace labels and internal navigation while retaining `nav-gestao-avancada` + `view-depth`.
- [ ] **Step 2: Implement** `AdvancedManagementPage` with `WorkspaceNav` and lazy-by-selection rendering (normal conditional render; no new routing dependency).
- [ ] **Step 3: Replace** old `DepthPage` content with the compatibility wrapper; keep legacy `depth-*` IDs only where existing E2E still requires them until the same test has been migrated.
- [ ] **Step 4: Run** `npm run frontend:check && npm run frontend:build`; expected PASS.
- [ ] **Step 5: Run** `node --test --test-concurrency=1 qa/e2e/depth-phases.test.js`; expected PASS.
- [ ] **Step 6: Commit** `feat: integrate advanced management workspaces`.

### Task 12: Full regression, delivery gates and PR readiness

**Files:**
- Modify only if a test/gate exposes a real defect; no scope expansion.
- Optional documentation update: `docs/roadmaps/erpnext-depth-6-phases.md` only if it needs a UI maturity note, without reopening the already-completed six-phase implementation state.

**Interfaces:**
- No new product interface; this task proves delivery integrity.

- [ ] **Step 1: Run** `npm run verify`; expected PASS.
- [ ] **Step 2: Run** `npm run coverage`; expected PASS and no material regression in new backend read methods.
- [ ] **Step 3: Run** `npm run e2e`; expected full Electron suite PASS.
- [ ] **Step 4: Run** `npm run roadmap:require-complete`; expected 6/6 PASS.
- [ ] **Step 5: Run** `npm run release:check`; expected PASS.
- [ ] **Step 6: Run/confirm Windows build workflow** for the branch if CI triggers it; expected installer build/validation PASS.
- [ ] **Step 7: Inspect branch diff** for accidental `frontEnds` runtime references, new Tailwind dependency, secrets, generated build files or unrelated refactors; expected none.
- [ ] **Step 8: Open/update draft PR** from `feat/advanced-workspaces-ui` to `main` with implementation summary, tests and explicit note that `frontEnds` was reference-only.
- [ ] **Step 9: Commit any final documentation-only adjustment** as `docs: record advanced workspace UI completion` if needed.
