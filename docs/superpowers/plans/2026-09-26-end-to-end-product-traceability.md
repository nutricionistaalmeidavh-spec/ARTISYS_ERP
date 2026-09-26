# End-to-End Product Traceability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar rastreabilidade econômica ponta a ponta entre compras, recebimento, estoque, OS, produção, venda administrativa, PDV, financeiro e BI, com CMV realizado, margem por produto/fornecedor e lead times reproduzíveis por drill-down.

**Architecture:** Adicionar um ledger de camadas de custo e saldos por localização como camada transversal, sem substituir o estoque físico nem o financeiro existentes. As saídas comerciais e operacionais passam a consumir camadas atomically; `commercial_facts` materializa receita/CMV por canal para relatórios e DRE sem dupla contagem. Um serviço de rastreabilidade reconstrói a cadeia fornecedor -> compra -> recebimento -> estoque -> consumo/venda -> financeiro/BI.

**Tech Stack:** Node.js >=22, CommonJS, `node:sqlite`/`DatabaseSync`, React 19, TypeScript 5.9, Vite 7, testes `node:test`, Playwright/E2E existente.

**Spec:** `docs/superpowers/specs/2026-09-26-end-to-end-product-traceability-design.md`

## Global Constraints

- Manter o produto local-first; nenhuma dependência SaaS ou serviço externo obrigatório.
- Estoque físico continua autoridade para saldo operacional; ledger é autoridade para origem e custo histórico.
- Financeiro continua autoridade para títulos, settlements e fluxo de caixa.
- Toda escrita crítica permanece síncrona e transacional via `withTransaction`/`DatabaseSync`.
- Toda mutação de camada, alocação, reversão e fato comercial deve ser idempotente.
- Nunca recalcular custo histórico usando o custo atual do cadastro.
- Devoluções e estornos são compensatórios; histórico nunca é apagado.
- Toda tabela nova deve respeitar `company_id`; consultas não podem misturar empresas sem visão consolidada explícita.
- FIFO/FEFO/lote/série usados pelo ledger devem ser consistentes com a política física do estoque.
- Não inventar origem histórica: usar `LEGACY_UNATTRIBUTED` quando a origem não puder ser comprovada.
- Venda administrativa, PDV e OS devem compartilhar a mesma semântica de receita/CMV em `commercial_facts`.
- `financial_entries` originados desses canais continuam no fluxo de caixa, mas não podem duplicar receita na DRE.

## Review Focus

1. **Consumo fracionado por múltiplas camadas:** uma saída maior que a camada mais antiga deve dividir alocações sem perder quantidade nem centavos de custo.
2. **Transferência com saldo insuficiente na origem:** deve falhar atomicamente e não mover saldo físico nem saldo de camada parcialmente.
3. **Devolução após consumo de múltiplas camadas:** deve reverter proporcionalmente as alocações originais e recompor as mesmas origens quando possível.
4. **Retry após falha intermediária:** repetir a mesma `idempotency_key` deve retornar o mesmo resultado sem duplicar camada, fato, alocação, título ou movimento.
5. **Backfill legado sem origem comprovável:** deve produzir `LEGACY_UNATTRIBUTED`, nunca fornecedor/cotação fictícios, e deve aparecer como legado nos relatórios.

---

## Mapa de arquivos

### Novos arquivos principais

- `js/core/database/migrations/160-traceability-ledger.js` — tabelas do ledger, links e fatos comerciais.
- `js/domains/traceability/inventory-cost-ledger.js` — camadas, saldos, alocações, transferências e reversões.
- `js/domains/traceability/traceability-service.js` — reconstrução da cadeia operacional/econômica.
- `js/domains/traceability/commercial-fact-service.js` — normalização/materialização de receita, CMV, devoluções e margens.
- `js/domains/traceability/product-performance-service.js` — indicadores de produto/fornecedor/lead time.
- `js/domains/traceability/legacy-backfill-service.js` — backfill histórico idempotente e reconciliação.
- `server/routers/traceability-router.js` — APIs de rastreabilidade/performance/drill-down.
- `frontend/src/pages/TraceabilityPage.tsx` — produto > rastreabilidade/performance.
- `test/traceability-ledger.test.js`
- `test/traceability-commerce.test.js`
- `test/traceability-service-orders.test.js`
- `test/traceability-manufacturing.test.js`
- `test/traceability-reporting.test.js`
- `test/traceability-backfill.test.js`
- `qa/e2e/traceability-flow.test.js`

