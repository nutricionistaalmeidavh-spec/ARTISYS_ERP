# ArtiSys ERP Standalone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `ARTISYS_ERP` como produto desktop independente, local-first e vendável, migrando somente os componentes adequados do `PDV-ARTISYS/feat/erp-p0-p3`, preservando o Financeiro P0–P3 e excluindo por arquitetura qualquer dependência de frente de caixa/PDV.

**Architecture:** A aplicação terá `createErpRuntime()` próprio sobre `node:sqlite`, domínios separados para cadastros, estoque, compras, vendas administrativas, financeiro e relatórios, servidor local próprio e shell Electron próprio. O repositório `PDV-ARTISYS` será fonte somente-leitura durante a extração; nenhum arquivo, branch, PR ou configuração dele será alterado.

**Tech Stack:** Node.js >=22, CommonJS, `node:sqlite`/`DatabaseSync`, `node:test`, Electron 39.x, electron-builder 26.x, Playwright para E2E, JavaScript/HTML/CSS sem dependência SaaS obrigatória.

**Spec:** `docs/superpowers/specs/2026-09-24-artisys-erp-standalone-design.md`

## Global Constraints

- O ERP deve ser um produto independente, com identidade, runtime, empacotamento, documentação, QA e release próprios.
- O núcleo obrigatório deve operar localmente e sem dependência paga obrigatória.
- Serviços externos pagos ou SaaS, se adicionados no futuro, devem ser integrações opcionais, desligadas por padrão e nunca requisito para inicialização ou continuidade de operação.
- O ERP não deve depender do runtime do PDV nem de módulos específicos de frente de caixa.
- O ERP deve continuar funcional sem internet para as funções essenciais locais.
- O package name deve ser `artisys-erp`, o product name `ArtiSys ERP` e o app id `com.artisys.erp`.
- O banco padrão deve ser próprio do ERP e não pode usar `pdv-artisys.sqlite`.
- O runtime não pode importar restaurante, cash register, checkout, NFC-e do PDV, delivery do PDV, pizzeria, self-service ou hardware específico de PDV.
- `PDV-ARTISYS` é fonte somente-leitura: nenhuma etapa deste plano faz write nesse repositório.

## Review Focus

1. **Dependência transitiva de PDV:** qualquer `require()` ou arquivo empacotado que traga `cash`, `restaurant`, `printing`, `fiscal`, `serialport`, `self-service`, `delivery`, `pizzeria` ou `createPdvRuntime` deve fazer o gate arquitetural falhar.
2. **Banco novo em máquina limpa:** o ERP deve criar todas as tabelas necessárias a partir de um arquivo inexistente e repetir migrations sem erro nem duplicação.
3. **Falha parcial transacional:** recebimento de compra ou faturamento administrativo que falhar após movimentar estoque deve reverter estoque e financeiro juntos.
4. **Idempotência:** importação OFX, recebimentos e faturamento administrativo com a mesma chave não podem duplicar efeitos.
5. **Operação offline:** startup, login, cadastros, estoque, compras, vendas administrativas e financeiro devem funcionar sem rede e sem credenciais externas.

---

# Fase 1 — Fundação standalone

### Task 1: Criar identidade de produto e gate anti-PDV

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `scripts/check-erp-boundaries.js`
- Create: `test/architecture-boundary.test.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: nenhum código de runtime.
- Produces: scripts `npm test`, `npm run lint`, `npm run boundary:check`, `npm run verify`, `npm run dist:win`; função CLI `scripts/check-erp-boundaries.js` com exit code `0` quando o tree está limpo e `1` quando encontra dependência proibida.

- [ ] **Step 1: escrever teste de identidade e fronteira**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('package identifies standalone ERP', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'artisys-erp');
  assert.equal(pkg.build.appId, 'com.artisys.erp');
  assert.equal(pkg.build.productName, 'ArtiSys ERP');
  assert.match(pkg.build.win.artifactName, /^ArtiSys-ERP-/);
  assert.ok(!JSON.stringify(pkg).includes('serialport'));
  assert.ok(!JSON.stringify(pkg).includes('PDV-ARTISYS'));
});
```

- [ ] **Step 2: executar teste e confirmar falha**

Run: `node --test test/architecture-boundary.test.js`

Expected: FAIL porque `package.json` ainda não existe no novo produto.

- [ ] **Step 3: criar `package.json` mínimo e explícito**

