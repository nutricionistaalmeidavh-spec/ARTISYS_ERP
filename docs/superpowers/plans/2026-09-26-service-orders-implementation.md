# Service Orders Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir a infraestrutura de Ativos / Ordens de Serviço já existente para um fluxo operacional completo de serviços sem duplicar entidades incorporadas à `main`.

**Architecture:** Reutilizar `assets`, `service_orders`, manutenção, operações genéricas, pricing, documentos e BI existentes. Adicionar apenas extensões aditivas de schema, um serviço compartilhado de reservas de estoque e um domínio focado em ciclo operacional/comercial da OS, mantendo compatibilidade com `/api/v1/ops/service-orders`.

**Tech Stack:** Node.js 22, CommonJS, SQLite nativo, React + TypeScript + Vite, Electron, Node test runner, Playwright Electron.

**Spec:** `docs/superpowers/specs/2026-09-26-service-orders-design.md`

## Global Constraints

- Base funcional: `main` em `c0af43356be0cebe2b51abecd6a62c68907fbec0` ou descendente compatível.
- Não recriar `assets`, `service_orders`, manutenção, filiais, workflows, aprovações, alertas, notificações, tabelas de preço, BI, documentos ou impressão/PDF.
- Reutilizar `products` com `product_type='SERVICE'` para catálogo de serviços.
- Preservar compatibilidade com `/api/v1/ops/assets`, `/api/v1/ops/service-orders` e manutenção atual.
- Fiscal Core NF-e/NFC-e permanece inalterado; não implementar NFS-e.
- Toda escrita deve respeitar `company_id` do ator autenticado.
- A implementação deve ser aditiva e compatível com bases existentes.

## Review Focus

- OS criada antes da migration deve continuar legível e editável após upgrade.
- Aprovação com estoque parcial não pode deixar reserva inconsistente nem permitir início indevido.
- Consumo concorrente não pode levar estoque abaixo de zero nem consumir acima da reserva.
- Conclusão repetida não pode criar segundo recebível nem alterar valores já concluídos.
- IDs de outra empresa devem se comportar como inexistentes, sem vazamento de dados.

---

### Task 1: Extensão aditiva de schema e catálogo `SERVICE`

**Files:**
- Create: `js/core/database/migrations/140-shared-operations-extension.js`
- Modify: `js/core/database/migrations/index.js`
- Modify: `js/domains/sales-admin/retail-operations-service.js`
- Test: `test/service-orders-schema.test.js`

**Interfaces:**
- Consumes: tabelas `products`, `assets`, `service_orders`, `inventory_reservations` existentes.
- Produces: `products.product_type='SERVICE'`, `assets.customer_id`, campos operacionais aditivos em `service_orders`, `inventory_reservations.consumed_quantity`.

- [ ] **Step 1: Write the failing schema/upgrade tests**
  - Assert migration preserva OS/asset antigos.
  - Assert `SERVICE` é aceito como `product_type` e exige `trackStock=false` no serviço de catálogo avançado.
  - Assert os novos campos começam com defaults compatíveis.
- [ ] **Step 2: Run the focused tests**
  - Run: `node --test test/service-orders-schema.test.js`
  - Expected: FAIL antes da migration/validação.
- [ ] **Step 3: Implement migration 140 and `SERVICE` validation**
  - Migration deve apenas `ALTER`/criar índices aditivos; nenhuma tabela paralela de OS/asset/serviço.
  - Atualizar lista válida de `product_type` para incluir `SERVICE`; rejeitar `SERVICE` com controle de estoque.
- [ ] **Step 4: Run focused + upgrade tests**
  - Run: `node --test test/service-orders-schema.test.js test/database-upgrade.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: extend existing service order schema"`

### Task 2: Serviço genérico de reservas de estoque

**Files:**
- Create: `js/domains/inventory/inventory-reservation-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/inventory-reservation-service.test.js`

**Interfaces:**
- Consumes: `inventory.getBalance(productId, locationId)`, tabela `inventory_reservations`, `inventory.move(...)`.
- Produces: `getAvailable(productId, locationId)`, `reserve(input, actor)`, `consume(reservationId, quantity, movementContext, actor)`, `release(reservationId, actor)`, `getReservation(id)`, `listReservations(filters)`.

- [ ] **Step 1: Write failing reservation tests**
  - Cobrir disponibilidade líquida, reserva ativa, consumo parcial/total, release, concorrência por saldo e compatibilidade com reservas já existentes de vendas.
- [ ] **Step 2: Run focused tests**
  - Run: `node --test test/inventory-reservation-service.test.js`
  - Expected: FAIL por serviço ausente.
- [ ] **Step 3: Implement the reservation service and runtime wiring**
  - Consumo deve atualizar reserva e movimento no mesmo `withTransaction`.
  - `available = physical - activeRemaining` para todas as reservas ativas, inclusive de vendas.
- [ ] **Step 4: Run inventory regression suite**
  - Run: `node --test test/inventory-reservation-service.test.js test/inventory-operations.test.js test/sales-admin.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: add shared inventory reservation service"`

### Task 3: Domínio operacional de Ordens de Serviço

**Files:**
- Create: `js/domains/services/service-order-service.js`
- Modify: `js/core/operations-suite.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/service-order-service.test.js`

**Interfaces:**
- Consumes: `contacts`, `catalog`, `inventoryReservations`, `finance`, `operations` assets/service_orders, audit.
- Produces: `createOrEnrich`, `updateOpen`, `addLine`, `removeLine`, `approve`, `retryParts`, `start`, `consumePart`, `complete`, `cancel`, `get`, `list`.

