# ArtiSys ERP Phase 1 — Base Technical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o EventBus local-first, outbox SQLite, gates de compatibilidade Electron e uma base E2E real antes de expandir os fluxos operacionais.

**Architecture:** O ERP continua SQLite/local-first. `@artisys/eventbus` 0.2.0 será vendorizado e inicializado no `createErpRuntime()`. Mutações críticas permanecem na mesma transação SQLite; eventos entram na outbox na mesma transação e são despachados somente depois do commit. O renderer continua isolado de Node por preload e ganha um gate que proíbe diálogos web incompatíveis.

**Tech Stack:** Node.js 22+, CommonJS, SQLite, Electron 39, Playwright 1.63, `@playwright/test` 1.63, `node:test`, `@artisys/eventbus` 0.2.0 vendorizado.

**Spec:** `docs/superpowers/specs/2026-09-25-artisys-erp-operational-core-design.md`

## Global Constraints

- Repositório alvo: `nutricionistaalmeidavh-spec/ARTISYS_ERP`.
- Branch de trabalho: derivada de `feat/erp-standalone`; não alterar `PDV-ARTISYS`.
- Core obrigatório com custo de infraestrutura R$ 0 e funcionamento local sem internet.
- SQLite é a fonte de verdade.
- `prompt()`, `window.prompt()`, `alert()`, `window.alert()`, `confirm()` e `window.confirm()` são proibidos no renderer.
- Nenhum Kafka, RabbitMQ, Redis, SaaS ou broker externo.
- Operações críticas de estoque/financeiro não podem depender de subscribers para consistência.
- Cada tarefa termina com testes verdes e commit próprio.

## Review Focus

1. Evento gravado dentro de transação que sofre rollback não pode sobreviver na outbox — `test/eventbus-runtime.test.js`.
2. Falha de subscriber não pode marcar evento como despachado — `test/eventbus-runtime.test.js`.
3. Reinício do runtime deve encontrar e despachar evento pendente uma única vez — `test/eventbus-runtime.test.js`.
4. Renderer contendo diálogo web proibido deve fazer `npm run verify` falhar — `test/desktop-electron-compat.test.js`.
5. E2E usa banco temporário isolado, usuário bootstrap próprio e cleanup mesmo após falha — `qa/e2e/fixtures/erp-electron.js`.

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
- Consumes source `nutricionistaalmeidavh-spec/utilidades/modules/artisys-eventbus` version `0.2.0`.
- Produces dependency `@artisys/eventbus: file:vendor/artisys-eventbus` exporting `createDomainEvent`, `DomainEventBus`, `DomainEventDispatcher`, `SqliteOutboxStore`, `SqliteEffectStore`, `IdempotentEffectRunner`, `SQLITE_SCHEMA`.