```json
{
  "name": "artisys-erp",
  "version": "0.1.0",
  "private": true,
  "description": "ERP desktop local-first da ArtiSys",
  "main": "desktop/main.cjs",
  "engines": { "node": ">=22" },
  "scripts": {
    "start:server": "node server/start.js",
    "start:desktop": "electron .",
    "test": "node --test test/*.test.js",
    "lint": "node scripts/check-js-syntax.js",
    "boundary:check": "node scripts/check-erp-boundaries.js",
    "verify": "npm run boundary:check && npm run lint && npm test",
    "dist:win": "electron-builder --win nsis --x64 --publish never"
  },
  "dependencies": {},
  "devDependencies": {
    "electron": "^39.8.10",
    "electron-builder": "^26.0.12",
    "playwright": "1.63.0"
  },
  "build": {
    "appId": "com.artisys.erp",
    "productName": "ArtiSys ERP",
    "asar": true,
    "directories": { "output": "dist" },
    "files": [
      "desktop/**/*",
      "js/core/**/*",
      "js/domains/shared/**/*",
      "js/domains/contacts/**/*",
      "js/domains/catalog/**/*",
      "js/domains/inventory/**/*",
      "js/domains/procurement/**/*",
      "js/domains/sales-admin/**/*",
      "js/domains/finance/**/*",
      "js/domains/reports/**/*",
      "server/**/*",
      "release/**/*",
      "vendor/artisys-finance-domain/**/*",
      "package.json"
    ],
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }],
      "artifactName": "ArtiSys-ERP-${version}-${arch}-Setup.${ext}"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "deleteAppDataOnUninstall": false
    }
  }
}
```

- [ ] **Step 4: criar gate de fronteira**

`scripts/check-erp-boundaries.js` deve percorrer `js`, `server`, `desktop` e `package.json`, ignorando testes/docs, e falhar ao encontrar imports/caminhos proibidos. Lista inicial literal:

```js
const forbidden = [
  'createPdvRuntime',
  '/cash/',
  '/restaurant/',
  '/printing/',
  '/fiscal/',
  '/pizzeria/',
  '/delivery/',
  '/self-service/',
  'serialport',
  'pdv-artisys.sqlite',
  'com.artisys.pdv',
  'ArtiSys PDV'
];
```

O teste deve criar uma fixture temporária contendo `require('../domains/cash/cash-service')`, executar o checker apontando para a fixture e confirmar exit code `1`; depois executar contra o tree real e confirmar `0`.

- [ ] **Step 5: criar lint sintático**

Create `scripts/check-js-syntax.js` para listar todos os `.js/.cjs` em `js`, `server`, `desktop`, `scripts`, `test` e executar `node --check` via `spawnSync` em cada arquivo, propagando o primeiro erro.

- [ ] **Step 6: executar gates**

Run: `npm install`

Run: `npm run boundary:check && npm run lint && npm test`

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add package.json .gitignore README.md scripts test/architecture-boundary.test.js
git commit -m "chore: bootstrap standalone ArtiSys ERP"
```

### Task 2: Extrair banco transacional e migrations próprias do ERP

**Files:**
- Create: `js/core/database/sqlite-database.js`
- Create: `js/core/database/migration-runner.js`
- Create: `js/core/database/migrations/001-core.js`
- Create: `js/core/database/migrations/index.js`
- Create: `test/database-foundation.test.js`

**Interfaces:**
- Consumes: Node `node:sqlite`.
- Produces: `openDatabase(filename)`, `withTransaction(db, fn)`, `runErpMigrations(db, now)`, tabela `schema_migrations`, tabelas core `users`, `audit_log`, `settings`.

- [ ] **Step 1: escrever testes de banco limpo, reexecução e rollback aninhado**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, withTransaction } = require('../js/core/database/sqlite-database');
const { runErpMigrations } = require('../js/core/database/migrations');

test('creates ERP schema from empty database and is idempotent', () => {
  const db = openDatabase(':memory:');
  runErpMigrations(db, () => '2026-09-24T00:00:00.000Z');
  runErpMigrations(db, () => '2026-09-24T00:00:00.000Z');
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  assert.ok(names.includes('users'));
  assert.ok(names.includes('audit_log'));
  assert.ok(names.includes('settings'));
  db.close();
});

test('nested transaction rolls back only failing savepoint', () => {
  const db = openDatabase(':memory:');
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, value TEXT)');
  withTransaction(db, () => {
    db.prepare('INSERT INTO t(value) VALUES (?)').run('outer');
    assert.throws(() => withTransaction(db, () => {
      db.prepare('INSERT INTO t(value) VALUES (?)').run('inner');
      throw new Error('boom');
    }));
  });
  assert.deepEqual(db.prepare('SELECT value FROM t').all(), [{ value: 'outer' }]);
  db.close();
});
```

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/database-foundation.test.js`

Expected: FAIL por módulos ausentes.

- [ ] **Step 3: extrair `sqlite-database.js`**

Partir da implementação validada em `PDV-ARTISYS/feat/erp-p0-p3/js/core/database/sqlite-database.js`, preservando `DatabaseSync`, `PRAGMA foreign_keys`, `busy_timeout`, WAL, `withTransaction`, savepoints e rejeição de callback async. Não copiar nenhuma migration do PDV.

- [ ] **Step 4: implementar migration runner versionado**

Contrato:

```js
function runMigrations(db, migrations, now = () => new Date().toISOString()) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  for (const migration of migrations) {
    const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE id=?').get(migration.id);
    if (applied) continue;
    withTransaction(db, () => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations(id, applied_at) VALUES (?, ?)').run(migration.id, now());
    });
  }
}
```

- [ ] **Step 5: criar migration core**

`001-core.js` cria somente tabelas necessárias a usuários locais, auditoria e configurações. Nenhuma tabela com prefixo/semântica de restaurante, checkout, cash drawer, fiscal ou terminal PDV.

- [ ] **Step 6: executar testes e gate arquitetural**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add js/core/database test/database-foundation.test.js
git commit -m "feat: add ERP database foundation"
```

