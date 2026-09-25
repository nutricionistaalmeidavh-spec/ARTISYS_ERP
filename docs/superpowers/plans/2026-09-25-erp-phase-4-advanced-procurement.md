# ArtiSys ERP Phase 4 — Advanced Procurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir Compras para solicitação, múltiplas cotações, sugestão ponderada, divisão entre fornecedores, aprovação multinível configurável, recebimento divergente e devolução integrada a estoque/financeiro.

**Architecture:** O domínio `procurement` será decomposto por responsabilidade mantendo compatibilidade com `procurement-service.js`. A seleção final de fornecedores vira um agregado aprovado antes da geração de pedidos. Recebimentos/devoluções permanecem transacionais com estoque e financeiro; EventBus/outbox registra fatos na mesma transação e despacha efeitos secundários após commit. Ajustes financeiros preservam o valor histórico do lançamento e calculam um valor efetivo separado.

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

### Task 1: Schema avançado de compras e ajustes financeiros

**Files:**
- Create: `js/core/database/migrations/080-procurement-advanced.js`
- Modify: `js/core/database/migrations/index.js`
- Test: `test/procurement-advanced.test.js`

**Interfaces:**
- Produces tables `purchase_requisitions`, `purchase_requisition_items`, `supplier_quotations`, `supplier_quotation_items`, `procurement_awards`, `procurement_award_items`, `procurement_approval_requests`, `procurement_approval_actions`, `purchase_order_sources`, `supplier_price_history`, `purchase_receipt_variances`, `purchase_returns`, `purchase_return_items`, `financial_entry_adjustments`, `supplier_credits`, `supplier_credit_applications`.

- [ ] **Step 1: Write failing schema contract**

```js
const required = ['purchase_requisitions','purchase_requisition_items','supplier_quotations','supplier_quotation_items','procurement_awards','procurement_award_items','procurement_approval_requests','procurement_approval_actions','purchase_order_sources','supplier_price_history','purchase_receipt_variances','purchase_returns','purchase_return_items','financial_entry_adjustments','supplier_credits','supplier_credit_applications'];
const names = runtime.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
for (const name of required) assert.ok(names.includes(name), name);
```

- [ ] **Step 2: Run RED**

Run: `node --test test/procurement-advanced.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement migration with explicit states**

```text
requisition: DRAFT | QUOTING | AWARDED | CANCELLED
quotation: DRAFT | SUBMITTED | EXPIRED | REJECTED
award: DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | SUPERSEDED | ORDERS_CREATED
approval_request: PENDING | APPROVED | REJECTED | INVALIDATED
supplier_credit: OPEN | PARTIAL | USED | CANCELLED
```

`procurement_approval_requests` stores `policy_snapshot_json`, `current_level`, `requested_total_cents`. `purchase_order_sources.order_id` is UNIQUE.

`financial_entry_adjustments` fields: `id`, `entry_id`, `kind` (`CREDIT|DEBIT`), `amount_cents`, `source_type`, `source_id`, `idempotency_key UNIQUE`, `reason`, `created_by`, `created_at`.

`supplier_credits` fields include original/used/remaining cents and supplier/source return. `supplier_credit_applications` links credit to payable adjustment with unique idempotency key.

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
Expected: FAIL.

- [ ] **Step 3: Implement transactionally**

Validate active products/location, normalize quantities with `positiveQuantity`, audit each transition and insert outbox events before commit. Event payloads contain IDs/counts only.

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

Reject inactive supplier, product outside requisition, duplicate item, negative freight/payment days, invalid/expired date. On `SUBMITTED`, persist price history and `procurement.quotation.received` event.

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

Tie-break: lower effective cost, then shorter delivery, then `supplierId`.

- [ ] **Step 2: Run RED**

Run: `node --test test/procurement-scoring.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement normalized weighted score**

Normalize criteria to `0..1`. Price uses line cost plus allocated freight; delivery lower is better; payment days higher is better; availability must satisfy requested quantity or be marked partial/unavailable.

Reliability is derived from completed historical purchase orders: if supplier has at least 3 completed orders with `expected_at`, use `onTimeCompleted / completedWithExpectedAt`; otherwise use neutral `0.5`. This score is read-only and explainable. Weight sum must be > 0 and each weight >= 0.

- [ ] **Step 4: Prove suggestion never mutates business data**

