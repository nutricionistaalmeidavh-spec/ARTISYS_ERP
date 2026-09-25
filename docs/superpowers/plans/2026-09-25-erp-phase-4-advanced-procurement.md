# ArtiSys ERP Phase 4 — Advanced Procurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir Compras para solicitação, múltiplas cotações, sugestão ponderada, divisão entre fornecedores, aprovação multinível configurável, recebimento divergente e devolução integrada a estoque/financeiro.

**Architecture:** O domínio `procurement` será decomposto por responsabilidade mantendo compatibilidade com `procurement-service.js`. A seleção final de fornecedores vira um agregado aprovado antes da geração de pedidos. Recebimentos/devoluções permanecem transacionais com estoque e financeiro; EventBus/outbox registra fatos na mesma transação e despacha efeitos secundários após commit.

**Tech Stack:** Node.js 22+, CommonJS, SQLite, Electron 39, Playwright 1.63, ArtiSys EventBus.

**Spec:** `docs/superpowers/specs/2026-09-25-artisys-erp-operational-core-design.md`

## Global Constraints

- Executar depois das Phases 1–3.
- Não alterar `PDV-ARTISYS`.
- Uma solicitação aceita múltiplas cotações e pode ser dividida entre fornecedores.
- Sugestão automática nunca gera pedido sem confirmação humana.
- Aprovação suporta 1..N níveis e política configurável localmente.
- Mudança relevante após aprovação invalida a aprovação e exige novo ciclo.
- Recebimento mostra pedido, recebido, acumulado, faltante, excedente e percentual.
- Excedente acima da tolerância exige autorização explícita.
- Devolução preserva histórico original e ajusta AP/crédito sem apagar dados.

## Review Focus

1. Política alterada depois de iniciar aprovação não pode reescrever o fluxo já criado; salvar snapshot da política.
2. Cotação vencida ou sem quantidade disponível não pode ser selecionada automaticamente.
3. Award aprovado alterado deve virar `SUPERSEDED`/novo ciclo, nunca permanecer aprovado.
4. Excedente não autorizado não pode mexer em estoque, custo nem AP.
5. Devolução maior que saldo aberto reduz AP até zero e gera crédito apenas do excedente financeiro.

---

### Task 1: Schema avançado de compras

**Files:**
- Create: `js/core/database/migrations/080-procurement-advanced.js`
- Modify: `js/core/database/migrations/index.js`
- Test: `test/procurement-advanced.test.js`

**Interfaces:**
- Produces tables `purchase_requisitions`, `purchase_requisition_items`, `supplier_quotations`, `supplier_quotation_items`, `procurement_awards`, `procurement_award_items`, `procurement_approval_requests`, `procurement_approval_actions`, `purchase_order_sources`, `supplier_price_history`, `purchase_receipt_variances`, `purchase_returns`, `purchase_return_items`, `supplier_credits`.

- [ ] **Step 1: Write failing schema contract**

```js
const required = ['purchase_requisitions','purchase_requisition_items','supplier_quotations','supplier_quotation_items','procurement_awards','procurement_award_items','procurement_approval_requests','procurement_approval_actions','purchase_order_sources','supplier_price_history','purchase_receipt_variances','purchase_returns','purchase_return_items','supplier_credits'];
const names = runtime.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
for (const name of required) assert.ok(names.includes(name), name);
```

- [ ] **Step 2: Run RED**