### Task 3: Autenticação local, RBAC, auditoria e settings

**Files:**
- Create: `js/core/audit/audit-log.js`
- Create: `js/core/auth/password.js`
- Create: `js/core/auth/auth-service.js`
- Create: `js/core/auth/rbac.js`
- Create: `js/core/settings/settings-service.js`
- Create: `test/auth-rbac-audit.test.js`
- Modify: `js/core/database/migrations/001-core.js`

**Interfaces:**
- Produces: `createAuthService({db, now, idFactory})`, `hashPassword(password)`, `verifyPassword(password, encoded)`, `assertRole(actor, allowedRoles)`, `writeAudit(db, event, now)`, `createSettingsService({db, now})`.
- Actor shape: `{ userId: string, role: 'admin'|'manager'|'operator' }`.

- [ ] **Step 1: escrever testes**

```js
test('manager cannot perform admin-only action', () => {
  assert.throws(() => assertRole({ userId:'u1', role:'manager' }, ['admin']), /Autorizacao/);
});

test('audit row records actor and action', () => {
  writeAudit(db, { action:'settings.update', entity:'settings', entityId:'company', actor:{userId:'u1',role:'admin'}, context:{key:'companyName'} }, now);
  const row = db.prepare('SELECT action, actor_user_id FROM audit_log').get();
  assert.deepEqual(row, { action:'settings.update', actor_user_id:'u1' });
});
```

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/auth-rbac-audit.test.js`

Expected: FAIL.

- [ ] **Step 3: implementar password local com `crypto.scryptSync`**

Formato armazenado: `scrypt$<salt-hex>$<hash-hex>`. Comparação deve usar `timingSafeEqual` e rejeitar senha vazia na criação de usuário.

- [ ] **Step 4: implementar auth/RBAC/audit/settings**

`createAuthService` deve expor `createUser`, `authenticate`, `getUser`, `listUsers`, `setUserActive`; criação/alteração de usuário exige ator `admin` após bootstrap inicial. `writeAudit` deve serializar `context` como JSON e nunca armazenar senha/hash no contexto.

- [ ] **Step 5: executar testes**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add js/core/auth js/core/audit js/core/settings js/core/database/migrations/001-core.js test/auth-rbac-audit.test.js
git commit -m "feat: add local auth RBAC and audit"
```

### Task 4: Criar `createErpRuntime()` e servidor local mínimo

**Files:**
- Create: `js/core/erp-runtime.js`
- Create: `server/http-utils.js`
- Create: `server/local-server.js`
- Create: `server/start.js`
- Create: `test/erp-runtime.test.js`
- Create: `test/local-server.test.js`

**Interfaces:**
- `createErpRuntime({dbPath=':memory:', now, idFactory}) -> {db, auth, settings, close()}` nesta fase.
- `createLocalServer({runtime, host='127.0.0.1', port=0}) -> {server, listen(), close()}`.
- `GET /api/v1/health` retorna `{ok:true, product:'artisys-erp'}`.

- [ ] **Step 1: teste de runtime sem rede**

```js
test('ERP runtime starts from empty local database without external integrations', () => {
  const runtime = createErpRuntime({ dbPath: ':memory:' });
  assert.ok(runtime.db);
  assert.ok(runtime.auth);
  assert.ok(runtime.settings);
  assert.equal('cash' in runtime, false);
  assert.equal('restaurant' in runtime, false);
  runtime.close();
});
```

- [ ] **Step 2: teste de health local**

Abrir server em porta efêmera, usar `fetch('http://127.0.0.1:<port>/api/v1/health')` e validar status 200 e product `artisys-erp`.

- [ ] **Step 3: executar e confirmar falha**

Run: `node --test test/erp-runtime.test.js test/local-server.test.js`

Expected: FAIL.

- [ ] **Step 4: implementar runtime mínimo e servidor**

`server/start.js` deve usar `ERP_HOST`, `ERP_PORT`, `ERP_DB_PATH`; default do banco em execução desktop/server: `data/artisys-erp.sqlite`.

- [ ] **Step 5: executar gates**

Run: `npm run verify`

Expected: PASS e `boundary:check` sem ocorrência de runtime PDV.

- [ ] **Step 6: commit**

```bash
git add js/core/erp-runtime.js server test/erp-runtime.test.js test/local-server.test.js
git commit -m "feat: add standalone ERP runtime and local server"
```

---

# Fase 2 — Financeiro P0–P3 nativo do ERP

### Task 5: Migrar domínio financeiro base e migrations próprias

