# ArtiSys ERP — Advanced Workspaces UI Design

Date: 2026-09-27
Status: Approved in chat, pending written-spec review before implementation
Branch: `feat/advanced-workspaces-ui`
Base: `main@760b7378aff59ed6593fe35e8605c989ec60310e`
Reference UI repository: `nutricionistaalmeidavh-spec/frontEnds`

## 1. Goal

Replace the current minimal `DepthPage` experience with six operational workspaces that expose the already-implemented ERP depth in a usable desktop UI:

1. Accounting
2. Projects 2.0
3. CRM
4. Manufacturing Shop Floor
5. Stock Logistics
6. Asset Accounting

The change must improve usability without changing the existing domain rules or creating a second backend.

## 2. Design principles

- `ARTISYS_ERP` remains the source of truth for domain contracts, data, permissions and workflows.
- `frontEnds` is a visual/UX reference only. It must not become a runtime dependency or git submodule of the ERP.
- Reuse the patterns from `frontEnds` by adapting them to the ERP's current React/CSS stack; do not add Tailwind only to copy those components.
- Preserve local-first/offline-first behavior and the current Electron runtime.
- Prefer small, focused React components instead of expanding `DepthPage.tsx` into a monolith.
- Add only read/list endpoints that are required to operate existing domain capabilities in the UI. Do not duplicate business logic in routers or React.
- Preserve existing API contracts, test IDs and E2E behavior unless a compatible replacement is explicitly covered by tests.

## 3. Reference patterns from `frontEnds`

Use as design references:

- `shells/desktop-admin/shell.tsx` — desktop administrative workspace organization.
- `library/tables-kit/components.tsx` — responsive operational tables, toolbars and empty states.
- `library/navigation-kit/components.tsx` — internal navigation and breadcrumbs.
- `library/dashboard-kit/components.tsx` — KPI cards, section headers and quick actions.
- `library/dialogs-kit/components.tsx` — dialogs and confirmations.
- `library/feedback-kit/components.tsx` — alerts, loading, progress and empty states.

Do not import those files at runtime. Create ERP-local equivalents aligned with the current CSS variables, typography and Electron shell.

## 4. Information architecture

Keep the existing top-level navigation item `gestao-avancada` / “Gestão avançada”. Inside it, expose six workspaces:

- Contabilidade
- Projetos
- CRM
- Chão de fábrica
- Logística
- Patrimônio

`DepthPage.tsx` becomes a compatibility entry point or is replaced by `AdvancedManagementPage.tsx`, while preserving `data-testid="view-depth"` and the existing top-level `ViewId`.

Suggested structure:

```text
frontend/src/pages/advanced/
├── AdvancedManagementPage.tsx
├── AccountingWorkspace.tsx
├── ProjectsWorkspace.tsx
├── CrmWorkspace.tsx
├── ShopFloorWorkspace.tsx
├── StockLogisticsWorkspace.tsx
└── AssetAccountingWorkspace.tsx

frontend/src/components/advanced/
├── WorkspaceNav.tsx
├── WorkspaceHeader.tsx
├── DataTable.tsx
├── KpiCard.tsx
├── StatusBadge.tsx
├── EmptyState.tsx
├── FeedbackBanner.tsx
├── ActionDialog.tsx
└── FormField.tsx
```

Names may be adjusted to existing conventions, but responsibilities must remain separated.

## 5. Workspace requirements

### 5.1 Accounting

Expose the existing Accounting Core through operational screens:

- accounting overview
- chart of accounts list
- create account
- accounting periods
- create/close period
- journals
- journal detail
- debit/credit lines
- reverse journal
- trial balance
- balance sheet
- income statement
- date/period filters

Existing business rules remain in `runtime.accounting`.

### 5.2 Projects 2.0

Use the current projects list/detail from Operations Suite and enrich with Projects 2.0 capabilities:

- project list
- project detail/tasks
- budget
- time entries
- expenses
- material costs
- revenue
- milestones
- profitability summary
- actual cost, billed/revenue, profit and budget variance

Users should select a project from the UI; manual ID entry must not be the primary flow.

### 5.3 CRM

Expose a daily operational CRM:

- pipeline summary
- leads list
- create lead
- lead detail/basic status
- convert lead to customer
- opportunities list
- create opportunity
- move stage
- mark loss with reason
- convert opportunity to quotation
- activities list
- add activity
- complete activity

The UI should favor a pipeline/table workflow instead of raw IDs.

### 5.4 Manufacturing Shop Floor

Expose shop-floor entities already implemented in the domain:

