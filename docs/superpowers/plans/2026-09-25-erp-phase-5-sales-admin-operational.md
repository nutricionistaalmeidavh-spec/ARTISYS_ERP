# ArtiSys ERP Phase 5 — Administrative Sales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar Vendas Administrativas na API e no desktop, cobrindo orçamento, edição, confirmação, reserva, faturamento parcial/total, cancelamento e histórico sem introduzir checkout/PDV.

**Architecture:** O serviço existente permanece como base de transação entre vendas, estoque e financeiro, mas será dividido em operações menores para edição e reversões. Orçamento/pedido é o agregado principal; reservas continuam no domínio de estoque e o faturamento administrativo cria recebíveis. Eventos são gravados na outbox dentro da transação e despachados após commit.

**Tech Stack:** Node.js 22+, CommonJS, SQLite, Electron, Playwright, ArtiSys EventBus.

**Spec:** `docs/superpowers/specs/2026-09-25-artisys-erp-operational-core-design.md`

## Global Constraints

- Executar depois das Phases 1–4.
- Não alterar `PDV-ARTISYS`.
- Nada de terminal, abertura/fechamento de caixa, troco, gaveta, pagamento de balcão ou NFC-e.
- `Faturamento administrativo` é gerencial e gera conta a receber; não emite documento fiscal.
- Reservas não podem ultrapassar estoque disponível.
- Faturamento parcial deve consumir apenas a parte faturada da reserva.
- Operações repetidas com a mesma idempotency key não podem duplicar estoque nem recebível.

## Review Focus

1. Editar orçamento confirmado não pode alterar silenciosamente reservas existentes; edição estrutural só em `QUOTE`.
2. Cancelar pedido parcialmente faturado deve liberar somente reserva ainda não consumida e não apagar faturamentos já feitos.
3. Faturamento retry não pode gerar segundo recebível.
4. Produto sem controle de estoque não deve criar reserva nem movimentação física.
5. Falha ao criar recebível deve fazer rollback do consumo de estoque e do invoice.

---

### Task 1: Completar edição de orçamento e histórico de estado

**Files:**
- Create: `js/core/database/migrations/090-sales-admin-history.js`
- Modify: `js/core/database/migrations/index.js`
- Modify: `js/domains/sales-admin/sales-admin-service.js`
- Test: `test/sales-admin.test.js`

**Interfaces:**
- Produces `updateQuote(id,input,actor)` and `sales_admin_order_history(order_id,action,status_from,status_to,context_json,actor_id,created_at)`.

- [ ] **Step 1: Write failing update test**

```js
const quote = runtime.salesAdmin.createQuote({customerId:c.id,locationId:'MAIN',items:[{productId:p.id,quantity:2,unitPriceCents:1000}]},manager);
const updated = runtime.salesAdmin.updateQuote(quote.id,{notes:'Novo',items:[{productId:p.id,quantity:3,unitPriceCents:900}]},manager);
assert.equal(updated.items[0].quantity,3);
assert.equal(updated.totalCents,2700);
```

Assert update after `CONFIRMED` fails.

- [ ] **Step 2: Run RED**

Run: `node --test test/sales-admin.test.js`
Expected: FAIL because `updateQuote` is absent.

- [ ] **Step 3: Add history migration and helper**

Record `CREATE_QUOTE`, `UPDATE_QUOTE`, `CONFIRM`, `CANCEL`, `INVOICE_PARTIAL`, `INVOICE_COMPLETE` with previous/new status and compact context.

- [ ] **Step 4: Implement transactional quote update**

Only `QUOTE` may be edited. Validate active customer/product/location, reject duplicate product, normalize quantity/money, replace item rows inside one transaction, audit and insert `sales.quote.updated` event.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test test/sales-admin.test.js test/database-foundation.test.js`
Expected: PASS.

```bash
git add js/core/database/migrations js/domains/sales-admin/sales-admin-service.js test/sales-admin.test.js
git commit -m "feat: add editable sales quotes and history"
```

### Task 2: Fortalecer confirmação, reservas e cancelamento parcial

**Files:**
- Modify: `js/domains/sales-admin/sales-admin-service.js`
- Test: `test/sales-admin.test.js`

**Interfaces:**
- Existing `confirmOrder` remains compatible.
- `cancelOrder` releases only active remainder reservations.
- Produces `getOrderHistory(id)`.

- [ ] **Step 1: Write failing reservation tests**

Create stock 10, quote 6, confirm, assert physical=10/reserved=6/available=4. Invoice 2, assert physical=8/reserved=4/available=4. Cancel remaining order, assert reserved=0 while physical remains 8.

- [ ] **Step 2: Run RED against current partial-cancel behavior**

Run: `node --test test/sales-admin.test.js`
Expected: expose any incorrect reservation/history behavior before implementation.

- [ ] **Step 3: Make state transitions explicit**

Use allowed transitions:

```text
QUOTE -> CONFIRMED | CANCELLED
CONFIRMED -> PARTIALLY_INVOICED | INVOICED | CANCELLED
PARTIALLY_INVOICED -> INVOICED | CANCELLED
INVOICED -> terminal
CANCELLED -> terminal
```

On cancel from `PARTIALLY_INVOICED`, release active remaining reservation only. Preserve prior invoices/receivables.

- [ ] **Step 4: Add outbox events**

Insert `sales.order.confirmed` and `sales.order.cancelled` within the same transaction.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test test/sales-admin.test.js test/master-data-inventory.test.js`
Expected: PASS.