- [ ] **Step 1: Write failing package contract**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
test('vendored eventbus exposes desktop contract', () => {
  const bus = require('../vendor/artisys-eventbus/src');
  for (const key of ['createDomainEvent','DomainEventBus','DomainEventDispatcher','SqliteOutboxStore','SqliteEffectStore','IdempotentEffectRunner','SQLITE_SCHEMA']) assert.ok(bus[key], key);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/eventbus-vendor.test.js`
Expected: FAIL because vendor module is absent.

- [ ] **Step 3: Copy the Node/Electron core only and pin provenance**

`PROVENANCE.md` records source repo/path, version `0.2.0`, exact source commit, license, and excluded web/D1 adapters. Update `package.json`:

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

### Task 2: Persistir outbox/effects nas migrations

**Files:**
- Create: `js/core/database/migrations/060-eventbus.js`
- Modify: `js/core/database/migrations/index.js`
- Test: `test/eventbus-runtime.test.js`

**Interfaces:**
- Consumes `SQLITE_SCHEMA` from `@artisys/eventbus`.
- Produces `domain_events` and `domain_effects`.

- [ ] **Step 1: Write failing migration test**

```js
const runtime = createErpRuntime();
const names = runtime.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
assert.ok(names.includes('domain_events'));
assert.ok(names.includes('domain_effects'));
runtime.close();
```

- [ ] **Step 2: Run RED**

Run: `node --test test/eventbus-runtime.test.js`
Expected: FAIL.

- [ ] **Step 3: Add migration**

```js
'use strict';
const { SQLITE_SCHEMA } = require('@artisys/eventbus');
module.exports = { id:'060-eventbus', up(db){ db.exec(SQLITE_SCHEMA); } };
```

Register after `050-finance-automation`.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/eventbus-runtime.test.js test/database-foundation.test.js`
Expected: PASS.

```bash
git add js/core/database/migrations test/eventbus-runtime.test.js
git commit -m "feat: add durable ERP event outbox"
```

### Task 3: Integrar EventBus ao runtime

**Files:**
- Create: `js/core/events/erp-events.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/eventbus-runtime.test.js`

**Interfaces:**
- Produces `runtime.events.bus`, `.outbox`, `.effects`, `.dispatcher`, `.create(...)`, `.dispatchPending()`.

- [ ] **Step 1: Write failing runtime/retry test**

```js
const runtime = createErpRuntime();
let calls = 0;
runtime.events.bus.subscribe('test.event',()=>{ calls += 1; if (calls === 1) throw new Error('boom'); });
const event = runtime.events.create('test.event','test','1',{ok:true},{id:'u1'});
runtime.events.outbox.insert(event);
assert.equal((await runtime.events.dispatchPending()).failed,1);
assert.equal((await runtime.events.dispatchPending()).dispatched,1);
assert.equal(calls,2);
runtime.close();
```

- [ ] **Step 2: Run RED**

Run: `node --test test/eventbus-runtime.test.js`
Expected: FAIL because `runtime.events` is undefined.

- [ ] **Step 3: Implement `createErpEvents`**

```js
const { randomUUID } = require('node:crypto');
const { createDomainEvent,DomainEventBus,DomainEventDispatcher,SqliteOutboxStore,SqliteEffectStore } = require('@artisys/eventbus');
function createErpEvents({db,now}) {
  const bus = new DomainEventBus();
  const outbox = new SqliteOutboxStore(db);
  const effects = new SqliteEffectStore(db);
  const dispatcher = new DomainEventDispatcher({bus,outbox});
  return {
    bus,outbox,effects,dispatcher,
    create(type,aggregate,aggregateId,payload={},actor={},mutationId=null) {
      return createDomainEvent({eventId:randomUUID(),type,aggregate,aggregateId,mutationId,source:'artisys-erp',actor:actor||{},payload,occurredAt:now()});
    },
    dispatchPending:()=>dispatcher.dispatchPending()
  };
}
```

Initialize after migrations.

- [ ] **Step 4: Add rollback/restart tests**

Insert an outbox event inside `withTransaction` then throw; assert zero rows. For restart, use temporary file DB, insert pending event, close runtime, reopen same DB, subscribe and dispatch; assert exactly one dispatch and a second dispatch attempts zero.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test test/eventbus-runtime.test.js test/erp-runtime.test.js`
Expected: PASS.

```bash
git add js/core/events js/core/erp-runtime.js test/eventbus-runtime.test.js
git commit -m "feat: wire EventBus into ERP runtime"
```

### Task 4: Gate de compatibilidade Electron

**Files:**
- Create: `scripts/check-electron-renderer-compat.js`
- Modify: `package.json`
- Test: `test/desktop-electron-compat.test.js`

**Interfaces:**
- Produces `npm run electron:compat`, included in `npm run verify`.

- [ ] **Step 1: Write failing checker tests**

Fixtures must prove rejection of `prompt('x')`, `window.alert('x')`, `confirm('x')`, `require('fs')`, `process.cwd()` and acceptance of normal DOM code.

- [ ] **Step 2: Run RED**

Run: `node --test test/desktop-electron-compat.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement deterministic scanner**

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

Recursively scan `desktop/renderer/**/*.js`. Update:

```json
"electron:compat":"node scripts/check-electron-renderer-compat.js",
"verify":"npm run boundary:check && npm run electron:compat && npm run lint && npm test"
```

- [ ] **Step 4: Run GREEN and commit**

Run: `npm run electron:compat && node --test test/desktop-electron-compat.test.js`
Expected: PASS.

```bash
git add scripts/check-electron-renderer-compat.js package.json test/desktop-electron-compat.test.js
git commit -m "test: enforce Electron renderer compatibility"
```

### Task 5: Harness E2E Electron + Playwright

**Files:**
- Modify: `package.json`
- Modify: `desktop/main.cjs`
- Modify: `desktop/renderer/index.html`
- Modify: `desktop/renderer/app.js`
- Create: `qa/e2e/fixtures/erp-electron.js`
- Create: `qa/e2e/smoke.spec.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces `launchErpElectron() -> {app,page,dbPath,close}` and scripts `e2e`, `e2e:smoke`.

- [ ] **Step 1: Add Playwright test runner as dev-only dependency**

Update `devDependencies` keeping versions aligned:

```json
"@playwright/test":"1.63.0",
"playwright":"1.63.0"
```

Run: `npm install`
Expected: lockfile updated; no runtime dependency added.

- [ ] **Step 2: Write failing smoke E2E**

```js
const { test, expect } = require('@playwright/test');
const { launchErpElectron } = require('./fixtures/erp-electron');
test('opens ERP, logs in and shows dashboard without web dialogs', async () => {
  const erp = await launchErpElectron();
  try {
    const dialogs=[];
    erp.page.on('dialog',d=>dialogs.push(d.type()));
    await erp.page.getByTestId('login-email').fill('admin@artisys.local');
    await erp.page.getByTestId('login-password').fill('admin');
    await erp.page.getByTestId('login-submit').click();
    await expect(erp.page.getByTestId('view-dashboard')).toBeVisible();
    expect(dialogs).toEqual([]);
  } finally { await erp.close(); }
});
```

- [ ] **Step 3: Run RED**

Run: `npx playwright test qa/e2e/smoke.spec.js --reporter=line`
Expected: FAIL because fixture/test ids/env override are absent.

- [ ] **Step 4: Make desktop DB path injectable for tests**

In `desktop/main.cjs`:

```js
const dbPath = process.env.ERP_DB_PATH
  ? path.resolve(process.env.ERP_DB_PATH)
  : path.join(app.getPath('userData'),'data','artisys-erp.sqlite');
```

Production behavior is unchanged when `ERP_DB_PATH` is absent.

- [ ] **Step 5: Implement isolated fixture and bootstrap admin**

```js
const { _electron } = require('playwright');
const { createErpRuntime } = require('../../../js/core/erp-runtime');
const { mkdtempSync,rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
async function launchErpElectron() {
  const dir=mkdtempSync(join(tmpdir(),'artisys-erp-e2e-'));
  const dbPath=join(dir,'erp.sqlite');
  const seed=createErpRuntime({dbPath});
  seed.auth.createUser({username:'admin@artisys.local',name:'E2E Admin',role:'admin',password:'admin'});
  seed.close();
  const app=await _electron.launch({args:['.'],env:{...process.env,ERP_DB_PATH:dbPath}});
  const page=await app.firstWindow();
  return {app,page,dbPath,async close(){await app.close();rmSync(dir,{recursive:true,force:true});}};
}
module.exports={launchErpElectron};
```

- [ ] **Step 6: Add stable login/dashboard test ids and scripts**

Add `login-email`, `login-password`, `login-submit`, `view-dashboard`. Add:

```json
"e2e":"playwright test qa/e2e --reporter=line",
"e2e:smoke":"playwright test qa/e2e/smoke.spec.js --reporter=line"
```

- [ ] **Step 7: Run GREEN and commit**

Run: `npm run e2e:smoke && npm run verify`
Expected: PASS.

```bash
git add package.json package-lock.json desktop qa/e2e .gitignore
git commit -m "test: add real Electron Playwright smoke flow"
```

### Task 6: Phase 1 verification

- [ ] `npm run verify` — PASS.
- [ ] `npm run e2e:smoke` — PASS with zero web dialogs.
- [ ] `npm run release:check` — PASS.
- [ ] Run the restart/outbox test separately once more — PASS.
- [ ] Commit only concrete verification fixes; do not create an empty commit.
