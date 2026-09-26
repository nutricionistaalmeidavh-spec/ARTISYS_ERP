# Manufacturing PCP-MRP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar PCP/MRP operacional ao ArtiSys ERP reutilizando BOM, estoque, reservas, compras, filiais, BI, alertas e demais infraestruturas já existentes.

**Architecture:** Criar um domínio novo de Produção com ordens, componentes snapshotados, consumos, perdas, apontamentos, custos e cálculo MRP. O domínio depende do serviço genérico de reservas entregue pelo plano de OS e nunca recria catálogo, BOM, compras, BI ou fiscal.

**Tech Stack:** Node.js 22, CommonJS, SQLite nativo, React + TypeScript + Vite, Electron, Node test runner, Playwright Electron.

**Spec:** `docs/superpowers/specs/2026-09-26-manufacturing-pcp-mrp-design.md`

## Global Constraints

- Prerequisite: plano `2026-09-26-service-orders-implementation.md` concluído ao menos até o serviço compartilhado `inventory-reservation-service.js`.
- Não recriar catálogo, BOM, estoque, reservas, compras, filiais, alertas, notificações, workflows, aprovações, BI, projetos, documentos, financeiro ou Fiscal Core.
- Reutilizar `product_boms` e `product_bom_items` como fonte; OP armazena snapshot próprio.
- Reutilizar `procurementRequisitions.createRequisition` para faltas; nunca criar pedido de compra direto pelo MRP.
- Produção não gera lançamento financeiro por conclusão.
- Toda escrita deve respeitar `company_id` do ator autenticado.
- Migration nova deve começar em `150-manufacturing.js` ou número posterior livre compatível com a `main` no momento da implementação.

## Review Focus

- Alteração posterior da BOM não pode mudar componentes de uma OP já criada sem `refresh-bom` explícito.
- Material já reservado por uma OP não pode ser contado novamente como necessidade de compra no MRP.
- Consumo/perda concorrente não pode gerar estoque negativo ou custo duplicado.
- Apontamento de saída não pode exceder planejado sem flag explícita e papel `admin`/`manager`.
- Cancelamento de OP em andamento deve preservar consumos/outputs realizados e apenas liberar reserva remanescente.

---

### Task 1: Schema de Produção e snapshot de BOM

**Files:**
- Create: `js/core/database/migrations/150-manufacturing.js`
- Modify: `js/core/database/migrations/index.js`
- Create: `js/domains/manufacturing/manufacturing-service.js`
- Test: `test/manufacturing-schema.test.js`

**Interfaces:**
- Consumes: `product_boms`, `product_bom_items`, `products`, `company_branches`, locations.
- Produces: `manufacturing_orders`, `manufacturing_order_components`, `manufacturing_outputs`, `manufacturing_losses`, `manufacturing_cost_entries`, `manufacturing_procurement_links`; métodos `createOrder`, `getOrder`, `listOrders`, `updatePlanned`, `refreshBom`.

- [ ] **Step 1: Write failing schema/order creation tests**
  - Assert criação exige BOM ativa ou produto `MANUFACTURED` com BOM.
  - Assert componentes, versão e custos planejados são snapshotados.
  - Assert edição posterior da BOM não altera OP existente.
- [ ] **Step 2: Run focused tests**
  - Run: `node --test test/manufacturing-schema.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement migration 150 and planning methods**
  - `requiredQuantity = quantityPerUnit * plannedQuantity`.
  - `refreshBom` permitido somente em `PLANNED`.
- [ ] **Step 4: Run upgrade + focused tests**
  - Run: `node --test test/manufacturing-schema.test.js test/database-upgrade.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: add manufacturing order model"`

### Task 2: Liberação da OP e reservas atômicas

**Files:**
- Modify: `js/domains/manufacturing/manufacturing-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/manufacturing-reservations.test.js`

**Interfaces:**
- Consumes: `inventoryReservations.getAvailable/reserve/release`, `inventory`, components snapshot.
- Produces: `shortages(orderId, actor)`, `release(orderId, actor)`, `start(orderId, actor)` e `materialStatus` derivado.

- [ ] **Step 1: Write failing release tests**
  - Cobrir estoque suficiente, falta parcial, all-or-nothing na liberação, retry após reposição e isolamento multiempresa.