Run: `node --test test/procurement-advanced.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement migration**

Use explicit status checks:

```text
requisition: DRAFT | QUOTING | AWARDED | CANCELLED
quotation: DRAFT | SUBMITTED | EXPIRED | REJECTED
award: DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | SUPERSEDED | ORDERS_CREATED
approval_request: PENDING | APPROVED | REJECTED | INVALIDATED
supplier_credit: OPEN | PARTIAL | USED | CANCELLED
```

`procurement_approval_requests` stores `policy_snapshot_json`, `current_level`, `requested_total_cents`. `purchase_order_sources.order_id` must be UNIQUE. Add indexes by requisition, supplier, status and dates.

- [ ] **Step 4: Run GREEN**

Run: `node --test test/procurement-advanced.test.js test/database-foundation.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/core/database/migrations test/procurement-advanced.test.js
git commit -m "feat: add advanced procurement schema"
```

### Task 2: Solicitações de compra

**Files:**
- Create: `js/domains/procurement/requisition-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/procurement-advanced.test.js`

**Interfaces:**
- Produces `createRequisition`, `updateRequisition`, `submitForQuotation`, `cancelRequisition`, `getRequisition`, `listRequisitions`.

- [ ] **Step 1: Write failing lifecycle tests**

```js
const req = runtime.procurementRequisitions.createRequisition({locationId:'MAIN',justification:'Reposicao',items:[{productId:p.id,quantity:10}]},manager);
assert.equal(req.status,'DRAFT');
const quoting = runtime.procurementRequisitions.submitForQuotation(req.id,manager);
assert.equal(quoting.status,'QUOTING');
```

Also assert duplicate product rejection, editing only in `DRAFT`, cancellation reason required, audit row and `procurement.request.created` outbox event.

- [ ] **Step 2: Run RED**

Run: `node --test test/procurement-advanced.test.js`
Expected: FAIL on missing service.

- [ ] **Step 3: Implement service transactionally**

Validate active products/location, normalize quantities with `positiveQuantity`, audit each state transition and insert events before commit. Payloads contain IDs/counts, not unnecessary customer/supplier personal data.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/procurement-advanced.test.js`
Expected: PASS.

```bash
git add js/domains/procurement/requisition-service.js js/core/erp-runtime.js test/procurement-advanced.test.js
git commit -m "feat: add purchase requisitions"
```

### Task 3: Cotações e histórico de preços

**Files:**
- Create: `js/domains/procurement/quotation-service.js`
- Create: `js/domains/procurement/pricing-history-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/procurement-advanced.test.js`

**Interfaces:**
- Produces `createQuotation`, `updateQuotation`, `submitQuotation`, `getQuotation`, `listQuotations`, `listPriceHistory`.

- [ ] **Step 1: Write RED tests for multiple suppliers**

Quote fields: `unitCostCents`, `availableQuantity`, `deliveryDays`, quotation-level `freightCents`, `paymentDays`, `validUntil`, notes.

- [ ] **Step 2: Run RED**

Run: `node --test test/procurement-advanced.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement normalization and validation**

```js
const normalized = {
  unitCostCents: assertCents(item.unitCostCents,'unitCostCents'),
  availableQuantity: positiveQuantity(item.availableQuantity,'Disponibilidade'),
  deliveryDays: Math.max(0, Number(item.deliveryDays)||0)
};
```

Reject inactive supplier, product outside requisition, duplicate item, negative freight/payment days, invalid/expired dates at submission. On `SUBMITTED`, persist price history and `procurement.quotation.received` event.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/procurement-advanced.test.js`
Expected: PASS.

```bash
git add js/domains/procurement/quotation-service.js js/domains/procurement/pricing-history-service.js js/core/erp-runtime.js test/procurement-advanced.test.js
git commit -m "feat: add supplier quotations and price history"
```

### Task 4: Scoring configurável e sugestão explicável

**Files:**
- Create: `js/domains/procurement/supplier-scoring-service.js`
- Test: `test/procurement-scoring.test.js`

**Interfaces:**
- Consumes setting `procurement.scoringWeights` with keys `price`, `freight`, `delivery`, `payment`, `availability`, `reliability`.
- Produces `suggest(requisitionId)` returning candidates per item, selected combination, total effective cost, score and explanation.

- [ ] **Step 1: Write deterministic scoring tests**

```js
runtime.settings.set('procurement.scoringWeights',{price:40,freight:15,delivery:15,payment:10,availability:15,reliability:5},manager);
const result = runtime.procurementScoring.suggest(req.id);
assert.ok(result.items.every(i => i.selected.supplierId));
assert.ok(result.explanation.length > 0);
```

Test tie-breaking deterministically by lower effective cost, then shorter delivery, then supplierId.

- [ ] **Step 2: Run RED**

Run: `node --test test/procurement-scoring.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement normalized weighted score**

Normalize each criterion to `0..1` within the candidate set. Price score uses line cost plus allocated freight; delivery lower is better; payment days higher is better; availability must satisfy requested quantity or be marked partial/unavailable; reliability defaults neutral when absent. Weight sum must be > 0 and values >= 0.

- [ ] **Step 4: Prove suggestion never mutates business data**

Assert row counts for awards/orders unchanged after `suggest()`.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test test/procurement-scoring.test.js`
Expected: PASS.

```bash
git add js/domains/procurement/supplier-scoring-service.js test/procurement-scoring.test.js
git commit -m "feat: add explainable supplier scoring"
```