- operations list/create
- workstations list/create
- routings list/create
- routing steps
- production order selection
- job cards list/generation
- start job card
- complete job card
- time/quantity/cost completion data
- quality inspections
- capacity-oriented status where data is available

This extends the existing Production area; it does not duplicate BOM/MRP/production-order logic.

### 5.5 Stock Logistics

Expose logistics depth separately from conventional inventory:

- putaway rules list/create
- putaway suggestion
- picks list/create
- pick completion
- packages list/create
- shipment action/tracking data
- landed cost recording
- clear status and feedback for pick/pack/ship flows

This extends inventory/logistics without replacing the existing stock screens.

### 5.6 Asset Accounting

Combine existing operational asset listing with accounting lifecycle:

- assets list
- capitalization state
- acquisition/capitalized value
- residual value / useful-life data where available
- net book value
- depreciation action/history
- custody move
- custody history
- disposal/sale
- gain/loss result

Do not create a parallel asset master; use existing assets and asset-accounting records.

## 6. Minimal backend additions

Some domains currently expose write commands without enough read/list APIs for a practical UI. Add read endpoints only where the underlying service/table already exists.

Candidate endpoints:

```text
GET /api/v1/accounting/periods
GET /api/v1/accounting/journals

GET /api/v1/crm/leads
GET /api/v1/crm/opportunities
GET /api/v1/crm/stages

GET /api/v1/shop-floor/operations
GET /api/v1/shop-floor/workstations
GET /api/v1/shop-floor/routings
GET /api/v1/shop-floor/job-cards

GET /api/v1/stock-logistics/putaway-rules
GET /api/v1/stock-logistics/picks
GET /api/v1/stock-logistics/packages

GET /api/v1/asset-accounting/assets
GET /api/v1/asset-accounting/assets/:id/depreciation
```

Projects already have list/detail routes in Operations Suite and should reuse them.

Endpoint names may be refined to match existing service naming. They must remain company-scoped and permission-aware through existing router/session mechanisms.

## 7. UI behavior

Each workspace must provide:

- initial loading state
- empty state
- recoverable API error state
- primary actions through forms/dialogs
- confirmation for destructive/reversal actions
- success/error feedback after mutations
- refresh after successful mutation
- responsive tables for desktop and narrower Electron windows
- accessible labels and keyboard-operable controls
- no primary workflow that requires copying database IDs manually

Use the current ArtiSys visual language; the `frontEnds` repository supplies composition patterns, not a full redesign of the application shell.

## 8. Compatibility constraints

Preserve:

- `ViewId = 'gestao-avancada'`
- `data-testid="view-depth"`
- existing API endpoints and payload contracts
- existing Electron preload/renderer boundaries
- current authentication/session behavior
- current company isolation
- all existing 6-phase roadmap gates
- existing unit and E2E tests

Do not modify fiscal, procurement, sales or inventory domain behavior except where a read model is required by these workspaces.

## 9. Testing strategy

Use TDD for new behavior.

### Backend

Add tests first for each new read endpoint covering:

- authenticated access
- company isolation
- expected list/detail shape
- missing/invalid IDs where applicable
- no regression to existing write endpoints

### Frontend/E2E

Add E2E coverage for each workspace:

1. navigate to Gestão avançada
2. open the workspace
3. observe real list/empty state
4. perform at least one primary action
5. observe the result in the UI without manual ID entry

Keep existing E2E identifiers compatible.

### Final gates

Before completion require:

- `npm run verify`
- coverage gate
- Electron rebuild
- full E2E suite
- roadmap gate remains green
- `release:check`
- Windows installer build/validation if the workflow is affected

## 10. Explicit non-goals

This change does not:

- add Tailwind as a new ERP dependency
- replace the application-wide shell
- redesign every legacy frontend screen
- change accounting, CRM, manufacturing, logistics or asset business rules
- introduce cloud-only services
- depend on `frontEnds` at runtime
- create new major ERP modules
- perform a global legacy-renderer-to-React migration

A broader frontend unification can be a separate follow-up after these six workspaces are proven.

## 11. Success criteria

The work is complete when:

1. all six advanced domains have dedicated operational workspaces;
2. users can discover/select records rather than type IDs as the normal path;
3. existing domain actions are usable through forms, tables and dialogs;
4. missing read APIs are added without duplicating domain logic;
5. `frontEnds` patterns are visibly reflected in navigation, tables, KPI summaries, dialogs and feedback states;
6. existing tests stay green and new E2E tests cover all six workspaces;
7. no runtime dependency on `frontEnds` is introduced;
8. the Windows/Electron delivery path remains valid.