- [ ] **Step 2: Run focused tests**
  - Run: `node --test test/manufacturing-reservations.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement release/start**
  - Falta mantém `PLANNED` e retorna itens estruturados.
  - Sucesso reserva todos e muda para `RELEASED`; `start` faz `RELEASED -> IN_PROGRESS`.
- [ ] **Step 4: Run reservation regressions**
  - Run: `node --test test/manufacturing-reservations.test.js test/inventory-reservation-service.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: reserve materials for manufacturing"`

### Task 3: Consumo, perdas e apontamento de produto acabado

**Files:**
- Modify: `js/domains/manufacturing/manufacturing-service.js`
- Test: `test/manufacturing-execution.test.js`

**Interfaces:**
- Consumes: reservations, `inventory.move`, products costs.
- Produces: `consumeComponent`, `reportLoss`, `reportOutput`.

- [ ] **Step 1: Write failing execution tests**
  - Cobrir consumo parcial/total, excesso de consumo bloqueado, perda COMPONENT, refugo OUTPUT, output parcial, overproduction bloqueada e override manager/admin.
- [ ] **Step 2: Run focused tests**
  - Run: `node --test test/manufacturing-execution.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement physical execution**
  - Usar `source_type='manufacturing-consumption'`, `'manufacturing-loss'`, `'manufacturing-output'`.
  - Movimentos e registros de execução devem ser atômicos.
- [ ] **Step 4: Run execution + inventory tests**
  - Run: `node --test test/manufacturing-execution.test.js test/inventory-operations.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: execute manufacturing orders"`

### Task 4: Custos realizados e conclusão/cancelamento

**Files:**
- Modify: `js/domains/manufacturing/manufacturing-service.js`
- Test: `test/manufacturing-costs.test.js`

**Interfaces:**
- Consumes: movimentos/outputs/losses da OP.
- Produces: `addCost(orderId, input, actor)`, `complete(orderId, actor)`, `cancel(orderId, input, actor)`, cálculos planned/actual.

- [ ] **Step 1: Write failing cost/finalization tests**
  - Cobrir LABOR/OVERHEAD/OTHER, material real, custo final por unidade boa, absorção de refugo, conclusão apenas com `completed + scrap == planned` e cancelamento em cada estado.
- [ ] **Step 2: Run focused tests**
  - Run: `node --test test/manufacturing-costs.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement cost and final state transitions**
  - Conclusão libera reserva remanescente e não cria financeiro.
  - Cancelamento `IN_PROGRESS` exige admin/manager e preserva movimentos já realizados.
- [ ] **Step 4: Run focused suite**
  - Run: `node --test test/manufacturing-costs.test.js test/manufacturing-execution.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: finalize manufacturing costs and orders"`

### Task 5: Motor MRP e necessidade líquida

**Files:**
- Create: `js/domains/manufacturing/mrp-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/mrp-service.test.js`

**Interfaces:**
- Consumes: physical balances, active reservation remaining, open manufacturing components, `minStock`, `targetStock`, procurement links.
- Produces: `calculate({companyId, locationId?}, actor)` retornando por produto `physical`, `reserved`, `availableUnreserved`, `productionDemand`, `minStock`, `targetStock`, `linkedRequisitionQuantity`, `netRequirement`, `causingOrders`.

- [ ] **Step 1: Write failing MRP tests**
  - Cobrir saldo livre, reserva de outra demanda, componente já reservado pela própria OP, múltiplas OPs, estoque mínimo/alvo e requisição já vinculada.
- [ ] **Step 2: Run focused tests**
  - Run: `node --test test/mrp-service.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement deterministic MRP calculation**
  - Para `RELEASED/IN_PROGRESS`, descontar demanda já coberta pela reserva da própria OP para não comprar duas vezes.
  - Necessidade final nunca pode ser negativa.
- [ ] **Step 4: Run focused tests**
  - Run: `node --test test/mrp-service.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: add manufacturing MRP engine"`

### Task 6: Requisição de compra a partir de faltas/MRP

**Files:**
- Modify: `js/domains/manufacturing/mrp-service.js`
- Modify: `js/domains/manufacturing/manufacturing-service.js`
- Test: `test/manufacturing-procurement.test.js`

**Interfaces:**
- Consumes: `procurementRequisitions.createRequisition(input, actor)`.
- Produces: `generateShortageRequisition(orderId, actor)`, `generateMrpRequisition(input, actor)` e links idempotentes em `manufacturing_procurement_links`.