### Task 5: Award multi-fornecedor e aprovação multinível

**Files:**
- Create: `js/domains/procurement/award-service.js`
- Create: `js/domains/procurement/approval-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/procurement-approval.test.js`

**Interfaces:**
- Produces `createAward`, `updateAward`, `submitAwardForApproval`, `approveLevel`, `rejectApproval`, `getApproval`, `generateOrders`.
- Consumes setting `procurement.approvalPolicy` as array of `{minCents,maxCents,levels:[{level,roles}]}`.

- [ ] **Step 1: Write failing multi-supplier award tests**

Create award selecting supplier A for item 1 and supplier B for item 2; verify total includes line values and allocated freight and no PO exists yet.

- [ ] **Step 2: Write failing approval snapshot test**

Configure 2 levels, submit award, alter settings afterward and assert current approval still requires the original 2-level snapshot.

- [ ] **Step 3: Implement award + approval state machine**

Only roles in current level can approve. Rejection requires reason. Approval event names: `procurement.approval.requested`, `.approved`, `.rejected`.

- [ ] **Step 4: Implement invalidation on relevant change**

When approved/pending award receives change to supplier/item/qty/unit cost/freight/payment condition, mark previous request `INVALIDATED`, award `SUPERSEDED`, create a replacement draft derived from it and require resubmission. Preserve all historical actions.

- [ ] **Step 5: Generate one purchase order per supplier only after final approval**

Reuse `createPurchaseOrder()` but add `purchase_order_sources` links. Preserve idempotency so retrying `generateOrders(awardId)` returns the existing order set.

- [ ] **Step 6: Run GREEN and commit**

Run: `node --test test/procurement-approval.test.js test/procurement.test.js`
Expected: PASS.

```bash
git add js/domains/procurement js/core/erp-runtime.js test/procurement-approval.test.js
git commit -m "feat: add multi-level procurement approval"
```

### Task 6: Recebimento parcial/completo/excedente

**Files:**
- Create: `js/domains/procurement/receipt-service.js`
- Modify: `js/domains/procurement/procurement-service.js`
- Test: `test/procurement-receipt-variance.test.js`

**Interfaces:**
- Produces enhanced `receivePurchaseOrder(id,input,actor)` result with each item containing `orderedQuantity`, `receivedThisTime`, `receivedTotal`, `missingQuantity`, `excessQuantity`, `variancePercent`, `status`.
- Consumes setting `procurement.receiptExcessTolerancePercent`.

- [ ] **Step 1: Write failing variance tests**

Test order 100, receive 92 => `missingQuantity=8`, status `PARTIAL`; receive total 103 with 2% tolerance => reject without `excessAuthorization`; accept when authorized by eligible manager/admin.

- [ ] **Step 2: Run RED**

Run: `node --test test/procurement-receipt-variance.test.js`
Expected: FAIL because current service rejects any quantity above pending.

- [ ] **Step 3: Implement variance calculation before mutation**

```js
const ordered = Number(poItem.quantity);
const previous = Number(poItem.received_quantity);
const projected = previous + qty;
const excess = Math.max(projected - ordered, 0);
const missing = Math.max(ordered - projected, 0);
const variancePercent = ordered > 0 ? (excess / ordered) * 100 : 0;
```

If `variancePercent > tolerance` require `{excessAuthorization:{reason}}` and eligible actor. Always persist variance row for non-zero difference.

- [ ] **Step 4: Keep critical effects in one transaction**

Accepted quantity updates stock, weighted cost, receipt item, received quantity and AP in the same transaction. Exceeded authorized quantity increases effective payable using agreed unit cost. Insert `procurement.receipt.partial|completed|excess_authorized` event before commit.

- [ ] **Step 5: Run GREEN and rollback test**

Force finance failure after stock movement and assert stock/order/receipt remain unchanged.

Run: `node --test test/procurement-receipt-variance.test.js test/procurement.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/domains/procurement test/procurement-receipt-variance.test.js
git commit -m "feat: support procurement receipt variances"
```

### Task 7: Devolução e crédito de fornecedor

**Files:**
- Create: `js/domains/procurement/return-service.js`
- Create: `js/domains/finance/supplier-credit-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/procurement-returns.test.js`

**Interfaces:**
- Produces `createReturn(receiptId,input,actor)`, `listReturns`, `listSupplierCredits`, `applySupplierCredit(creditId,payableId,amountCents,actor)`.