Assert awards/orders row counts are unchanged after `suggest()`.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test test/procurement-scoring.test.js`
Expected: PASS.

```bash
git add js/domains/procurement/supplier-scoring-service.js test/procurement-scoring.test.js
git commit -m "feat: add explainable supplier scoring"
```

### Task 5: Award multi-fornecedor e aprovação multinível

**Files:**
- Modify: `js/core/auth/auth-service.js`
- Create: `js/domains/procurement/award-service.js`
- Create: `js/domains/procurement/approval-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/auth-session-rbac-audit.test.js`
- Test: `test/procurement-approval.test.js`

**Interfaces:**
- Produces `createAward`, `updateAward`, `submitAwardForApproval`, `approveLevel`, `rejectApproval`, `getApproval`, `generateOrders`.
- Consumes setting `procurement.approvalPolicy` as array of `{minCents,maxCents,levels:[{level,roles}]}`.
- Approval roles accepted in this release: `admin`, `manager`, `operator`, `director`; `director` is added as an authentication role specifically so policies can represent the approved multi-level example.

- [ ] **Step 1: Add failing `director` auth-role test**

```js
const director = runtime.auth.createUser({username:'diretor',name:'Diretor',role:'director',password:'senha'},admin);
assert.equal(director.role,'director');
```

- [ ] **Step 2: Add failing multi-supplier award test**

Select supplier A for item 1 and supplier B for item 2; verify total includes lines/freight and no PO exists before approval.

- [ ] **Step 3: Add failing approval snapshot test**

Configure 2 levels, submit award, alter settings afterward and assert the in-flight approval still requires the original snapshot.

- [ ] **Step 4: Implement role + approval state machine**

Extend auth role whitelist with `director`. Only a role listed in current policy level can approve. Rejection requires reason. Events: `procurement.approval.requested`, `.approved`, `.rejected`.

- [ ] **Step 5: Invalidate relevant changes**

If supplier/item/qty/unit cost/freight/payment condition changes after submission/approval, mark previous approval `INVALIDATED`, old award `SUPERSEDED`, create replacement `DRAFT`, preserve history and require resubmission.

- [ ] **Step 6: Generate one PO per supplier only after final approval**

Reuse `createPurchaseOrder()` and populate `purchase_order_sources`. Retry of `generateOrders(awardId)` returns existing linked orders.

- [ ] **Step 7: Run GREEN and commit**

Run: `node --test test/auth-session-rbac-audit.test.js test/procurement-approval.test.js test/procurement.test.js`
Expected: PASS.

```bash
git add js/core/auth/auth-service.js js/domains/procurement js/core/erp-runtime.js test/auth-session-rbac-audit.test.js test/procurement-approval.test.js
git commit -m "feat: add multi-level procurement approval"
```

### Task 6: Recebimento parcial/completo/excedente

**Files:**
- Create: `js/domains/procurement/receipt-service.js`
- Modify: `js/domains/procurement/procurement-service.js`
- Test: `test/procurement-receipt-variance.test.js`

**Interfaces:**
- Produces enhanced `receivePurchaseOrder(id,input,actor)` result containing `orderedQuantity`, `receivedThisTime`, `receivedTotal`, `missingQuantity`, `excessQuantity`, `variancePercent`, `status` per item.
- Consumes `procurement.receiptExcessTolerancePercent`.

- [ ] **Step 1: Write failing variance tests**

Order 100, receive 92 => missing 8/status `PARTIAL`. Projected total 103 with tolerance 2% => reject without authorization; accept with explicit authorization/reason.

- [ ] **Step 2: Run RED**

Run: `node --test test/procurement-receipt-variance.test.js`
Expected: FAIL because current code rejects all over-receipt.

- [ ] **Step 3: Calculate variance before mutation**

```js
const ordered=Number(poItem.quantity);
const previous=Number(poItem.received_quantity);
const projected=previous+qty;
const excess=Math.max(projected-ordered,0);
const missing=Math.max(ordered-projected,0);
const variancePercent=ordered>0?(excess/ordered)*100:0;
```

If `variancePercent > tolerance`, require `excessAuthorization.reason`. Persist a variance row for any non-zero under/over difference.

- [ ] **Step 4: Keep stock/cost/AP atomic**

Accepted quantity updates stock, weighted cost, receipt item, received quantity and AP in the same SQLite transaction. Authorized excess increases effective payable at agreed unit cost. Insert the proper receipt event before commit.

- [ ] **Step 5: Run GREEN plus rollback test**

Force finance failure after stock movement and assert stock/order/receipt unchanged.

Run: `node --test test/procurement-receipt-variance.test.js test/procurement.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/domains/procurement test/procurement-receipt-variance.test.js
git commit -m "feat: support procurement receipt variances"
```

### Task 7: Devolução, ajuste financeiro e crédito de fornecedor

**Files:**
- Modify: `js/domains/finance/finance-service.js`
- Create: `js/domains/finance/supplier-credit-service.js`
- Create: `js/domains/procurement/return-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/procurement-returns.test.js`
- Test: `test/finance-base.test.js`

**Interfaces:**
- Produces `finance.createAdjustment(entryId,{kind,amountCents,sourceType,sourceId,idempotencyKey,reason},actor)`.
- `getEntry()` additionally returns `baseAmountCents`, `adjustmentCents`, `effectiveAmountCents`; existing `amountCents` remains the original persisted amount for backward compatibility.
- Produces `createReturn`, `listReturns`, `listSupplierCredits`, `applySupplierCredit`.

- [ ] **Step 1: Write failing finance-adjustment test**

```js
const adj=runtime.finance.createAdjustment(payable.id,{kind:'CREDIT',amountCents:2000,sourceType:'purchase-return',sourceId:'ret-1',idempotencyKey:'adj-1',reason:'Devolucao'},manager);
const entry=runtime.finance.getEntry(payable.id);
assert.equal(entry.baseAmountCents,10000);
assert.equal(entry.effectiveAmountCents,8000);
assert.equal(entry.openCents,8000);
```

Retry `adj-1` returns existing adjustment and does not change totals again.

- [ ] **Step 2: Implement effective amount calculation**

`effectiveAmountCents = base amount + DEBIT adjustments - CREDIT adjustments`. Reject adjustment that would make effective amount negative. `openCents = max(effectiveAmountCents - activeSettlements, 0)`.

- [ ] **Step 3: Write open-payable return test**

Receive 10, return 2 while AP fully open: stock drops 2 and AP effective amount drops `2*unitCost`.

- [ ] **Step 4: Write paid/partial-paid return test**

If already settled amount exceeds the post-return effective obligation, cap financial CREDIT adjustment at `effectiveAmount - settled` and create supplier credit for the residual return value. Never create negative AP/open amount.

- [ ] **Step 5: Implement transactional return and credit application**

Validate returned quantity <= net received minus previous returns. Return records + inverse stock + finance adjustment + residual supplier credit happen in one transaction. Applying credit creates `supplier_credit_applications` + `financial_entry_adjustments` and updates credit used/remaining atomically. All use idempotency keys.

- [ ] **Step 6: Add events and audit**

Insert `procurement.return.completed` and, when created, `finance.supplier_credit.created`; applying a credit writes audit with credit/payable/amount.

- [ ] **Step 7: Run GREEN and commit**

Run: `node --test test/procurement-returns.test.js test/finance-base.test.js`
Expected: PASS.

```bash
git add js/domains/procurement/return-service.js js/domains/finance js/core/erp-runtime.js test/procurement-returns.test.js test/finance-base.test.js
git commit -m "feat: add supplier returns and credits"
```

### Task 8: API avançada de compras

**Files:**
- Modify: `server/routers/procurement-router.js`
- Test: `test/api-contract.test.js`

**Interfaces:**
- Produces route groups `/requisitions`, `/quotations`, `/suggestions`, `/awards`, `/approvals`, `/orders`, `/receipts`, `/returns`; supplier credits are exposed by Finance in Phase 6.

- [ ] **Step 1: Write failing HTTP lifecycle test**

Requisition -> quotes A/B -> suggestion -> award -> approval levels -> generate orders -> partial/excess receive -> return.

- [ ] **Step 2: Run RED**

Run: `node --test test/api-contract.test.js`
Expected: FAIL.

- [ ] **Step 3: Add routes without business SQL**

Mutations call domain services. General procurement mutations keep admin/manager requirement; approval action routes authenticate any user and let `approval-service` enforce the dynamic role policy so `director` can approve without gaining unrelated manager permissions.

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

Create requisition -> 2 quotations -> comparison/suggestion -> split items -> submit -> approve levels -> generate 2 orders -> partial receive -> see “faltam N” -> excess receive with authorization -> return -> verify finance effect. Include login as `director` for a configured approval level.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/procurement.spec.js --reporter=line`
Expected: FAIL.

- [ ] **Step 3: Implement operational tabs**

Tabs: Solicitações, Cotações, Aprovações, Pedidos, Recebimentos, Devoluções, Histórico de preços. Use custom forms/modals and stable test ids.

- [ ] **Step 4: Render receipt divergence always**

Show `Pedido`, `Nesta entrega`, `Acumulado`, `Faltam`, `Excedente`, `% diferença`, `Status`. Authorization modal requires reason when applicable.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm run electron:compat && npx playwright test qa/e2e/procurement.spec.js --reporter=line && npm run verify`
Expected: PASS.

```bash
git add desktop/renderer qa/e2e/procurement.spec.js
git commit -m "feat: make procurement operational in desktop"
```

### Task 10: Phase 4 verification

- [ ] `npm run verify` — PASS.
- [ ] `npx playwright test qa/e2e/procurement.spec.js --reporter=line` — PASS.
- [ ] Run procurement domain tests twice to expose idempotency/order dependence — PASS both times.
- [ ] `npm run release:check` — PASS.
- [ ] Commit only concrete fixes found by verification.