- [ ] **Step 1: Write failing lifecycle tests**
  - Cobrir `OPEN -> APPROVED/WAITING_PARTS -> IN_PROGRESS -> COMPLETED`, cancelamento, bloqueio de edição comercial após aprovação e isolamento multiempresa.
  - Testar que linhas `SERVICE` não reservam estoque e linhas `PART` reservam.
- [ ] **Step 2: Run focused test**
  - Run: `node --test test/service-order-service.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement lifecycle against existing `service_orders`**
  - Não criar segundo cabeçalho de OS.
  - Manter `history_json` atual e complementar com `writeAudit`.
- [ ] **Step 4: Run focused tests**
  - Run: `node --test test/service-order-service.test.js test/erp-utilities-p0-p2.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: complete service order lifecycle"`

### Task 4: Linhas, custos e financeiro da OS

**Files:**
- Create: `js/core/database/migrations/141-service-orders-operational.js`
- Modify: `js/core/database/migrations/index.js`
- Modify: `js/domains/services/service-order-service.js`
- Test: `test/service-order-finance.test.js`

**Interfaces:**
- Consumes: `finance.createEntry(...)`, pricing/catalog snapshots, reservas.
- Produces: `service_order_lines`, totais de serviço/peças/OS e recebível idempotente por conclusão.

- [ ] **Step 1: Write failing financial/line tests**
  - Assert snapshot de descrição/preço, totais, peça não consumida não cobrada sem ajuste explícito, recebível único e vencimento correto.
- [ ] **Step 2: Run focused tests**
  - Run: `node --test test/service-order-finance.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement migration 141 and completion transaction**
  - Conclusão + release de saldo + recebível + status devem ser atômicos.
  - Repetição da mesma completion key retorna o resultado existente.
- [ ] **Step 4: Run finance regressions**
  - Run: `node --test test/service-order-finance.test.js test/finance*.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: integrate service orders with finance"`

### Task 5: API compatível e extensões de `/api/v1/ops/service-orders`

**Files:**
- Modify: `server/routers/operations-router.js`
- Test: `test/service-orders-api.test.js`

**Interfaces:**
- Consumes: runtime `serviceOrders` e endpoints existentes de assets/OS.
- Produces: rotas detalhadas de leitura/edição/aprovação/retry/start/consumo/conclusão/cancelamento sem quebrar GET/POST/status atuais.

- [ ] **Step 1: Write failing API contract tests**
  - Cobrir RBAC, company isolation, erros de estado, idempotência e compatibilidade dos endpoints atuais.
- [ ] **Step 2: Run API tests**
  - Run: `node --test test/service-orders-api.test.js`
  - Expected: FAIL.
- [ ] **Step 3: Extend the operations router**
  - Preferir manter prefixo existente `/api/v1/ops/service-orders` para evitar duas APIs concorrentes.
- [ ] **Step 4: Run API + router regressions**
  - Run: `node --test test/service-orders-api.test.js test/*api*.test.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: expose complete service order API"`

### Task 6: UI de Serviços reutilizando Gestão Avançada

**Files:**
- Create: `frontend/src/pages/ServiceOrdersPage.tsx`
- Modify: `frontend/src/pages/IntelligencePage.tsx`
- Modify: `frontend/src/app/navigation.ts`
- Modify: `frontend/src/app/App.tsx`
- Test: `test/e2e/service-orders.spec.js`

**Interfaces:**
- Consumes: API de OS e componentes/layout React existentes.
- Produces: fluxo usuário para lista, abertura, orçamento, reserva/falta, execução, consumo, conclusão e impressão/PDF.

- [ ] **Step 1: Write failing Electron E2E**
  - Fluxo: criar `SERVICE`, abrir OS, adicionar serviço+peça, aprovar, iniciar, consumir, concluir, confirmar recebível e PDF.
  - Incluir cenário `WAITING_PARTS` e retry.
- [ ] **Step 2: Run focused E2E**
  - Run: `npx playwright test test/e2e/service-orders.spec.js`
  - Expected: FAIL.
- [ ] **Step 3: Implement `ServiceOrdersPage` and navigation**
  - Usar textos em português; sem JSON cru como UI principal.
  - Reutilizar infraestrutura de impressão/PDF do `document-bridge`.
- [ ] **Step 4: Run frontend and E2E**
  - Run: `npm run frontend:check && npm run frontend:build && npx playwright test test/e2e/service-orders.spec.js`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: add operational service orders UI"`

### Task 7: Integração, documentação e gates de release da OS

**Files:**
- Modify: `release/customer-capabilities.json`
- Modify: `docs/operations.md` if operational guidance is needed
- Test: existing full suites

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: capacidade declarada e branch com todos os gates verdes.

- [ ] **Step 1: Add capability contract assertions**
  - Atualizar/estender teste de capabilities para declarar Serviços/OS apenas quando fluxo completo estiver disponível.
- [ ] **Step 2: Run full Node verification**
  - Run: `npm run verify && npm run coverage`
  - Expected: PASS with configured coverage thresholds.
- [ ] **Step 3: Run full Electron E2E**
  - Run: comando E2E usado pelo workflow `ERP Verify`.
  - Expected: all tests PASS.
- [ ] **Step 4: Run Windows release gate**
  - Run: `npm run release:check && npm run dist:win`
  - Expected: installer generated and validation PASS.
- [ ] **Step 5: Commit**
  - `git commit -m "docs: publish service orders capability"`