**Files:**
- Create: `js/core/database/migrations/010-finance-base.js`
- Create: `js/core/database/migrations/011-finance-p3.js`
- Modify: `js/core/database/migrations/index.js`
- Create: `js/domains/shared/money.js`
- Create: `js/domains/finance/finance-service.js`
- Create: `js/domains/finance/finance-dimensions.js`
- Create: `test/finance-service.test.js`
- Create: `test/finance-dimensions.test.js`

**Interfaces:**
- `createFinanceDimensions({db,now,idFactory})`.
- `createFinanceService({db,dimensions,now,idFactory})` preserva `createAccount`, `getAccount`, `listAccounts`, `createEntry`, `getEntry`, `listEntries`, `settleEntry`, `reverseSettlement`, `cancelEntry`, `getSummary`.

- [ ] **Step 1: portar testes funcionais do branch de origem antes do código**

Cobrir conta financeira, payable/receivable, baixa parcial/total, excesso de baixa, estorno, cancelamento com baixa ativa, vencido, filtro por conta/categoria/centro de custo e auditoria.

Exemplo obrigatório:

```js
test('settlement cannot exceed open balance', () => {
  const entry = finance.createEntry({kind:'PAYABLE',description:'Fornecedor',amountCents:10000,dueAt:'2026-10-01T00:00:00.000Z'});
  assert.throws(() => finance.settleEntry(entry.id,{amountCents:10001}), /excede o saldo aberto/);
});
```

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/finance-service.test.js test/finance-dimensions.test.js`

Expected: FAIL.

- [ ] **Step 3: migrar código da origem sem `pdv-finance-extension.js`**

Usar como referência somente-leitura:
- `PDV-ARTISYS/feat/erp-p0-p3/js/domains/finance/finance-service.js`
- `PDV-ARTISYS/feat/erp-p0-p3/js/domains/finance/finance-dimensions.js`

Ajustar imports para `js/core/audit/audit-log.js`. Não copiar `pdv-finance-extension.js`.

- [ ] **Step 4: criar migrations financeiras próprias**

`010-finance-base.js` cria contas, lançamentos e baixas. `011-finance-p3.js` cria dimensões, extratos, conciliações, recorrências e estado de alertas necessários às tasks seguintes. Todos os FKs devem apontar apenas para tabelas do ERP.

- [ ] **Step 5: integrar no runtime**

Em `createErpRuntime()`:

```js
const financeDimensions = createFinanceDimensions({db, now, idFactory});
const finance = createFinanceService({db, dimensions: financeDimensions, now, idFactory});
```

Retornar `{ finance, financeDimensions }` no runtime.

- [ ] **Step 6: executar testes e gates**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add js/core/database/migrations js/domains/shared js/domains/finance test/finance-*.test.js js/core/erp-runtime.js
git commit -m "feat: migrate ERP finance base"
```

### Task 6: Migrar DRE, fluxo de caixa e comparativos

**Files:**
- Create: `js/domains/finance/finance-management.js`
- Create: `test/finance-management.test.js`
- Modify: `js/core/erp-runtime.js`

**Interfaces:**
- `createFinanceManagement({db,finance,dimensions,settings,now})`.
- Métodos preservados da origem devem continuar entregando DRE gerencial, fluxo/projeção e comparativos sem consultar tabelas de vendas PDV.

- [ ] **Step 1: escrever/portar testes com dataset determinístico**

Criar receitas e despesas em competências distintas, uma conta vencida e uma quitada. Validar DRE por competência e fluxo por caixa.

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/finance-management.test.js`

Expected: FAIL.

- [ ] **Step 3: migrar `finance-management.js`**

Origem: `PDV-ARTISYS/feat/erp-p0-p3/js/domains/finance/finance-management.js`. Remover dependências que assumam `runtime.reports`; receber dependências explicitamente pelo factory.

- [ ] **Step 4: integrar runtime e testar**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add js/domains/finance/finance-management.js js/core/erp-runtime.js test/finance-management.test.js
git commit -m "feat: add ERP financial management reports"
```

### Task 7: Migrar OFX, extratos, conciliação, transferências, recorrências e alertas

**Files:**
- Create: `js/domains/finance/ofx-parser.js`
- Create: `js/domains/finance/statement-import.js`
- Create: `js/domains/finance/reconciliation.js`
- Create: `js/domains/finance/recurrence.js`
- Create: `js/domains/finance/finance-alerts.js`
- Create: `test/ofx-import.test.js`
- Create: `test/reconciliation.test.js`
- Create: `test/finance-recurrence.test.js`
- Create: `test/finance-alerts.test.js`
- Modify: `js/core/erp-runtime.js`

**Interfaces:**
- `parseOfx(text)` é puro e não escreve no banco.
- `createStatementImportService({db,finance,now,idFactory})` expõe preview e commit idempotente.
- `createReconciliationService({db,finance,now,idFactory})` exige confirmação explícita para conciliar.
- `createRecurrenceService({db,finance,now,idFactory})` não duplica ocorrências.
- `createFinanceAlerts({db,finance,now})` altera somente estado de alerta, nunca o lançamento financeiro.