- [ ] **Step 1: Write failing procurement integration tests**
  - Cobrir agrupamento por local, justificativa, somente necessidade positiva, source key determinística e repetição sem duplicar requisição.
- [ ] **Step 2: Run focused tests**
  - Run: `node --test test/manufacturing-procurement.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement requisition generation**
  - Criar apenas requisição `DRAFT`; fluxo de cotação/aprovação continua no domínio atual de compras.
- [ ] **Step 4: Run procurement regressions**
  - Run: `node --test test/manufacturing-procurement.test.js test/procurement*.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: connect MRP shortages to procurement"`

### Task 7: API de Produção e contratos RBAC/multiempresa

**Files:**
- Create: `server/routers/manufacturing-router.js`
- Modify: `server/local-server.js`
- Test: `test/manufacturing-api.test.js`

**Interfaces:**
- Consumes: `runtime.manufacturing`, `runtime.mrp`, sessions/router utilities.
- Produces: `/api/v1/manufacturing/orders/*` e `/api/v1/manufacturing/mrp/*` conforme spec.

- [ ] **Step 1: Write failing API contract tests**
  - Cobrir create/get/list/update, refresh BOM, release/start/consume/loss/output/cost/complete/cancel, shortages e MRP/requisition.
  - Cobrir operador versus manager/admin e cross-company IDs.
- [ ] **Step 2: Run focused API tests**
  - Run: `node --test test/manufacturing-api.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement router and registration**
  - Usar helpers existentes `requireActor`, `pathMatch`, `body`, `asHttpError`.
- [ ] **Step 4: Run API regressions**
  - Run: `node --test test/manufacturing-api.test.js test/*api*.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: expose manufacturing API"`

### Task 8: UI PCP/MRP e integração com BI/alertas existentes

**Files:**
- Create: `frontend/src/pages/ManufacturingPage.tsx`
- Modify: `frontend/src/app/navigation.ts`
- Modify: `frontend/src/app/App.tsx`
- Modify: `js/domains/reports/business-intelligence-service.js`
- Test: `test/e2e/manufacturing.spec.js`
- Test: `test/business-intelligence-manufacturing.test.js`

**Interfaces:**
- Consumes: manufacturing/MRP API, BI existente, operações de alertas/notificações existentes.
- Produces: tela Produção, indicadores de OPs e necessidades no BI existente; nenhum segundo dashboard.

- [ ] **Step 1: Write failing BI + Electron E2E tests**
  - BI: OPs abertas, atrasadas, produção planejada/concluída e necessidades MRP.
  - E2E: criar OP, ver falta, gerar requisição, repor/ajustar fixture, liberar, consumir, apontar e concluir.
- [ ] **Step 2: Run focused tests**
  - Run: `node --test test/business-intelligence-manufacturing.test.js && npx playwright test test/e2e/manufacturing.spec.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement UI and BI extension**
  - Não expor JSON cru como interface principal.
  - Reutilizar alertas/notificações para atraso/falta quando aplicável; não criar tabelas paralelas.
- [ ] **Step 4: Run frontend + focused E2E**
  - Run: `npm run frontend:check && npm run frontend:build && npx playwright test test/e2e/manufacturing.spec.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: add manufacturing PCP MRP workspace"`

### Task 9: Capabilities e gates finais de Produção

**Files:**
- Modify: `release/customer-capabilities.json`
- Modify: `docs/operations.md` if necessary
- Test: full repository gates

**Interfaces:**
- Consumes: Tasks 1-8 and completed OS/shared-reservation prerequisite.
- Produces: capacidade de Produção declarada e branch pronta para revisão/merge.

- [ ] **Step 1: Extend capability contract tests**
  - Declarar Produção/PCP-MRP somente após OP + MRP + procurement integration + UI estarem funcionais.
- [ ] **Step 2: Run full Node verification**
  - Run: `npm run verify && npm run coverage`
  - Expected: PASS.
- [ ] **Step 3: Run complete Electron E2E**
  - Run: comando E2E do workflow `ERP Verify`.
  - Expected: all tests PASS.
- [ ] **Step 4: Run Windows release gate**
  - Run: `npm run release:check && npm run dist:win`
  - Expected: installer generated and validation PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "docs: publish manufacturing PCP MRP capability"`