- [ ] **Step 1: Write failing open-payable return test**

Receive 10 units, return 2 while AP is fully open: stock drops 2 and AP effective amount/open balance drops exactly `2 * unitCost`.

- [ ] **Step 2: Write paid/partial-paid return test**

If AP is settled beyond the remaining obligation, create supplier credit for the non-reducible value. Never create negative AP.

- [ ] **Step 3: Implement transactional return**

Validate returned quantity <= net received minus previous returns. Record return + items, create inverse stock movement, adjust AP through an explicit financial adjustment mechanism, create supplier credit for residual, audit and outbox `procurement.return.completed` / `finance.supplier_credit.created`.

- [ ] **Step 4: Implement explicit credit application**

Applying credit to a future payable reduces its open obligation through an auditable adjustment row; support partial credit and idempotency key.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test test/procurement-returns.test.js test/finance-base.test.js`
Expected: PASS.

```bash
git add js/domains/procurement/return-service.js js/domains/finance/supplier-credit-service.js js/core/erp-runtime.js test/procurement-returns.test.js
git commit -m "feat: add supplier returns and credits"
```

### Task 8: API avançada de compras

**Files:**
- Modify: `server/routers/procurement-router.js`
- Test: `test/api-contract.test.js`

**Interfaces:**
- Produces REST groups `/requisitions`, `/quotations`, `/suggestions`, `/awards`, `/approvals`, `/orders`, `/receipts`, `/returns`, `/supplier-credits` with item/action routes matching domain methods.

- [ ] **Step 1: Write failing API lifecycle test**

HTTP flow: requisition -> quotation A/B -> suggestion GET -> award -> submit approval -> approve levels -> generate orders -> receive partial/excess -> return.

- [ ] **Step 2: Run RED**

Run: `node --test test/api-contract.test.js`
Expected: FAIL.

- [ ] **Step 3: Add routes without business SQL**

Routers call services, enforce `admin/manager` for mutations and return `404` for missing resources. Approval endpoints rely on service role checks in addition to router authentication.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/api-contract.test.js test/procurement-advanced.test.js test/procurement-approval.test.js test/procurement-receipt-variance.test.js test/procurement-returns.test.js`
Expected: PASS.

```bash
git add server/routers/procurement-router.js test/api-contract.test.js
git commit -m "feat: expose advanced procurement API"
```

### Task 9: Desktop operacional de Compras

**Files:**
- Create: `desktop/renderer/views/compras.js`
- Modify: `desktop/renderer/index.html`
- Modify: `desktop/renderer/app.js`
- Modify: `desktop/renderer/styles.css`
- Test: `qa/e2e/procurement.spec.js`

**Interfaces:**
- Produces `window.ErpViews.compras({api,root})`.

- [ ] **Step 1: Write failing E2E**

Flow: criar solicitação -> lançar 2 cotações -> visualizar comparação/sugestão -> dividir itens entre fornecedores -> enviar -> aprovar níveis -> gerar 2 pedidos -> receber parcialmente -> visualizar “faltam N” -> receber excedente -> exigir/registrar autorização -> devolver item -> verificar impacto financeiro.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/procurement.spec.js --reporter=line`
Expected: FAIL.

- [ ] **Step 3: Implement tabs operacionais**

Tabs: Solicitações, Cotações, Aprovações, Pedidos, Recebimentos, Devoluções, Histórico de preços. Use modais/forms próprios, badges explícitos e test ids estáveis.

- [ ] **Step 4: Render divergência sempre visível**

Each receipt row shows `Pedido`, `Nesta entrega`, `Acumulado`, `Faltam`, `Excedente`, `% diferença`, `Status`. Excedent authorization modal requires reason when needed.

- [ ] **Step 5: Run GREEN**

Run: `npm run electron:compat && npx playwright test qa/e2e/procurement.spec.js --reporter=line && npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/renderer qa/e2e/procurement.spec.js
git commit -m "feat: make procurement operational in desktop"
```

### Task 10: Phase 4 verification

- [ ] `npm run verify` — PASS.
- [ ] `npx playwright test qa/e2e/procurement.spec.js --reporter=line` — PASS.
- [ ] Run procurement domain tests twice to surface idempotency/order dependence — PASS both times.
- [ ] `npm run release:check` — PASS.
- [ ] Commit only concrete fixes found by verification.