- [ ] **Step 1: escrever testes de idempotência e isolamento**

```js
test('committing same OFX twice does not duplicate transactions', () => {
  const preview = statements.preview({accountId: account.id, text: fixture});
  const first = statements.commit({accountId: account.id, previewId: preview.id});
  const second = statements.commit({accountId: account.id, previewId: preview.id});
  assert.equal(second.importId, first.importId);
  assert.equal(statements.listTransactions({accountId: account.id}).length, first.insertedCount);
});
```

Também testar transferência entre contas próprias com efeito líquido zero em DRE e que `markRead/hide` em alertas não modifica `financial_entries.updated_at`.

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/ofx-import.test.js test/reconciliation.test.js test/finance-recurrence.test.js test/finance-alerts.test.js`

Expected: FAIL.

- [ ] **Step 3: migrar implementações da origem**

Referências somente-leitura:
- `js/domains/finance/ofx-parser.js`
- `js/domains/finance/statement-import.js`
- `js/domains/finance/reconciliation.js`
- `js/domains/finance/recurrence.js`
- `js/domains/finance/finance-alerts.js`

Não portar nenhuma referência a `ensurePdvFinance`.

- [ ] **Step 4: integrar diretamente no `createErpRuntime()`**

O runtime cria os serviços após `finance`/`financeManagement` e os retorna como propriedades de primeira classe.

- [ ] **Step 5: executar gates**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add js/domains/finance js/core/erp-runtime.js test
git commit -m "feat: migrate ERP finance P3 operations"
```

### Task 8: Expor API financeira própria do ERP

**Files:**
- Create: `server/auth-context.js`
- Create: `server/routers/finance-router.js`
- Modify: `server/local-server.js`
- Create: `test/finance-api.test.js`

**Interfaces:**
- Namespace: `/api/v1/finance/...`.
- Nenhuma rota `/api/v1/erp-finance` herdada é obrigatória; usar namespace nativo do produto.
- Escritas financeiras exigem ator autenticado; operações administrativas exigem `manager` ou `admin` conforme domínio.

- [ ] **Step 1: teste HTTP de autorização**

Testar 401 sem sessão, 403 para `operator` em operação manager-only e 200 para `manager`.

- [ ] **Step 2: implementar router mapeando explicitamente serviços do runtime**

Não importar `pdv-finance-extension.js`. O router recebe `runtime` já composto.

- [ ] **Step 3: executar gates**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 4: commit**

```bash
git add server test/finance-api.test.js
git commit -m "feat: expose standalone ERP finance API"
```

---

# Fase 3 — Cadastros, estoque, compras e vendas administrativas

### Task 9: Migrar cadastros, catálogo e estoque mínimos

**Files:**
- Create: `js/core/database/migrations/020-master-data.js`
- Create: `js/core/database/migrations/021-inventory.js`
- Modify: `js/core/database/migrations/index.js`
- Create: `js/domains/contacts/contact-service.js`
- Create: `js/domains/catalog/catalog-service.js`
- Create: `js/domains/inventory/inventory-rules.js`
- Create: `js/domains/inventory/inventory-service.js`
- Create: `js/domains/inventory/inventory-logistics-service.js`
- Create: `test/master-data.test.js`
- Create: `test/inventory.test.js`
- Modify: `js/core/erp-runtime.js`

**Interfaces:**
- `contacts`: clientes e fornecedores com status ativo.
- `catalog`: produtos/categorias com `costCents`, `salePriceCents`, `trackStock`.
- `inventory`: `move`, `getBalance`, `listMovements`.
- `inventoryLogistics`: reserva/liberação para pedido administrativo.

- [ ] **Step 1: escrever testes de integridade**

Casos obrigatórios: fornecedor inativo não pode ser usado; produto inexistente não pode movimentar estoque; estoque rastreado não pode ser reservado acima do disponível; custo/valor sempre em centavos inteiros.

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/master-data.test.js test/inventory.test.js`

Expected: FAIL.

- [ ] **Step 3: extrair somente regras genéricas**

Usar como referências o catálogo/inventory do branch de origem, removendo customizações de balcão, receita culinária, kits/combo, variantes exclusivamente PDV e efeitos de venda PDV. Onde um arquivo de origem fizer mais do que o ERP precisa, copiar a regra necessária para arquivo novo menor em vez de trazer o módulo inteiro.

- [ ] **Step 4: integrar runtime**

Ordem: contacts -> catalog -> inventory -> inventoryLogistics.

- [ ] **Step 5: executar gates**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add js/core/database/migrations js/domains/contacts js/domains/catalog js/domains/inventory js/core/erp-runtime.js test/master-data.test.js test/inventory.test.js
git commit -m "feat: add ERP master data and inventory"
```

### Task 10: Migrar compras integradas a estoque e contas a pagar

**Files:**
- Create: `js/core/database/migrations/030-procurement.js`
- Modify: `js/core/database/migrations/index.js`
- Create: `js/domains/procurement/procurement-service.js`
- Create: `test/procurement.test.js`
- Modify: `js/core/erp-runtime.js`
- Create: `server/routers/procurement-router.js`
- Modify: `server/local-server.js`