### Arquivos existentes a modificar

- `js/core/database/migrations/index.js`
- `js/core/erp-runtime.js`
- `js/domains/procurement/procurement-service.js`
- `js/domains/sales-admin/sales-admin-service.js`
- `js/domains/sales-admin/retail-operations-service.js`
- `js/domains/services/service-order-service.js`
- `js/domains/manufacturing/manufacturing-service.js`
- `js/domains/inventory/inventory-operations-service.js`
- `js/domains/procurement/return-service.js`
- `js/domains/reports/reporting-service.js`
- `js/domains/reports/business-intelligence-service.js`
- `js/domains/finance/finance-management.js`
- `js/core/observability/system-health.js`
- `server/local-server.js`
- `server/routers/reporting-router.js`
- `frontend/src/app/navigation.ts`
- `frontend/src/app/App.tsx`
- `frontend/src/pages/ReportsPage.tsx`
- `frontend/src/pages/IntelligencePage.tsx`
- `package.json`
- `qa/vertical-coverage.md`
- `release/customer-capabilities.json`

---

### Task 1: Persistência do ledger e invariantes básicas

**Files:**
- Create: `js/core/database/migrations/160-traceability-ledger.js`
- Modify: `js/core/database/migrations/index.js`
- Test: `test/traceability-ledger.test.js`

**Interfaces:**
- Produces tables: `inventory_cost_layers`, `inventory_cost_layer_balances`, `inventory_cost_allocations`, `traceability_links`, `commercial_facts`.
- Produces unique constraints for idempotency and indexes by `company_id`, `product_id`, `source_type/source_id`, `destination_type/destination_id`, `layer_id/location_id`.

- [ ] **Step 1: Write failing migration tests** asserting all five tables, FKs/checks, uniqueness of allocation/fact idempotency and company-scoped indexes.
- [ ] **Step 2: Run** `node --test test/traceability-ledger.test.js` and confirm failure because migration/tables do not exist.
- [ ] **Step 3: Implement migration `160-traceability-ledger`** and register it after `151-manufacturing-loss-reservation-guard`.
- [ ] **Step 4: Add database constraints**: positive original quantities; non-negative layer balances; positive allocation quantity/cost; unique `(company_id, layer_id, location_id)` balance; unique idempotency keys scoped by company.
- [ ] **Step 5: Re-run** `node --test test/traceability-ledger.test.js` and confirm PASS.
- [ ] **Step 6: Commit** `feat: add traceability ledger schema`.

### Task 2: Inventory Cost Ledger

**Files:**
- Create: `js/domains/traceability/inventory-cost-ledger.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/traceability-ledger.test.js`

**Interfaces:**
- Produces `createInventoryCostLedger({db,catalog,inventory,now,idFactory})`.
- Produces methods:
  - `createLayer(input, actor)`
  - `allocateOutflow(input, actor)`
  - `reverseAllocation(input, actor)`
  - `transferLayerBalance(input, actor)`
  - `getRealizedCost({destinationType,destinationId,destinationItemId?,companyId})`
  - `listLayers({productId,locationId?,companyId})`
  - `reconcileProduct({productId,companyId})`

- [ ] **Step 1: Write failing tests** for two layers with different costs, partial allocation, multi-layer FIFO, insufficient balance, idempotent retry and company isolation.
- [ ] **Step 2: Run** `node --test test/traceability-ledger.test.js` and confirm failures on missing service.
- [ ] **Step 3: Implement `createLayer`** creating economic identity plus initial `inventory_cost_layer_balances` row atomically.
- [ ] **Step 4: Implement `allocateOutflow`** selecting eligible balances deterministically, splitting quantity across layers and storing exact unit/total cost snapshots.
- [ ] **Step 5: Implement `transferLayerBalance`** moving quantity between locations under the same `layer_id`; verify insufficient origin balance rolls back completely.
- [ ] **Step 6: Implement `reverseAllocation`** as compensating records that restore source-layer balance without deleting the original allocation.
- [ ] **Step 7: Implement `reconcileProduct`** comparing physical quantity with traceable layer quantity and returning discrepancy details.
- [ ] **Step 8: Wire `costLedger` into `createErpRuntime`**.
- [ ] **Step 9: Run** `node --test test/traceability-ledger.test.js` and `npm run boundary:check`; both must PASS.
- [ ] **Step 10: Commit** `feat: add inventory cost ledger`.

