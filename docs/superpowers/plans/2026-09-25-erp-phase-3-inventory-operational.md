# ArtiSys ERP Phase 3 — Inventory Operational Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar estoque operacional no desktop com saldos, ajustes, transferências, reservas e histórico íntegro, preservando movimentações append-only.

**Architecture:** `inventory-service` continua sendo o livro de movimentos. Operações compostas entram em `inventory-operations-service.js`, que cria uma identidade/idempotency key e executa todas as movimentações da operação na mesma transação. Reservas continuam em `inventory-logistics-service`. O EventBus publica apenas depois de a transação confirmar.

**Tech Stack:** Node.js 22+, SQLite, CommonJS, Electron, Playwright, ArtiSys EventBus.

**Spec:** `docs/superpowers/specs/2026-09-25-artisys-erp-operational-core-design.md`

## Global Constraints

- Executar depois das Phases 1 e 2.
- Movimentos existentes nunca são editados ou apagados.
- Transferência deve ser atômica: nenhuma saída sem entrada correspondente.
- Produto com controle de estoque não pode ficar negativo.
- Disponível = saldo físico - reservas ativas.
- UI não usa diálogos web; todas as confirmações são modais próprios.
- Eventos não substituem consistência transacional.

## Review Focus

1. Transferência para o mesmo local deve ser rejeitada antes de qualquer movimento.
2. Retry com a mesma idempotency key não deve duplicar ajuste/transferência.
3. Estoque insuficiente deve deixar origem e destino intactos.
4. Quantidade reservada deve reduzir disponível sem reduzir saldo físico até consumo.
5. Movimento compensatório deve referenciar a operação original e preservar histórico.

---

### Task 1: Criar registro de operações de estoque idempotentes

**Files:**
- Create: `js/core/database/migrations/070-inventory-operations.js`
- Modify: `js/core/database/migrations/index.js`
- Test: `test/master-data-inventory.test.js`

**Interfaces:**
- Produces table `inventory_operations(id,idempotency_key,type,product_id,from_location_id,to_location_id,quantity,reason,created_by,created_at)`.

- [ ] **Step 1: Write failing migration test**

```js
const table = runtime.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_operations'").get();
assert.equal(table.name, 'inventory_operations');
```

- [ ] **Step 2: Run RED**

Run: `node --test test/master-data-inventory.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement migration**

Create schema with `idempotency_key TEXT NOT NULL UNIQUE`, `type CHECK(type IN ('ADJUST_IN','ADJUST_OUT','TRANSFER','REVERSAL'))`, foreign keys to product/location where supported by current schema conventions, and indexes for product/date.

Register `070-inventory-operations` after `060-eventbus`.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/master-data-inventory.test.js test/database-foundation.test.js`
Expected: PASS.

```bash
git add js/core/database/migrations test/master-data-inventory.test.js
git commit -m "feat: add inventory operation ledger"
```

### Task 2: Implementar ajustes e transferência atômica

**Files:**
- Create: `js/domains/inventory/inventory-operations-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/inventory-operations.test.js`

**Interfaces:**
- Produces:
  - `adjust({idempotencyKey,productId,locationId,quantity,direction,reason},actor)`
  - `transfer({idempotencyKey,productId,fromLocationId,toLocationId,quantity,reason},actor)`
  - `reverse(operationId,{idempotencyKey,reason},actor)`
  - `getOperation(id)`
  - `listOperations(filters)`

- [ ] **Step 1: Write failing transfer tests**

```js
test('transfer is atomic and idempotent', () => {
  runtime.inventory.move({ productId:p.id, locationId:a.id, delta:10, sourceType:'seed', sourceId:'seed-1' }, manager);
  const first = runtime.inventoryOperations.transfer({ idempotencyKey:'tx-1', productId:p.id, fromLocationId:a.id, toLocationId:b.id, quantity:4, reason:'reposicao' }, manager);
  const retry = runtime.inventoryOperations.transfer({ idempotencyKey:'tx-1', productId:p.id, fromLocationId:a.id, toLocationId:b.id, quantity:4, reason:'reposicao' }, manager);
  assert.equal(first.id, retry.id);
  assert.equal(runtime.inventory.getBalance(p.id,a.id),6);
  assert.equal(runtime.inventory.getBalance(p.id,b.id),4);
});
```

Also test insufficient stock leaves both balances unchanged and same-location transfer is rejected.

- [ ] **Step 2: Run RED**

Run: `node --test test/inventory-operations.test.js`
Expected: FAIL because service is missing.

- [ ] **Step 3: Implement service using `withTransaction`**

```js
return withTransaction(db, () => {
  const existing = byKey(input.idempotencyKey);
  if (existing) return existing;
  if (input.fromLocationId === input.toLocationId) throw new Error('Origem e destino devem ser diferentes.');
  const qty = positiveQuantity(input.quantity, 'Quantidade');
  inventory.move({ productId, locationId: from, delta: -qty, sourceType:'inventory-transfer', sourceId:id }, actor);
  inventory.move({ productId, locationId: to, delta: qty, sourceType:'inventory-transfer', sourceId:id }, actor);
  insertOperation({id,idempotencyKey:input.idempotencyKey,type:'TRANSFER',productId,fromLocationId:from,toLocationId:to,quantity:qty,reason:input.reason,actor});
  events.outbox.insert(events.create('inventory.stock.changed','inventory-operation',id,{productId,fromLocationId:from,toLocationId:to,quantity:qty},actor,input.idempotencyKey));
  return getOperation(id);
});
```