**Interfaces:**
- Preservar API de domínio: `createPurchaseOrder`, `submitPurchaseOrder`, `receivePurchaseOrder`, `getPurchaseOrder`, `listPurchaseOrders`, `listReceipts`.
- `receivePurchaseOrder` exige `idempotencyKey`, move estoque, recalcula custo e cria `PAYABLE` na mesma transação.

- [ ] **Step 1: teste de rollback atômico**

```js
test('failed payable creation rolls back purchase stock receipt', () => {
  const before = inventory.getBalance(product.id,{aggregate:true});
  const brokenFinance = { createEntry(){ throw new Error('finance down'); } };
  const service = createProcurementService({db,inventory,finance:brokenFinance,now,idFactory});
  assert.throws(() => service.receivePurchaseOrder(order.id,{idempotencyKey:'r1',items:[{productId:product.id,quantity:2}]},manager));
  assert.equal(inventory.getBalance(product.id,{aggregate:true}), before);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM purchase_receipts').get().n, 0);
});
```

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/procurement.test.js`

Expected: FAIL.

- [ ] **Step 3: migrar procurement da origem**

Referência: `PDV-ARTISYS/feat/erp-p0-p3/js/domains/procurement/procurement-service.js`. Adaptar apenas imports de audit/inventory/finance. Não trazer sale/cash/printing.

- [ ] **Step 4: implementar API e RBAC**

Criação/submissão/recebimento requer `manager|admin`. Consultas autenticadas podem ser `operator|manager|admin`.

- [ ] **Step 5: executar gates**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add js/domains/procurement js/core/database/migrations js/core/erp-runtime.js server/routers/procurement-router.js server/local-server.js test/procurement.test.js
git commit -m "feat: add ERP procurement flow"
```

### Task 11: Implementar vendas administrativas sem checkout/caixa

**Files:**
- Create: `js/core/database/migrations/040-sales-admin.js`
- Modify: `js/core/database/migrations/index.js`
- Create: `js/domains/sales-admin/sales-admin-service.js`
- Create: `test/sales-admin.test.js`
- Modify: `js/core/erp-runtime.js`
- Create: `server/routers/sales-admin-router.js`
- Modify: `server/local-server.js`

**Interfaces:**
- `createSalesAdminService({db,catalog,inventory,inventoryLogistics,finance,now,idFactory})`.
- Métodos: `createQuote`, `confirmOrder`, `cancelOrder`, `invoiceOrder`, `getOrder`, `listOrders`, `listInvoices`.
- `invoiceOrder(id,{items,dueAt,accountId,idempotencyKey},actor)` não recebe `terminalId`, `operatorId`, `payments`, `cashSession` ou dispositivo de checkout.

- [ ] **Step 1: escrever testes do novo contrato**

```js
test('administrative invoice creates receivable without PDV terminal', () => {
  const quote = salesAdmin.createQuote({customerId:customer.id,locationId:'MAIN',items:[{productId:product.id,quantity:2,unitPriceCents:5000}]},operator);
  salesAdmin.confirmOrder(quote.id, operator);
  const invoice = salesAdmin.invoiceOrder(quote.id,{items:[{productId:product.id,quantity:2}],dueAt:'2026-10-10T00:00:00.000Z',idempotencyKey:'inv-1'},manager);
  assert.equal(invoice.totalCents, 10000);
  assert.ok(invoice.receivableEntryId);
  assert.equal(finance.getEntry(invoice.receivableEntryId).kind, 'RECEIVABLE');
});
```

Também testar invoice parcial, segunda chamada com mesma idempotencyKey, cancelamento antes/depois de faturamento e rollback se `finance.createEntry` falhar.

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/sales-admin.test.js`

Expected: FAIL.

- [ ] **Step 3: reaproveitar somente orçamento/confirmação/reserva conceitual da origem**

Referência somente-leitura: `PDV-ARTISYS/feat/erp-p0-p3/js/domains/orders/sales-order-service.js`. Não copiar `fulfillOrder` porque ele abre `sale`, exige terminal/operador e processa `payments`. Implementar `invoiceOrder` novo, transacional, que baixa/reserva estoque administrativo e cria `RECEIVABLE` diretamente.

- [ ] **Step 4: criar API própria**

Rotas: `/api/v1/sales/quotes`, `/api/v1/sales/orders/:id/confirm`, `/api/v1/sales/orders/:id/invoice`, `/api/v1/sales/orders`.

- [ ] **Step 5: executar boundary e testes**

Run: `npm run verify`

Expected: PASS e nenhum arquivo/import de `js/domains/sales/sale-service.js` ou `cash-service` no ERP.

- [ ] **Step 6: commit**

```bash
git add js/domains/sales-admin js/core/database/migrations js/core/erp-runtime.js server/routers/sales-admin-router.js server/local-server.js test/sales-admin.test.js
git commit -m "feat: add administrative sales without checkout"
```

### Task 12: Relatórios operacionais do ERP

**Files:**
- Create: `js/domains/reports/reporting-service.js`
- Create: `test/reporting.test.js`
- Modify: `js/core/erp-runtime.js`
- Create: `server/routers/reporting-router.js`
- Modify: `server/local-server.js`

**Interfaces:**
- `createReportingService({db,finance,now})`.
- Relatórios: financeiro, vendas administrativas, compras e estoque. Consultas devem ler tabelas do ERP, não tabelas de sale/cash do PDV.

- [ ] **Step 1: escrever teste com um ciclo completo**

Fixture: 1 compra recebida + 1 venda administrativa faturada + 1 baixa financeira. Validar totais de compras, vendas, estoque e financeiro.

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/reporting.test.js`