### Task 3: Compra, recebimento e cadeia de fornecedor

**Files:**
- Modify: `js/domains/procurement/procurement-service.js`
- Create: `js/domains/traceability/traceability-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/traceability-commerce.test.js`

**Interfaces:**
- `createTraceabilityService({db,now,idFactory})`
- `link({fromType,fromId,toType,toId,relationType,metadata?,companyId}, actor)`
- `traceSource({type,id,companyId})`
- Procurement receipt calls `costLedger.createLayer` once per received item after physical entry, within the same transaction.

- [ ] **Step 1: Write failing test** for requisition -> quotation -> award -> purchase order -> receipt -> layer, asserting supplier/order/receipt provenance and received unit cost.
- [ ] **Step 2: Run** `node --test test/traceability-commerce.test.js` and confirm failure before integration.
- [ ] **Step 3: Add traceability links only where existing FKs are insufficient**; prefer existing requisition/quotation/award/order relations over duplicated generic links.
- [ ] **Step 4: Integrate purchase receipt** so inventory move + layer creation + payable remain atomic; populate `supplier_id`, `purchase_order_id`, `purchase_receipt_id`, `source_item_id`, `unit_cost_cents`, `received_at`.
- [ ] **Step 5: Add tests for partial receipt and two receipts of the same product at different costs**.
- [ ] **Step 6: Run** `node --test test/traceability-commerce.test.js` and existing procurement tests; all PASS.
- [ ] **Step 7: Commit** `feat: trace procurement receipts into cost layers`.

### Task 4: Venda administrativa e PDV com CMV realizado

**Files:**
- Create: `js/domains/traceability/commercial-fact-service.js`
- Modify: `js/domains/sales-admin/sales-admin-service.js`
- Modify: `js/domains/sales-admin/retail-operations-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/traceability-commerce.test.js`

**Interfaces:**
- `createCommercialFactService({db,now,idFactory})`
- Methods:
  - `recordSaleFact(input, actor)`
  - `recordReversalFact(input, actor)`
  - `listFacts(filters)`
  - `rebuild({companyId,from?,to?}, actor)`
- `recordSaleFact` receives exact `realizedCostCents` from cost allocations; it never reads mutable `products.cost_cents` for historical CMV.

- [ ] **Step 1: Write failing tests** where an administrative invoice and a PDV sale consume different cost layers and produce exact revenue, CMV and margin facts.
- [ ] **Step 2: Run** `node --test test/traceability-commerce.test.js` and confirm missing allocations/facts.
- [ ] **Step 3: Integrate administrative invoicing**: consuming reserved stock must also allocate cost by invoice item inside the same transaction; persist fact per item/source.
- [ ] **Step 4: Integrate PDV sale**: physical stock move, cost allocation, receivable, settlements and facts must commit/rollback together.
- [ ] **Step 5: Add retry test** proving repeated sale/invoice idempotency does not duplicate allocations, facts or finance entries.
- [ ] **Step 6: Run** commerce + sales-admin + retail tests; all PASS.
- [ ] **Step 7: Commit** `feat: add realized COGS to admin sales and POS`.

### Task 5: Ordens de Serviço

**Files:**
- Modify: `js/domains/services/service-order-service.js`
- Test: `test/traceability-service-orders.test.js`

**Interfaces:**
- `consumePart` allocates cost with destination `SERVICE_ORDER` and `destinationItemId=line.id` when physical consumption occurs.
- `complete` materializes service/parts revenue facts using actual consumed quantities and realized part costs.

- [ ] **Step 1: Write failing test** for purchase receipt -> OS reserve -> partial part consumption -> completion -> receivable -> commercial facts.
- [ ] **Step 2: Assert** OS approval/reservation alone does not recognize cost.
- [ ] **Step 3: Integrate `consumePart`** with ledger allocation in the same transaction as inventory reservation consumption.
- [ ] **Step 4: Integrate `complete`** to create separate facts for service revenue and part lines; part CMV comes from allocations only.
- [ ] **Step 5: Add cancellation/no-consumption test** proving no CMV is recognized for unused reserved parts.
- [ ] **Step 6: Run** `node --test test/traceability-service-orders.test.js test/service-orders-operational.test.js`; PASS.
- [ ] **Step 7: Commit** `feat: trace service order parts and margins`.

### Task 6: Manufatura e herança de custo

