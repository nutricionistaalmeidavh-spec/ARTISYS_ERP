# ArtiSys ERP Phase 6 — Finance Operational Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor no desktop os fluxos financeiros P0–P3 já existentes e completar os contratos operacionais faltantes para contas, lançamentos, baixas, estornos, transferências, dimensões, recorrências, OFX, conciliação, alertas e créditos de fornecedor.

**Architecture:** O backend financeiro atual permanece fonte de verdade. Esta fase evita reescrever regras que já estão testadas: completa apenas edição/estado onde necessário, cria contratos HTTP coerentes e uma UI operacional por subfluxo. Baixas, estornos, transferências, recorrências e conciliação continuam idempotentes. Créditos de fornecedor entram como ajuste explícito e auditável, nunca como mutação silenciosa do valor histórico do lançamento.

**Tech Stack:** Node.js 22+, CommonJS, SQLite, Electron, Playwright, ArtiSys EventBus.

**Spec:** `docs/superpowers/specs/2026-09-25-artisys-erp-operational-core-design.md`

## Global Constraints

- Executar depois das Phases 1–5.
- Não alterar `PDV-ARTISYS`.
- Preservar contratos P0–P3 já verdes.
- OFX sempre passa por preview antes de commit.
- Conciliação exige confirmação humana.
- Transferência entre contas próprias não vira receita/despesa.
- Cancelamento de lançamento com baixa ativa continua proibido até estorno das baixas.
- UI não usa `prompt`, `alert` ou `confirm`.

## Review Focus

1. Baixa acima do saldo aberto deve ser rejeitada sem criar settlement parcial acidental.
2. Estorno repetido deve ser idempotente e não alterar o saldo duas vezes.
3. Importar o mesmo OFX duas vezes não pode duplicar transações financeiras.
4. Transferência entre contas próprias deve preservar resultado/DRE e apenas mover caixa.
5. Recorrência em dia 31 deve continuar com clamp de calendário e ser idempotente após restart.

---

### Task 1: Completar lifecycle de contas financeiras

**Files:**
- Modify: `js/domains/finance/finance-service.js`
- Test: `test/finance-base.test.js`

**Interfaces:**
- Produces `updateAccount(id,input,actor)` and `setAccountActive(id,active,actor)`.

- [ ] **Step 1: Write failing account lifecycle tests**

```js
const account = runtime.finance.createAccount({name:'Banco A',type:'BANK',ownership:'business'},manager);
const updated = runtime.finance.updateAccount(account.id,{name:'Banco Principal'},manager);
assert.equal(updated.name,'Banco Principal');
const inactive = runtime.finance.setAccountActive(account.id,false,manager);
assert.equal(inactive.active,false);
```

Also assert invalid type/ownership and missing account errors.

- [ ] **Step 2: Run RED**

Run: `node --test test/finance-base.test.js`
Expected: FAIL on missing methods.

- [ ] **Step 3: Implement whitelisted account updates**

Do not change `id`, `created_at`. Preserve account references in historical entries. Inactivation only blocks new use; it never removes history.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/finance-base.test.js`
Expected: PASS.

```bash
git add js/domains/finance/finance-service.js test/finance-base.test.js
git commit -m "feat: complete finance account lifecycle"
```

### Task 2: Completar edição segura de lançamentos em aberto

**Files:**
- Modify: `js/domains/finance/finance-service.js`
- Test: `test/finance-base.test.js`

**Interfaces:**
- Produces `updateEntry(id,input,actor)`.

- [ ] **Step 1: Write failing update tests**

Allow description, due date, account, notes and dimensions/category changes only while entry has no active settlement and is not cancelled. Amount may be changed only while `settledCents===0`.

```js
const updated = runtime.finance.updateEntry(entry.id,{description:'Fornecedor X',dueAt:'2026-11-01'},manager);
assert.equal(updated.description,'Fornecedor X');
```

Assert changing amount after partial settlement fails.

- [ ] **Step 2: Run RED**

Run: `node --test test/finance-base.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement transactionally**