Expected: FAIL.

- [ ] **Step 3: implementar queries explícitas e router read-only**

- [ ] **Step 4: executar gates**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add js/domains/reports js/core/erp-runtime.js server/routers/reporting-router.js server/local-server.js test/reporting.test.js
git commit -m "feat: add ERP operational reporting"
```

---

# Fase 4 — Desktop, QA, release e verdade comercial

### Task 13: Criar shell Electron próprio do ERP

**Files:**
- Create: `desktop/main.cjs`
- Create: `desktop/preload.cjs`
- Create: `desktop/renderer/index.html`
- Create: `desktop/renderer/app.js`
- Create: `desktop/renderer/api-client.js`
- Create: `desktop/renderer/styles.css`
- Create: `test/desktop-identity.test.js`

**Interfaces:**
- Desktop inicia servidor local próprio e abre UI ArtiSys ERP.
- Navegação mínima: Dashboard, Cadastros, Estoque, Compras, Vendas, Financeiro, Relatórios, Configurações.

- [ ] **Step 1: teste de identidade textual e ausência de PDV**

```js
test('desktop contains ERP identity and no PDV chrome', () => {
  const html = fs.readFileSync('desktop/renderer/index.html','utf8');
  assert.match(html, /ArtiSys ERP/);
  for (const forbidden of ['Terminal PDV','Balcão','Abrir caixa','Comanda','Restaurante']) {
    assert.equal(html.includes(forbidden), false, forbidden);
  }
});
```

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/desktop-identity.test.js`

Expected: FAIL.

- [ ] **Step 3: implementar shell e API client**

UI deve consumir apenas `http://127.0.0.1:<porta>/api/v1/...`; nenhuma URL externa em startup. `preload` expõe somente informações de versão/caminhos estritamente necessárias, sem bridges de serial, fiscal, foto de PDV ou hardware.

- [ ] **Step 4: smoke manual**

Run: `npm run start:desktop`

Expected: janela `ArtiSys ERP`, servidor local sobe, health responde, navegação abre módulos sem erro de console.

- [ ] **Step 5: gates**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add desktop test/desktop-identity.test.js package.json
git commit -m "feat: add standalone ERP desktop shell"
```

### Task 14: Adaptar QA E2E do Financeiro e fluxos ERP

**Files:**
- Create: `qa/artisys-qa.config.json`
- Create: `qa/flows/finance-*.json` (somente os fluxos financeiros realmente migrados da origem)
- Create: `qa/flows/procurement-e2e.json`
- Create: `qa/flows/sales-admin-e2e.json`
- Create: `qa/flows/inventory-e2e.json`
- Create: `qa/runtime/erp-qa.mjs`
- Modify: `package.json`
- Create: `test/qa-config.test.js`

**Interfaces:**
- `systemId`: `artisys-erp`.
- Perfis `quick`, `full`, `release`.
- Fluxos Financeiro P0–P3 existentes na origem devem ser migrados/adaptados quando a funcionalidade correspondente existir; fluxos de checkout/restaurant/fiscal não entram.

- [ ] **Step 1: teste de configuração**

Validar `systemId === 'artisys-erp'`, ausência de IDs contendo `checkout`, `restaurant`, `pizzeria`, `fiscal`, `cashier`, e presença de fluxos para DRE, cashflow, OFX, conciliação, recorrência, alertas, compras, venda administrativa e estoque.

- [ ] **Step 2: portar fluxos financeiros da origem**

Usar os JSONs P0–P3 já existentes como referência, alterando seletores/rotas para UI standalone. Não copiar arquivos como `checkout-ux-preservation.json` ou outros específicos do PDV.

- [ ] **Step 3: adicionar scripts**

```json
"qa:quick": "node qa/runtime/erp-qa.mjs quick --config qa/artisys-qa.config.json",
"qa:full": "node qa/runtime/erp-qa.mjs full --config qa/artisys-qa.config.json",
"qa:release": "node qa/runtime/erp-qa.mjs release --config qa/artisys-qa.config.json"
```

- [ ] **Step 4: executar**

Run: `npm run qa:quick`

Run: `npm run qa:full`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add qa package.json test/qa-config.test.js
git commit -m "test: add standalone ERP QA flows"
```

### Task 15: Backup, observabilidade e diagnóstico local

