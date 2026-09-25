# ArtiSys ERP Phase 1 — Base Technical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o EventBus local-first, outbox SQLite, gates de compatibilidade Electron e uma base E2E real antes de expandir os fluxos operacionais.

**Architecture:** O ERP continua SQLite/local-first. `@artisys/eventbus` 0.2.0 será vendorizado e inicializado no `createErpRuntime()`. Mutações críticas permanecem na mesma transação SQLite; eventos entram na outbox na mesma transação e são despachados somente depois do commit. O renderer continua isolado de Node por preload e ganha um gate que proíbe diálogos web incompatíveis.

**Tech Stack:** Node.js 22+, CommonJS, SQLite, Electron 39, Playwright 1.63, `node:test`, `@artisys/eventbus` 0.2.0 vendorizado.

**Spec:** `docs/superpowers/specs/2026-09-25-artisys-erp-operational-core-design.md`

## Global Constraints

- Repositório alvo: `nutricionistaalmeidavh-spec/ARTISYS_ERP`.
- Branch de trabalho: derivada de `feat/erp-standalone`; não alterar `PDV-ARTISYS`.
- Core obrigatório com custo de infraestrutura R$ 0 e funcionamento local sem internet.
- SQLite é a fonte de verdade.
- `prompt()`, `window.prompt()`, `alert()`, `window.alert()`, `confirm()` e `window.confirm()` são proibidos no renderer.
- Nenhum Kafka, RabbitMQ, Redis, SaaS ou broker externo.
- Operações críticas de estoque/financeiro não podem depender de subscribers assíncronos para consistência.
- Cada tarefa termina com testes verdes e commit próprio.

## Review Focus

1. Evento gravado dentro de transação que sofre rollback não pode sobreviver na outbox — cobrir em `test/eventbus-runtime.test.js`.
2. Falha de subscriber não pode marcar evento como despachado — cobrir em `test/eventbus-runtime.test.js`.
3. Reinício do runtime deve encontrar e despachar evento pendente uma única vez — cobrir em `test/eventbus-runtime.test.js`.
4. Renderer contendo qualquer diálogo web proibido deve fazer `npm run verify` falhar — cobrir em `test/desktop-electron-compat.test.js`.
5. E2E deve usar banco temporário isolado e fechar Electron/servidor mesmo após falha — cobrir no helper `qa/e2e/fixtures/erp-electron.js`.

---

### Task 1: Vendorizar `@artisys/eventbus` 0.2.0 com proveniência

**Files:**
- Create: `vendor/artisys-eventbus/package.json`
- Create: `vendor/artisys-eventbus/LICENSE`
- Create: `vendor/artisys-eventbus/src/index.js`
- Create: `vendor/artisys-eventbus/src/domain-event.js`
- Create: `vendor/artisys-eventbus/src/event-bus.js`
- Create: `vendor/artisys-eventbus/src/dispatcher.js`
- Create: `vendor/artisys-eventbus/src/effect-runner.js`
- Create: `vendor/artisys-eventbus/src/adapters/memory-outbox.js`
- Create: `vendor/artisys-eventbus/src/adapters/memory-effect-store.js`
- Create: `vendor/artisys-eventbus/src/adapters/sqlite-outbox.js`
- Create: `vendor/artisys-eventbus/src/adapters/sqlite-effect-store.js`
- Create: `vendor/artisys-eventbus/src/adapters/sqlite-schema.js`
- Create: `vendor/artisys-eventbus/PROVENANCE.md`
- Modify: `package.json`
- Test: `test/eventbus-vendor.test.js`

**Interfaces:**
- Consumes: source `nutricionistaalmeidavh-spec/utilidades/modules/artisys-eventbus` version `0.2.0`.
- Produces: dependency `@artisys/eventbus: file:vendor/artisys-eventbus` exporting `createDomainEvent`, `DomainEventBus`, `DomainEventDispatcher`, `SqliteOutboxStore`, `SqliteEffectStore`, `IdempotentEffectRunner`, `SQLITE_SCHEMA`.