The outbox insert is inside the same transaction. Dispatch only after the outer service returns successfully; expose a concrete `runtime.events.dispatchPending()` call from the request boundary after a successful mutation. Dispatcher failures are logged and retried later; they never undo committed business data.

- [ ] **Step 4: Implement adjustment and reversal as new movements**

`ADJUST_OUT` must use negative delta and obey stock availability. `reverse()` creates a new `REVERSAL` operation and inverse movement(s); it never deletes original rows.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test test/inventory-operations.test.js test/master-data-inventory.test.js`
Expected: PASS.

```bash
git add js/domains/inventory/inventory-operations-service.js js/core/erp-runtime.js test/inventory-operations.test.js
git commit -m "feat: add atomic inventory adjustments and transfers"
```

### Task 3: Completar API operacional de estoque

**Files:**
- Modify: `js/domains/inventory/inventory-service.js`
- Modify: `server/routers/inventory-router.js`
- Test: `test/api-contract.test.js`
- Test: `test/inventory-operations.test.js`

**Interfaces:**
- Produces:
  - `inventory.listBalances({productId,locationId}) -> [{productId,locationId,balance}]`
  - `GET /api/v1/inventory/balances?productId=&locationId=` returning `{productId,locationId,balance,reserved,available}` rows
  - `GET /api/v1/inventory/operations`
  - `POST /api/v1/inventory/adjustments`
  - `POST /api/v1/inventory/transfers`
  - `POST /api/v1/inventory/operations/:id/reverse`
  - `GET /api/v1/inventory/reservations`
  - existing reservation create/release/consume remain compatible.

- [ ] **Step 1: Write failing API tests**

Authenticate as manager and test an adjustment, transfer, retry by same key, list operations and viewer `403` on POST.

- [ ] **Step 2: Run RED**

Run: `node --test test/api-contract.test.js`
Expected: FAIL on new routes.

- [ ] **Step 3: Add physical balance aggregation to the inventory domain**

```js
function listBalances({ productId = null, locationId = null } = {}) {
  const clauses = [], params = [];
  if (productId) { clauses.push('product_id=?'); params.push(String(productId)); }
  if (locationId) { clauses.push('location_id=?'); params.push(String(locationId)); }
  return db.prepare(`SELECT product_id productId,location_id locationId,COALESCE(SUM(delta_qty),0) balance FROM inventory_movements${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} GROUP BY product_id,location_id ORDER BY product_id,location_id`)
    .all(...params)
    .map(row => ({ ...row, balance: Number(row.balance) }));
}
```

Export `listBalances` from `inventory-service.js`.

- [ ] **Step 4: Add routes using domain services only**

For `GET /balances`, combine services at the request boundary without circular domain dependencies:

```js
const rows = runtime.inventory.listBalances({productId:url.searchParams.get('productId'),locationId:url.searchParams.get('locationId')});
json(res,200,rows.map(row => {
  const available = runtime.inventoryLogistics.getAvailable(row.productId,row.locationId);
  return {...row,reserved:row.balance-available,available};
}));
```

Mutation endpoints call `runtime.inventoryOperations`; reservation list calls `runtime.inventoryLogistics.listReservations`.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test test/api-contract.test.js test/inventory-operations.test.js`
Expected: PASS.

```bash
git add server/routers/inventory-router.js js/domains/inventory/inventory-service.js test/api-contract.test.js
git commit -m "feat: expose operational inventory API"
```

### Task 4: Criar view operacional de estoque

**Files:**
- Create: `desktop/renderer/views/estoque.js`
- Modify: `desktop/renderer/index.html`
- Modify: `desktop/renderer/app.js`
- Modify: `desktop/renderer/styles.css`
- Test: `qa/e2e/inventory.spec.js`

**Interfaces:**
- Produces `window.ErpViews.estoque({api,root})`.

- [ ] **Step 1: Write failing E2E**

Flow:
1. login;
2. open Estoque;
3. choose product/local;
4. register +10 adjustment with reason;
5. verify balance;
6. transfer 3 to second location;
7. verify `7` origin / `3` destination;
8. open movement history and see both transfer legs;
9. retry/navigation refresh and verify no duplicate;
10. assert zero web dialogs.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/inventory.spec.js --reporter=line`
Expected: FAIL.

- [ ] **Step 3: Implement balances/operations UI**

Required test ids:

```text
inventory-product-filter
inventory-location-filter
inventory-adjust
inventory-transfer
inventory-adjust-quantity
inventory-adjust-reason
inventory-transfer-from
inventory-transfer-to
inventory-transfer-quantity
inventory-operation-save
inventory-balance-<product>-<location>
inventory-history
```

Use UUID-generated idempotency keys in renderer per submitted operation and keep the same key if the UI retries the same failed HTTP request until response status is known.

- [ ] **Step 4: Show reservation data**

Add physical balance, reserved quantity and available quantity separately. Never label available stock as physical stock.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm run electron:compat && npx playwright test qa/e2e/inventory.spec.js --reporter=line && npm run verify`
Expected: PASS.

```bash
git add desktop/renderer qa/e2e/inventory.spec.js
git commit -m "feat: make inventory operational in desktop"
```

### Task 5: Phase 3 verification

- [ ] **Step 1:** `npm run verify` — PASS.
- [ ] **Step 2:** `npm run e2e:smoke` — PASS.
- [ ] **Step 3:** `npx playwright test qa/e2e/master-data.spec.js qa/e2e/inventory.spec.js --reporter=line` — PASS.
- [ ] **Step 4:** Reopen Electron against the same temporary DB in an E2E case and verify balances persist.
- [ ] **Step 5:** `npm run release:check` — PASS.