Validate all input through existing money/date/account/dimension rules. Audit before/after fields. Do not allow changes to `kind`, `sourceType`, `sourceId`, `createdAt` through normal editing.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/finance-base.test.js`
Expected: PASS.

```bash
git add js/domains/finance/finance-service.js test/finance-base.test.js
git commit -m "feat: allow safe open finance entry edits"
```

### Task 3: Expor API financeira completa sem quebrar P0–P3

**Files:**
- Modify: `server/routers/finance-router.js`
- Test: `test/api-contract.test.js`
- Test: `test/finance-automation.test.js`

**Interfaces:**
- Adds:
  - `GET /api/v1/finance/accounts/:id`
  - `PATCH /api/v1/finance/accounts/:id`
  - `POST /api/v1/finance/accounts/:id/deactivate`
  - `POST /api/v1/finance/accounts/:id/reactivate`
  - `PATCH /api/v1/finance/entries/:id`
  - `GET /api/v1/finance/supplier-credits`
  - `POST /api/v1/finance/supplier-credits/:id/apply`
- Preserves existing settle/cancel/reverse/dimensions/dashboard/DRE/cashflow/compare/OFX/reconciliation/transfers/recurrences/alerts routes.

- [ ] **Step 1: Write failing HTTP lifecycle tests**

Test account CRUD state, entry edit, settle, reverse, cancel after reversal, supplier credit list/apply, viewer forbidden on mutations.

- [ ] **Step 2: Run RED**

Run: `node --test test/api-contract.test.js`
Expected: FAIL on missing routes.

- [ ] **Step 3: Implement routes through services**

Use `pathMatch`, stable `404`, and no mutation SQL in router. Keep current `admin/manager` finance boundary unless a future RBAC design explicitly expands it.

- [ ] **Step 4: Regression test P0–P3 routes**

Run: `node --test test/api-contract.test.js test/finance-base.test.js test/finance-automation.test.js test/reporting-management.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers/finance-router.js test/api-contract.test.js
git commit -m "feat: complete operational finance API"
```

### Task 4: Criar view financeira base — contas, AP/AR, baixas e estornos

**Files:**
- Create: `desktop/renderer/views/financeiro.js`
- Modify: `desktop/renderer/index.html`
- Modify: `desktop/renderer/app.js`
- Modify: `desktop/renderer/styles.css`
- Test: `qa/e2e/finance-entries.spec.js`

**Interfaces:**
- Produces `window.ErpViews.financeiro({api,root})`.

- [ ] **Step 1: Write failing E2E**

Flow: create account -> create PAYABLE -> partial settlement -> verify open amount -> settle remainder -> reverse second settlement -> verify PARTIAL -> reverse first -> cancel entry -> verify CANCELLED. Repeat with RECEIVABLE.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/finance-entries.spec.js --reporter=line`
Expected: FAIL because controls do not exist.

- [ ] **Step 3: Implement tabs `Resumo`, `Contas`, `A pagar`, `A receber`**

Fields: description, amount, due date, account, category, cost center, competency date, notes. Settlement modal includes amount, method, note. Reverse/cancel requires reason in custom modal.

Stable ids:

```text
finance-account-new
finance-entry-new-payable
finance-entry-new-receivable
finance-entry-settle-<id>
finance-settlement-reverse-<id>
finance-entry-cancel-<id>
finance-entry-open-<id>
```

- [ ] **Step 4: Show derived values distinctly**

For each entry render total, settled, open, due date, overdue badge and source link; do not allow editing derived `status/openCents/settledCents` fields.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm run electron:compat && npx playwright test qa/e2e/finance-entries.spec.js --reporter=line && npm run verify`
Expected: PASS.

```bash
git add desktop/renderer qa/e2e/finance-entries.spec.js
git commit -m "feat: make AP and AR operational in desktop"
```

### Task 5: UI de dimensões, categorias e centros de custo

**Files:**
- Modify: `desktop/renderer/views/financeiro.js`
- Test: `qa/e2e/finance-dimensions.spec.js`

**Interfaces:**
- Uses existing `/dre-groups`, `/categories`, `/cost-centers`, `/entries/:id/dimensions` APIs.

- [ ] **Step 1: Write failing E2E**

Create cost center/category, assign them plus competency date to an entry, navigate away/back, verify persistence and DRE filter/group effect.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/finance-dimensions.spec.js --reporter=line`
Expected: FAIL.