**Files:**
- Modify: `js/domains/manufacturing/manufacturing-service.js`
- Test: `test/traceability-manufacturing.test.js`

**Interfaces:**
- Component consumption allocates destination `MANUFACTURING_ORDER`.
- Finished output creates an `inventory_cost_layers` layer whose unit cost is based on realized material allocations + OP additional costs divided by good output quantity.
- Traceability must link finished layer -> OP -> component allocations -> source layers.

- [ ] **Step 1: Write failing test** with components from two purchase costs, additional labor cost, one good unit and one scrap unit.
- [ ] **Step 2: Run** manufacturing traceability test and confirm missing cost inheritance.
- [ ] **Step 3: Integrate component consumption** with ledger allocations.
- [ ] **Step 4: On completed/good output, create finished-goods layer** with realized attributable cost; do not create stock/value for scrapped quantity.
- [ ] **Step 5: Add downstream sale assertion**: finished product sale traces through OP to component supplier layers.
- [ ] **Step 6: Run** new test plus `test/manufacturing-pcp-mrp.test.js`; PASS.
- [ ] **Step 7: Commit** `feat: propagate manufacturing costs through traceability`.

### Task 7: Transferências, ajustes e devoluções

**Files:**
- Modify: `js/domains/inventory/inventory-operations-service.js`
- Modify: `js/domains/sales-admin/retail-operations-service.js`
- Modify: `js/domains/procurement/return-service.js`
- Test: `test/traceability-ledger.test.js`
- Test: `test/traceability-commerce.test.js`

**Interfaces:**
- Transfers preserve `layer_id` and only move `inventory_cost_layer_balances`.
- Positive traceable adjustment requires explicit `unitCostCents`; otherwise fail instead of inventing cost.
- Sale return reverses original allocation(s) and creates negative/compensating commercial fact(s).
- Supplier return reduces only remaining balances attributable to the returned receipt/layers.

- [ ] **Step 1: Add failing tests** for transfer, positive adjustment with/without cost, partial sale return after multi-layer consumption and supplier return after partial downstream consumption.
- [ ] **Step 2: Integrate transfer** physical movement + layer-balance movement atomically.
- [ ] **Step 3: Integrate positive adjustment** to create auditable layer only with explicit safe cost.
- [ ] **Step 4: Integrate sale returns** to restore matching source layers and reverse revenue/CMV proportionally.
- [ ] **Step 5: Integrate supplier returns** to consume available receipt-origin layer balance only; reject over-return that would rewrite already-consumed historical cost.
- [ ] **Step 6: Run** ledger/commerce tests plus existing return tests; PASS.
- [ ] **Step 7: Commit** `feat: preserve cost lineage across transfers and returns`.

### Task 8: Relatório comercial consolidado e DRE sem dupla contagem

**Files:**
- Modify: `js/domains/reports/reporting-service.js`
- Modify: `js/domains/finance/finance-management.js`
- Modify: `server/routers/reporting-router.js`
- Test: `test/traceability-reporting.test.js`

**Interfaces:**
- `reports.buildCommercialSummary({from,to,companyId,channel?,productId?,customerId?})`
- `reports.listCommercialFacts(filters)`
- DRE operational revenue/COGS derives from `commercial_facts`.
- Generic finance rows exclude known operational revenue source types: `sales-admin-invoice`, `pos-sale`, `service-order`.

- [ ] **Step 1: Write failing test** containing one admin sale, one PDV sale and one completed OS with expected combined revenue/CMV/margin.
- [ ] **Step 2: Add assertion** that DRE revenue equals commercial facts once, not facts + receivable entries.
- [ ] **Step 3: Implement `buildCommercialSummary`** from `commercial_facts`, including reversals and filters.
- [ ] **Step 4: Refactor existing sales summary compatibility** so current consumers keep working while new consolidated endpoint uses the normalized facts.
- [ ] **Step 5: Update DRE exclusion list/logic** for all supported commercial source types.
- [ ] **Step 6: Add GET `/api/v1/reports/commercial`** and drill-down endpoint under reporting router.
- [ ] **Step 7: Run** reporting/finance tests and existing report tests; PASS.
- [ ] **Step 8: Commit** `feat: consolidate commercial reporting and COGS`.

### Task 9: Performance por produto/fornecedor e lead times

**Files:**
- Create: `js/domains/traceability/product-performance-service.js`
- Modify: `js/domains/reports/business-intelligence-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/traceability-reporting.test.js`