- [ ] **Step 1: Write the failing package contract test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('vendored eventbus exposes the desktop contract', () => {
  const eventbus = require('../vendor/artisys-eventbus/src');
  for (const key of ['createDomainEvent','DomainEventBus','DomainEventDispatcher','SqliteOutboxStore','SqliteEffectStore','IdempotentEffectRunner','SQLITE_SCHEMA']) {
    assert.ok(eventbus[key], `missing ${key}`);
  }
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/eventbus-vendor.test.js`
Expected: FAIL because `vendor/artisys-eventbus` does not exist.

- [ ] **Step 3: Copy only the Node/Electron core files from the approved module and pin provenance**

`PROVENANCE.md` must state source repo, source path, version `0.2.0`, source commit used, license, and that web/D1 adapters were intentionally excluded from the desktop core package.

Update `package.json`:

```json
"dependencies": {
  "@artisys/eventbus": "file:vendor/artisys-eventbus",
  "@artisys/finance-domain": "file:vendor/artisys-finance-domain"
}
```

Add `vendor/artisys-eventbus/**/*` to `build.files`.

- [ ] **Step 4: Run GREEN and license gate**

Run: `npm install && node --test test/eventbus-vendor.test.js && node scripts/check-licenses.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vendor/artisys-eventbus package.json package-lock.json test/eventbus-vendor.test.js
git commit -m "feat: vendor ArtiSys EventBus for ERP"
```

### Task 2: Persistir outbox/effects nas migrations do ERP

**Files:**
- Create: `js/core/database/migrations/060-eventbus.js`
- Modify: `js/core/database/migrations/index.js`
- Test: `test/eventbus-runtime.test.js`

**Interfaces:**
- Consumes: `SQLITE_SCHEMA` from `@artisys/eventbus`.
- Produces: tables `domain_events` and `domain_effects` available in every ERP database after migration.

- [ ] **Step 1: Write failing migration test**

```js
const { createErpRuntime } = require('../js/core/erp-runtime');

test('ERP creates durable eventbus tables', () => {
  const runtime = createErpRuntime();
  const names = runtime.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  assert.ok(names.includes('domain_events'));
  assert.ok(names.includes('domain_effects'));
  runtime.close();
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/eventbus-runtime.test.js`
Expected: FAIL because the tables are absent.

- [ ] **Step 3: Add migration 060**

```js
'use strict';
const { SQLITE_SCHEMA } = require('@artisys/eventbus');
module.exports = {
  id: '060-eventbus',
  up(db) { db.exec(SQLITE_SCHEMA); }
};
```

Register it after `050-finance-automation` in `migrations/index.js`.

- [ ] **Step 4: Run GREEN plus migration regression**

Run: `node --test test/eventbus-runtime.test.js test/database-foundation.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/core/database/migrations test/eventbus-runtime.test.js
git commit -m "feat: add durable ERP event outbox"
```

### Task 3: Integrar EventBus ao `createErpRuntime()`

**Files:**
- Create: `js/core/events/erp-events.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/eventbus-runtime.test.js`

**Interfaces:**
- Produces: `runtime.events.bus`, `runtime.events.outbox`, `runtime.events.effects`, `runtime.events.dispatcher`, `runtime.events.create(type, aggregate, aggregateId, payload, actor, mutationId)` and `runtime.events.dispatchPending()`.

- [ ] **Step 1: Extend failing runtime test**

```js
test('runtime exposes durable events and retries failed subscribers', async () => {
  const runtime = createErpRuntime();
  assert.equal(typeof runtime.events.create, 'function');
  assert.equal(typeof runtime.events.dispatchPending, 'function');
  let calls = 0;
  runtime.events.bus.subscribe('test.event', () => { calls += 1; if (calls === 1) throw new Error('boom'); });
  const event = runtime.events.create('test.event', 'test', '1', { ok: true }, { id: 'u1' });
  runtime.events.outbox.insert(event);
  const first = await runtime.events.dispatchPending();
  assert.equal(first.failed, 1);
  const second = await runtime.events.dispatchPending();
  assert.equal(second.dispatched, 1);
  assert.equal(calls, 2);
  runtime.close();
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/eventbus-runtime.test.js`
Expected: FAIL because `runtime.events` is undefined.

- [ ] **Step 3: Implement focused event runtime**

```js
const { randomUUID } = require('node:crypto');
const { createDomainEvent, DomainEventBus, DomainEventDispatcher, SqliteOutboxStore, SqliteEffectStore } = require('@artisys/eventbus');

function createErpEvents({ db, now }) {
  const bus = new DomainEventBus();
  const outbox = new SqliteOutboxStore(db);
  const effects = new SqliteEffectStore(db);
  const dispatcher = new DomainEventDispatcher({ bus, outbox });
  return {
    bus, outbox, effects, dispatcher,
    create(type, aggregate, aggregateId, payload = {}, actor = {}, mutationId = null) {
      return createDomainEvent({ eventId: randomUUID(), type, aggregate, aggregateId, mutationId, source: 'artisys-erp', actor: actor || {}, payload, occurredAt: now() });
    },
    dispatchPending: () => dispatcher.dispatchPending()
  };
}
```

Initialize `events` after migrations and pass it only to domains that need it in later phases.

- [ ] **Step 4: Add rollback durability test**

Insert an event inside `withTransaction(db, () => { outbox.insert(event); throw new Error('rollback'); })`, then assert `domain_events` contains zero rows.

- [ ] **Step 5: Run GREEN**

Run: `node --test test/eventbus-runtime.test.js test/erp-runtime.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/core/events js/core/erp-runtime.js test/eventbus-runtime.test.js
git commit -m "feat: wire EventBus into ERP runtime"
```

### Task 4: Bloquear APIs incompatíveis no renderer

**Files:**
- Create: `scripts/check-electron-renderer-compat.js`
- Modify: `package.json`
- Test: `test/desktop-electron-compat.test.js`

**Interfaces:**
- Produces: `npm run electron:compat` and inclusion in `npm run verify`.

- [ ] **Step 1: Write failing checker tests**

Create temporary renderer fixtures and assert the checker rejects `prompt('x')`, `window.alert('x')`, `confirm('x')` and `require('fs')`, while accepting normal DOM APIs.

- [ ] **Step 2: Run RED**

Run: `node --test test/desktop-electron-compat.test.js`
Expected: FAIL because checker is absent.

- [ ] **Step 3: Implement AST-free deterministic scanner**

The script must recursively scan `desktop/renderer/**/*.js` and fail on these explicit patterns:

```js
const forbidden = [
  /\b(?:window\s*\.\s*)?prompt\s*\(/,
  /\b(?:window\s*\.\s*)?alert\s*\(/,
  /\b(?:window\s*\.\s*)?confirm\s*\(/,
  /\brequire\s*\(/,
  /\bprocess\s*\./,
  /\b__dirname\b/,
  /\b__filename\b/
];
```

Skip comments only if the implementation can do so deterministically; otherwise document that source comments must not contain executable examples of forbidden calls.

Update scripts:

```json
"electron:compat": "node scripts/check-electron-renderer-compat.js",
"verify": "npm run boundary:check && npm run electron:compat && npm run lint && npm test"
```

- [ ] **Step 4: Run GREEN**

Run: `npm run electron:compat && node --test test/desktop-electron-compat.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-electron-renderer-compat.js package.json test/desktop-electron-compat.test.js
git commit -m "test: enforce Electron renderer compatibility"
```

### Task 5: Criar harness E2E Electron + Playwright

**Files:**
- Create: `qa/e2e/fixtures/erp-electron.js`
- Create: `qa/e2e/smoke.spec.js`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `launchErpElectron()` returning `{ app, page, dbPath, close }` and scripts `e2e` / `e2e:smoke`.

- [ ] **Step 1: Write smoke E2E**

```js
const { test, expect } = require('@playwright/test');
const { launchErpElectron } = require('./fixtures/erp-electron');

test('opens ERP, logs in and shows dashboard without web dialogs', async () => {
  const erp = await launchErpElectron();
  const dialogs = [];
  erp.page.on('dialog', d => dialogs.push(d.type()));
  await erp.page.getByTestId('login-email').fill('admin@artisys.local');
  await erp.page.getByTestId('login-password').fill('admin');
  await erp.page.getByTestId('login-submit').click();
  await expect(erp.page.getByTestId('view-dashboard')).toBeVisible();
  expect(dialogs).toEqual([]);
  await erp.close();
});
```

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/smoke.spec.js --reporter=line`
Expected: FAIL because fixture/test ids are absent.

- [ ] **Step 3: Implement isolated Electron fixture**

Use Playwright `_electron.launch` with a temporary directory and env vars:

```js
const { _electron } = require('playwright');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

async function launchErpElectron() {
  const dir = mkdtempSync(join(tmpdir(), 'artisys-erp-e2e-'));
  const dbPath = join(dir, 'erp.sqlite');
  const app = await _electron.launch({ args: ['.'], env: { ...process.env, ERP_DB_PATH: dbPath, ERP_E2E: '1' } });
  const page = await app.firstWindow();
  return { app, page, dbPath, async close() { await app.close(); rmSync(dir, { recursive: true, force: true }); } };
}
```

Use `try/finally` in every spec or a Playwright fixture wrapper so cleanup also occurs after assertion failure.

- [ ] **Step 4: Add stable test ids to existing login/dashboard controls**

Modify renderer HTML/JS only enough to expose `login-email`, `login-password`, `login-submit`, `view-dashboard`; do not redesign operational screens in this phase.

- [ ] **Step 5: Add scripts and run GREEN**

```json
"e2e": "playwright test qa/e2e --reporter=line",
"e2e:smoke": "playwright test qa/e2e/smoke.spec.js --reporter=line"
```

Run: `npm run e2e:smoke && npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add qa/e2e desktop/renderer package.json .gitignore
git commit -m "test: add real Electron Playwright smoke flow"
```

### Task 6: Phase 1 verification

**Files:**
- Modify only if verification exposes defects in files owned by Tasks 1–5.

- [ ] **Step 1: Run all local gates**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 2: Run real Electron smoke**

Run: `npm run e2e:smoke`
Expected: PASS with no dialogs.

- [ ] **Step 3: Run release contract smoke**

Run: `npm run release:check`
Expected: PASS.

- [ ] **Step 4: Commit verification-only fixes if any**

```bash
git status --short
git commit -am "fix: close phase 1 verification gaps"
```

Do not create an empty commit.