- [ ] **Step 3: Implement management forms and entry dimension editor**

Reuse existing save APIs. Inactivation is shown where supported; never delete historical dimensions.

- [ ] **Step 4: Run GREEN and commit**

Run: `npx playwright test qa/e2e/finance-dimensions.spec.js --reporter=line`
Expected: PASS.

```bash
git add desktop/renderer/views/financeiro.js qa/e2e/finance-dimensions.spec.js
git commit -m "feat: expose finance dimensions in desktop"
```

### Task 6: UI de transferências entre contas próprias

**Files:**
- Modify: `desktop/renderer/views/financeiro.js`
- Test: `qa/e2e/finance-transfer.spec.js`

**Interfaces:**
- Uses existing `/transfers/suggestions` and `/transfers/confirm`.

- [ ] **Step 1: Write failing E2E**

Prepare matching debit/credit statement transactions between two business accounts, open suggestions, confirm transfer and verify dashboard/DRE result does not treat it as expense/revenue.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/finance-transfer.spec.js --reporter=line`
Expected: FAIL.

- [ ] **Step 3: Implement transfer review**

Render both sides, amount/date/account confidence information, require explicit confirmation, show resulting linkage.

- [ ] **Step 4: Run GREEN and commit**

Run: `npx playwright test qa/e2e/finance-transfer.spec.js --reporter=line && node --test test/finance-automation.test.js`
Expected: PASS.

```bash
git add desktop/renderer/views/financeiro.js qa/e2e/finance-transfer.spec.js
git commit -m "feat: add own-account transfer workflow"
```

### Task 7: UI de recorrências e alertas

**Files:**
- Modify: `desktop/renderer/views/financeiro.js`
- Test: `qa/e2e/finance-recurrence-alerts.spec.js`

**Interfaces:**
- Uses existing recurrence/alert APIs.

- [ ] **Step 1: Write failing E2E**

Create monthly recurrence for day 31, generate due entries over February/March with fixed test clock, run generation twice, verify one entry per due period. Mark alert read/hide/unhide and verify no finance entry changes.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/finance-recurrence-alerts.spec.js --reporter=line`
Expected: FAIL.

- [ ] **Step 3: Implement recurrence and alert tabs**

Forms expose status, cadence, amount, kind, account/dimensions, next date. Alerts expose severity/message/read/hidden controls without mutating financial records.

- [ ] **Step 4: Run GREEN and commit**

Run: `npx playwright test qa/e2e/finance-recurrence-alerts.spec.js --reporter=line && node --test test/finance-automation.test.js`
Expected: PASS.

```bash
git add desktop/renderer/views/financeiro.js qa/e2e/finance-recurrence-alerts.spec.js
git commit -m "feat: add recurrence and alert workflows"
```

### Task 8: UI de OFX e conciliação

**Files:**
- Modify: `desktop/main.cjs`
- Modify: `desktop/preload.cjs`
- Modify: `desktop/import-bridge.cjs`
- Modify: `desktop/renderer/views/financeiro.js`
- Test: `qa/e2e/finance-ofx-reconciliation.spec.js`

**Interfaces:**
- File selection goes through preload/main IPC only.
- Uses `/statements/preview`, `/statements/:id/commit`, `/statement-transactions`, `/reconciliation/:transactionId/*`.

- [ ] **Step 1: Write failing E2E with fixture OFX**