**Interfaces:**
- `productPerformance.product({productId,from,to,companyId,locationId?,supplierId?,channel?})`
- `productPerformance.bySupplier({productId?,from,to,companyId})`
- `productPerformance.leadTimes({productId?,supplierId?,from,to,companyId})`
- Return metrics from spec: purchased qty, average/last acquisition cost, sold qty, revenue, CMV, gross margin, average sell price, purchase->receipt, receipt->sale/consume, purchase->sale/consume, current traceable stock value, returns, OS usage, manufacturing usage.

- [ ] **Step 1: Write failing deterministic lead-time test** with known order/receipt/sale timestamps and two suppliers.
- [ ] **Step 2: Implement product aggregation** directly from ledger/facts/source dates; every aggregate must expose drill-down IDs.
- [ ] **Step 3: Implement supplier aggregation** without attributing legacy-unattributed quantities to a real supplier.
- [ ] **Step 4: Update `businessIntelligence.overview`** to use commercial consolidated totals/top products based on `commercial_facts` rather than only `sales_admin_invoice_items`.
- [ ] **Step 5: Run** reporting tests; PASS.
- [ ] **Step 6: Commit** `feat: add product and supplier performance analytics`.

### Task 10: APIs de rastreabilidade e wiring do runtime

**Files:**
- Create: `server/routers/traceability-router.js`
- Modify: `server/local-server.js`
- Modify: `js/core/erp-runtime.js`
- Modify: `package.json`
- Test: `test/traceability-reporting.test.js`

**Interfaces:**
- GET `/api/v1/traceability/products/:id`
- GET `/api/v1/traceability/sources/:type/:id`
- GET `/api/v1/traceability/products/:id/performance`
- GET `/api/v1/traceability/suppliers/performance`
- GET `/api/v1/traceability/margins/:sourceType/:sourceId`
- POST `/api/v1/traceability/rebuild-commercial-facts` admin-only

- [ ] **Step 1: Write API contract tests** including RBAC and `company_id` isolation.
- [ ] **Step 2: Wire traceability services in `erp-runtime`** and expose them to server routers.
- [ ] **Step 3: Add router** with read access for manager/admin and rebuild restricted to admin.
- [ ] **Step 4: Register router** in `server/local-server.js`.
- [ ] **Step 5: Add `js/domains/traceability/**/*` to Electron build files** in `package.json` so packaged app includes the new domain.
- [ ] **Step 6: Run** API tests, `npm run boundary:check`, `npm run electron:compat`; PASS.
- [ ] **Step 7: Commit** `feat: expose traceability and performance APIs`.

### Task 11: UI de rastreabilidade, performance e relatório consolidado