**Files:**
- Create: `js/core/backup/backup-service.js`
- Create: `js/core/observability/system-logger.js`
- Create: `js/core/observability/system-health.js`
- Create: `js/core/observability/diagnostic-package.js`
- Create: `test/backup-observability.test.js`
- Modify: `js/core/erp-runtime.js`

**Interfaces:**
- Backup copia banco de forma consistente e lista backups locais.
- Health retorna versão, banco e status do último backup.
- Diagnóstico não inclui senha/hash, tokens ou conteúdo financeiro bruto desnecessário.

- [ ] **Step 1: escrever teste de backup/restore em diretório temporário**

Criar banco, inserir cliente/lancamento, gerar backup, alterar dados, restaurar em nova instância e validar conteúdo original.

- [ ] **Step 2: executar e confirmar falha**

Run: `node --test test/backup-observability.test.js`

Expected: FAIL.

- [ ] **Step 3: extrair/adaptar apenas serviços genéricos da origem**

Não incluir snapshot fiscal nem referência a artefatos NFC-e no diagnóstico.

- [ ] **Step 4: executar gates**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add js/core/backup js/core/observability js/core/erp-runtime.js test/backup-observability.test.js
git commit -m "feat: add ERP backup and diagnostics"
```

### Task 16: Licenças, proveniência, capacidades comerciais e release

**Files:**
- Create: `docs/provenance.md`
- Create: `docs/operations.md`
- Create: `release/customer-capabilities.json`
- Create: `scripts/check-customer-capabilities.js`
- Create: `scripts/check-licenses.js`
- Create: `test/release-contract.test.js`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Manifesto comercial contém somente capacidades implementadas e testadas.
- Proveniência registra origem e commit de cada arquivo/módulo extraído.
- Gate de licença falha para dependência sem licença conhecida antes do release comercial.

- [ ] **Step 1: inventariar proveniência real**

Registrar explicitamente origem `PDV-ARTISYS`, branch/commit usado para cada grupo migrado e, quando aplicável, origem `utilidades`. Não registrar módulos excluídos como parte do ERP.

- [ ] **Step 2: escrever teste de contrato de release**

```js
test('commercial capabilities never advertise excluded PDV features', () => {
  const caps = JSON.parse(fs.readFileSync('release/customer-capabilities.json','utf8'));
  const text = JSON.stringify(caps).toLowerCase();
  for (const forbidden of ['restaurante','comanda','nfce','nfc-e','balcao','gaveta','pizzaria','autoatendimento']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
```

- [ ] **Step 3: criar manifesto somente com funcionalidades aprovadas**

Incluir cadastros, estoque, compras, vendas administrativas, financeiro P0–P3, relatórios, backup e operação local. Emissão fiscal deve estar ausente ou marcada explicitamente como não incluída, nunca como disponível.

- [ ] **Step 4: adicionar `release:check`**

```json
"release:check": "npm run verify && node scripts/check-licenses.js && node scripts/check-customer-capabilities.js && npm run qa:release"
```

- [ ] **Step 5: executar release gates**

Run: `npm run release:check`

Expected: PASS.

Run: `npm run dist:win`

Expected: gerar `dist/ArtiSys-ERP-0.1.0-x64-Setup.exe` sem `serialport`, fiscal sidecar, ACBr ou artefatos `ArtiSys-PDV`.

- [ ] **Step 6: inspecionar conteúdo empacotado**

Abrir `app.asar`/lista do artefato e verificar que não existem paths `restaurant`, `cash`, `pizzeria`, `self-service`, `fiscal`, `serialport` ou `pdv-runtime`.

- [ ] **Step 7: teste em máquina limpa**

Instalar sem internet, iniciar, criar usuário/admin, cadastrar produto/cliente/fornecedor, registrar compra, faturar venda administrativa, criar/baixar lançamento, importar OFX local, gerar backup e reiniciar. Nenhum passo pode exigir serviço externo.

- [ ] **Step 8: commit**

```bash
git add README.md docs release scripts package.json test/release-contract.test.js
git commit -m "docs: finalize ERP commercial release contract"
```

---

## Sequência de integração e gates finais

Executar as tasks em ordem. Cada task precisa terminar com `npm run verify` verde antes da próxima. Ao concluir as 16 tasks:

```bash
npm run verify
npm run qa:full
npm run release:check
npm run dist:win
```

Critério final de aceite:

- `createErpRuntime()` inicializa sozinho com banco novo.
- Nenhum import/empacotamento de runtime ou módulos exclusivos do PDV.
- Compras atualizam estoque e contas a pagar de forma atômica.
- Vendas administrativas atualizam estoque e contas a receber sem terminal/caixa/checkout.
- Financeiro P0–P3 mantém DRE, fluxo, OFX, conciliação, transferências, recorrências e alertas.
- UI e API usam identidade ArtiSys ERP.
- QA ERP é separado do QA PDV.
- Installer é `ArtiSys-ERP-*` e funciona offline em máquina limpa.
- `PDV-ARTISYS` permanece sem qualquer write decorrente desta migração.