Flow: choose fixture -> preview -> verify no committed rows -> commit -> verify rows -> import same fixture again -> verify dedupe -> view suggestion -> accept one match -> manually reconcile another -> reject a suggestion.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/finance-ofx-reconciliation.spec.js --reporter=line`
Expected: FAIL.

- [ ] **Step 3: Expose secure file picker through IPC**

Preload API:

```js
contextBridge.exposeInMainWorld('erpDesktop', {
  getBaseUrl: () => ipcRenderer.invoke('erp:get-base-url'),
  chooseOfxFile: () => ipcRenderer.invoke('erp:choose-ofx-file')
});
```

Main uses Electron `dialog.showOpenDialog` with `.ofx` filter and returns file content/path only as required by current import bridge. Renderer never imports `fs`.

- [ ] **Step 4: Implement preview-first UI**

Disable Commit until preview succeeds. Show account, date range, transaction count, duplicates/warnings. Reusing same import should display dedupe outcome rather than silently duplicating.

- [ ] **Step 5: Implement reconciliation table**

Each transaction shows candidate entry, score/reason when available and actions Accept/Reject/Manual. All actions require explicit click.

- [ ] **Step 6: Run GREEN and compatibility gate**

Run: `npm run electron:compat && npx playwright test qa/e2e/finance-ofx-reconciliation.spec.js --reporter=line && node --test test/finance-automation.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add desktop qa/e2e/finance-ofx-reconciliation.spec.js
git commit -m "feat: add OFX reconciliation desktop workflow"
```

### Task 9: Créditos de fornecedor no financeiro

**Files:**
- Modify: `desktop/renderer/views/financeiro.js`
- Test: `qa/e2e/supplier-credit.spec.js`

**Interfaces:**
- Uses supplier-credit APIs from Phase 4.

- [ ] **Step 1: Write failing E2E**

Create paid purchase + return that creates credit, open Financeiro > Créditos de fornecedor, apply part of credit to a new payable, verify payable open amount and remaining credit.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/supplier-credit.spec.js --reporter=line`
Expected: FAIL.

- [ ] **Step 3: Implement credit list/application modal**

Show supplier, origin return, original credit, applied, remaining, status. Require selected payable and positive amount <= both credit remaining and payable open.

- [ ] **Step 4: Run GREEN and commit**

Run: `npx playwright test qa/e2e/supplier-credit.spec.js --reporter=line`
Expected: PASS.

```bash
git add desktop/renderer/views/financeiro.js qa/e2e/supplier-credit.spec.js
git commit -m "feat: expose supplier credits in finance"
```

### Task 10: Consolidar E2E 1–6 no gate de desenvolvimento

**Files:**
- Modify: `package.json`
- Modify: `qa/artisys-qa.config.json`
- Create: `qa/e2e/core-operational.spec.js`
- Test: all existing unit/integration/E2E suites.

**Interfaces:**
- Produces script `e2e:core` covering master data, inventory, procurement, sales and finance.

- [ ] **Step 1: Add cross-domain happy-path E2E**

One test starts with fresh DB and executes: login -> supplier/product/customer -> stock -> requisition/cotations/approval/order/receipt/AP -> settlement -> quote/order/invoice/AR -> settlement -> verify final stock and finance summary -> logout.

- [ ] **Step 2: Add failure-path E2E**

Separate test verifies permission denied, insufficient stock, excess receipt without authorization, duplicate idempotency retry and forbidden browser dialog count zero.

- [ ] **Step 3: Add scripts**

```json
"e2e:core": "playwright test qa/e2e/master-data.spec.js qa/e2e/inventory.spec.js qa/e2e/procurement.spec.js qa/e2e/sales-admin.spec.js qa/e2e/finance-entries.spec.js qa/e2e/finance-dimensions.spec.js qa/e2e/finance-transfer.spec.js qa/e2e/finance-recurrence-alerts.spec.js qa/e2e/finance-ofx-reconciliation.spec.js qa/e2e/supplier-credit.spec.js qa/e2e/core-operational.spec.js --reporter=line"
```

Do not add E2E to `npm test`; keep unit/integration fast. `release:check` may invoke `e2e:core` only where Electron GUI is supported; CI workflow must have a dedicated Windows/Linux GUI-capable job.

- [ ] **Step 4: Run all local supported gates**

Run: `npm run verify && npm run e2e:core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json qa
git commit -m "test: gate ERP core with real Electron E2E"
```

### Task 11: Phase 6 verification

- [ ] `npm run verify` — PASS.
- [ ] `npm run e2e:core` — PASS.
- [ ] `npm run release:check` — PASS where GUI support is available.
- [ ] Restart Electron against the E2E DB and verify finance/stock/order persistence.
- [ ] Run `npm run dist:win` in the Windows build workflow and verify artifact generation.
- [ ] Commit only concrete defects found by verification; do not claim clean-machine installation until separately executed on a clean Windows environment.