**Files:**
- Create: `frontend/src/pages/TraceabilityPage.tsx`
- Modify: `frontend/src/app/navigation.ts`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/pages/ReportsPage.tsx`
- Modify: `frontend/src/pages/IntelligencePage.tsx`
- Test: `qa/e2e/traceability-flow.test.js`

**Interfaces:**
- New `ViewId='rastreabilidade'`.
- Traceability page queries product timeline/performance and supports drill-down to source records.
- Reports page gains consolidated commercial report alongside existing purchase/inventory/financial reports.
- Intelligence page top products and margins use consolidated BI data.

- [ ] **Step 1: Write failing E2E navigation/assertion skeleton** for Rastreabilidade and commercial consolidated report.
- [ ] **Step 2: Add navigation entry** `Rastreabilidade` with subtitle `Origem, custo, margem e ciclo do produto`.
- [ ] **Step 3: Implement `TraceabilityPage`** with filters, KPI cards and chronological/source table; no raw JSON as final primary UX for the new page.
- [ ] **Step 4: Update `ReportsPage`** to load `/api/v1/reports/commercial` and render revenue, CMV, margin and channels.
- [ ] **Step 5: Update `IntelligencePage`** to display consolidated sales/margin and product performance drill-down links/actions.
- [ ] **Step 6: Run** `npm run frontend:check && npm run frontend:build`; PASS.
- [ ] **Step 7: Run** focused E2E; PASS.
- [ ] **Step 8: Commit** `feat: add traceability and margin UI`.

### Task 12: Backfill histórico e reconciliação

**Files:**
- Create: `js/domains/traceability/legacy-backfill-service.js`
- Modify: `js/core/erp-runtime.js`
- Modify: `server/routers/traceability-router.js`
- Test: `test/traceability-backfill.test.js`

**Interfaces:**
- `legacyBackfill.preview({companyId})`
- `legacyBackfill.run({companyId,idempotencyKey}, actor)`
- `legacyBackfill.reconciliation({companyId})`
- Proven purchase receipts use true origin; unprovable inventory becomes `source_type='LEGACY_UNATTRIBUTED'` with known movement cost only.

- [ ] **Step 1: Write failing fixture test** containing provable purchase movements and unprovable legacy movements.
- [ ] **Step 2: Implement preview** returning counts/quantities/cost values by `PROVABLE` vs `LEGACY_UNATTRIBUTED` without writing.
- [ ] **Step 3: Implement idempotent run** that never invents supplier, purchase order or quote IDs.
- [ ] **Step 4: Implement reconciliation report** physical quantity vs ledger quantity before/after backfill.
- [ ] **Step 5: Add admin API** preview/run/reconciliation.
- [ ] **Step 6: Run** backfill tests; PASS.
- [ ] **Step 7: Commit** `feat: add safe historical traceability backfill`.

### Task 13: Health check, E2E ponta a ponta e release gates

**Files:**
- Modify: `js/core/observability/system-health.js`
- Create/Complete: `qa/e2e/traceability-flow.test.js`
- Modify: `qa/vertical-coverage.md`
- Modify: `release/customer-capabilities.json`
- Test: `qa/e2e/traceability-flow.test.js`

**Interfaces:**
- Health output gains traceability reconciliation status without leaking sensitive transaction details.
- Release capability adds traceability/product-margin capability only after E2E passes.

- [ ] **Step 1: Add health test** where deliberately mismatched layer balance is detected as degraded/inconsistent.
- [ ] **Step 2: Implement health integration** using `costLedger.reconcileProduct`/aggregate reconciliation with bounded diagnostic output.
- [ ] **Step 3: Complete main E2E**: product -> requisition -> quotation -> award -> PO -> receipt -> cost layer -> OS partial consumption -> admin sale -> PDV -> finance -> consolidated BI/DRE -> trace drill-down.
- [ ] **Step 4: E2E assertions**: physical final qty, layer/location remaining qty, AP/AR, settlements, revenue/CMV per channel, product margin, three lead times, supplier/quotation trail, no DRE double counting.
- [ ] **Step 5: Add additional automated scenarios** from spec: FIFO/FEFO, lot, serial, transfer, partial returns, supplier return, manufacturing multi-source, scrap, finished-product sale, explicit-cost adjustment, missing-cost rejection, retry, reversal, multi-company isolation.
- [ ] **Step 6: Update vertical coverage** only for capabilities with domain + persistence + API + UI + E2E + negative coverage.
- [ ] **Step 7: Update customer capability manifest** after verification.
- [ ] **Step 8: Run full verification**:
  - `npm run verify`
  - `npm test`
  - `npm run e2e`
  - `npm run coverage`
  - `npm run qa:full`
- [ ] **Step 9: Run release gate** `npm run release:check`; must PASS before completion claim.
- [ ] **Step 10: Commit** `test: verify end-to-end product traceability`.

---

## Ordem de execução e dependências

1. Tasks 1-2 establish the ledger contract.
2. Task 3 creates purchase-origin layers; Tasks 4-7 consume/reverse them.
3. Task 8 depends on commercial facts from Tasks 4-5.
4. Task 9 depends on ledger + facts + procurement provenance.
5. Task 10 exposes stable backend interfaces only after domain contracts are tested.
6. Task 11 builds UI on those stable APIs.
7. Task 12 migrates historical data after new writes are correct.
8. Task 13 proves all flows together and updates release claims last.

## Definition of Done

- Uma venda/consumo consegue fazer drill-down até as camadas de custo e, quando existente, fornecedor/cotação/pedido/recebimento.
- Vendas administrativas, PDV e OS entram na mesma visão comercial com receita, CMV e margem reproduzíveis.
- Produção transfere custo realizado dos componentes para o produto acabado sem inventar valor de refugo.
- Transferências preservam `layer_id`; devoluções revertem origem e fatos sem apagar histórico.
- DRE não duplica receita com `financial_entries` dos canais comerciais.
- Lead times e margens por produto/fornecedor são reproduzíveis por drill-down.
- Backfill não inventa origem e é idempotente.
- Health check detecta divergência físico x ledger.
- `npm run release:check` passa com os novos fluxos e capacidades declaradas.