```bash
git add js/domains/sales-admin/sales-admin-service.js test/sales-admin.test.js
git commit -m "fix: harden administrative sales reservations"
```

### Task 3: Faturamento administrativo e rollback financeiro

**Files:**
- Modify: `js/domains/sales-admin/sales-admin-service.js`
- Test: `test/sales-admin.test.js`
- Test: `test/sales-admin-finance.test.js`

**Interfaces:**
- Existing `invoiceOrder(id,input,actor)` remains idempotent and returns invoice with receivable id.

- [ ] **Step 1: Write rollback and retry tests**

```js
const first = runtime.salesAdmin.invoiceOrder(order.id,{idempotencyKey:'inv-1',items:[{productId:p.id,quantity:1}],dueAt:'2026-10-10'},manager);
const retry = runtime.salesAdmin.invoiceOrder(order.id,{idempotencyKey:'inv-1',items:[{productId:p.id,quantity:1}],dueAt:'2026-10-10'},manager);
assert.equal(first.id,retry.id);
assert.equal(runtime.finance.listEntries({kind:'RECEIVABLE'}).length,1);
```

Inject/force finance failure and assert invoice row, invoiced quantity and stock movement all rollback.

- [ ] **Step 2: Run RED if any rollback gap exists**

Run: `node --test test/sales-admin-finance.test.js`
Expected: FAIL until failure injection/atomicity contract is handled.

- [ ] **Step 3: Ensure financial creation remains inside the same SQLite transaction**

Do not move receivable creation to EventBus. Insert `sales.invoice.created` and `finance.receivable.created` events before commit, after business rows are valid.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/sales-admin.test.js test/sales-admin-finance.test.js`
Expected: PASS.

```bash
git add js/domains/sales-admin/sales-admin-service.js test/sales-admin*.test.js
git commit -m "test: guarantee atomic administrative invoicing"
```

### Task 4: Completar API de vendas administrativas

**Files:**
- Modify: `server/routers/sales-admin-router.js`
- Test: `test/api-contract.test.js`

**Interfaces:**
- Produces:
  - `GET /api/v1/sales/quotes`
  - `GET /api/v1/sales/quotes/:id`
  - `PATCH /api/v1/sales/quotes/:id`
  - `POST /api/v1/sales/orders/:id/confirm`
  - `POST /api/v1/sales/orders/:id/cancel`
  - `POST /api/v1/sales/orders/:id/invoice`
  - `GET /api/v1/sales/orders/:id/history`
  - `GET /api/v1/sales/invoices/:id`
  - existing list endpoints remain compatible.

- [ ] **Step 1: Write failing HTTP lifecycle test**

Create quote via HTTP, PATCH, GET detail, confirm, partial invoice, read history, cancel remaining portion and verify viewer can read but cannot mutate.

- [ ] **Step 2: Run RED**

Run: `node --test test/api-contract.test.js`
Expected: FAIL on missing routes.

- [ ] **Step 3: Add routes through domain service only**

Use `pathMatch`; return 404 for unknown IDs; no router SQL for mutations.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/api-contract.test.js test/sales-admin.test.js`
Expected: PASS.

```bash
git add server/routers/sales-admin-router.js test/api-contract.test.js
git commit -m "feat: expose complete administrative sales API"
```

### Task 5: Desktop operacional de Vendas

**Files:**
- Create: `desktop/renderer/views/vendas.js`
- Modify: `desktop/renderer/index.html`
- Modify: `desktop/renderer/app.js`
- Modify: `desktop/renderer/styles.css`
- Test: `qa/e2e/sales-admin.spec.js`

**Interfaces:**
- Produces `window.ErpViews.vendas({api,root})`.

- [ ] **Step 1: Write failing E2E**

Flow: create quote -> edit items/price -> confirm -> verify reservation -> partial invoice -> verify receivable -> invoice remainder -> verify status `INVOICED` -> open history. Separate case: partial invoice then cancel remainder and verify reservation release.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/sales-admin.spec.js --reporter=line`
Expected: FAIL.

- [ ] **Step 3: Build operational tabs**

Tabs: Orçamentos, Pedidos, Faturamentos. Forms include customer, stock location, item rows, quantity, price, due date and notes. Use custom confirmation modal for confirm/cancel/invoice.

Stable ids include:

```text
sales-quote-new
sales-customer
sales-location
sales-item-product-0
sales-item-quantity-0
sales-item-price-0
sales-quote-save
sales-order-confirm-<id>
sales-order-invoice-<id>
sales-order-cancel-<id>
sales-history-<id>
```

- [ ] **Step 4: Show stock/reservation feedback before confirmation**

For stock-controlled items, show physical/reserved/available. If available is insufficient, disable confirm and surface the backend-derived reason.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm run electron:compat && npx playwright test qa/e2e/sales-admin.spec.js --reporter=line && npm run verify`
Expected: PASS.

```bash
git add desktop/renderer qa/e2e/sales-admin.spec.js
git commit -m "feat: make administrative sales operational in desktop"
```

### Task 6: Phase 5 verification

- [ ] `npm run verify` — PASS.
- [ ] `npx playwright test qa/e2e/sales-admin.spec.js --reporter=line` — PASS.
- [ ] Re-run `test/sales-admin.test.js` and `test/sales-admin-finance.test.js` twice — PASS both times.
- [ ] `npm run release:check` — PASS.
- [ ] Commit only concrete verification fixes.
