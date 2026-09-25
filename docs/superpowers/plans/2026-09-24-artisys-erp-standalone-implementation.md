# ArtiSys ERP Standalone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `ARTISYS_ERP` como produto desktop independente, local-first e vendável, extraindo somente componentes empresariais adequados do `PDV-ARTISYS/feat/erp-p0-p3`, preservando o Financeiro P0–P3 e excluindo por arquitetura qualquer dependência de frente de caixa/PDV.

**Architecture:** O produto terá `createErpRuntime()` próprio sobre `node:sqlite`, autenticação/sessões locais, domínios separados para cadastros, estoque, compras, vendas administrativas, financeiro e relatórios, servidor HTTP local próprio e shell Electron próprio. `PDV-ARTISYS` é fonte somente-leitura durante a extração; nenhum arquivo, branch, PR ou configuração dele será alterado.

**Tech Stack:** Node.js >=22, CommonJS no aplicativo, `node:sqlite`/`DatabaseSync`, `node:test`, Electron 39.x, electron-builder 26.x, Playwright para E2E, JavaScript/HTML/CSS, `@artisys/finance-domain` vendorizado localmente. Nenhuma dependência SaaS obrigatória.

**Spec:** `docs/superpowers/specs/2026-09-24-artisys-erp-standalone-design.md`

## Global Constraints

- O ERP deve ter identidade, runtime, banco, empacotamento, documentação, QA e release próprios.
- O núcleo obrigatório deve operar localmente, inclusive sem internet, e sem serviço pago obrigatório.
- Integrações externas futuras serão opcionais, desligadas por padrão e nunca requisito de startup ou continuidade de operação.
- O ERP não pode importar `createPdvRuntime`, nem depender de `cash`, `restaurant`, `printing` de cupom, `fiscal` NFC-e, `pizzeria`, `delivery` PDV, `self-service`, `serialport`, balança, gaveta ou terminal de PDV.
- Package: `artisys-erp`; product name: `ArtiSys ERP`; app id: `com.artisys.erp`; banco padrão: `data/artisys-erp.sqlite`.
- `PDV-ARTISYS` é somente fonte de leitura. Toda escrita deste plano ocorre exclusivamente em `ARTISYS_ERP`.
- Código extraído deve ser adaptado para interfaces do ERP; não copiar diretórios inteiros do PDV por conveniência.
- Cada módulo migrado deve ter testes, proveniência e licença verificadas antes do release comercial.

## Review Focus

1. **Dependência transitiva de PDV:** qualquer import, string de identidade ou artefato empacotado relacionado aos módulos proibidos deve falhar em `boundary:check`.
2. **Banco limpo:** arquivo inexistente deve produzir schema completo; reexecutar migrations deve ser idempotente.
3. **Atomicidade:** recebimento de compra e faturamento administrativo precisam reverter estoque + financeiro + documento quando qualquer etapa falha.
4. **Idempotência:** recebimentos, faturamentos administrativos, OFX, conciliação, transferências e recorrências não podem duplicar efeitos em retry/restart.
5. **Vendas administrativas:** não podem exigir terminal, sessão de caixa, operador de caixa, `payments`, gaveta ou checkout.
6. **DRE do ERP:** receita/custo deve vir da venda administrativa e de lançamentos financeiros; nunca das tabelas ou labels de venda PDV (`PDV_SALES`, `PDV_COGS`, `Vendas PDV`).
7. **Sessões:** API usa login local + bearer token; não usa token de instalação/terminal do PDV.
8. **Operação offline:** login, cadastros, estoque, compras, vendas, financeiro, relatórios e backup funcionam sem rede externa.

---

# Fase 1 — Fundação standalone

## Task 1: Identidade de produto, dependência financeira vendorizada e gate anti-PDV

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `scripts/check-erp-boundaries.js`
- Create: `scripts/check-js-syntax.js`
- Create: `vendor/artisys-finance-domain/package.json`
- Create: `vendor/artisys-finance-domain/LICENSE`
- Create: `vendor/artisys-finance-domain/src/index.mjs`
- Create: `test/architecture-boundary.test.js`
- Create: `test/finance-domain-vendor.test.js`
- Modify: `README.md`

**Source references (read-only):**
- `PDV-ARTISYS/feat/erp-p0-p3/vendor/artisys-finance-domain/*`
- Upstream provenance currently registrada no PDV: `nutricionistaalmeidavh-spec/utilidades`, commit `9bca8b29f3a5875433b42d01ceb84e743dabba82`.

**Interfaces:**
- Scripts: `test`, `lint`, `boundary:check`, `verify`, `dist:win`.
- Vendor package: `@artisys/finance-domain` 0.1.0, MIT, local `file:vendor/artisys-finance-domain`.

- [ ] **Step 1: escrever testes RED de identidade, fronteira e vendor**

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('package identifies standalone ERP',()=>{
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
  assert.equal(pkg.name,'artisys-erp');
  assert.equal(pkg.build.appId,'com.artisys.erp');
  assert.equal(pkg.build.productName,'ArtiSys ERP');
  assert.equal(pkg.dependencies['@artisys/finance-domain'],'file:vendor/artisys-finance-domain');
  assert.ok(!JSON.stringify(pkg).includes('serialport'));
});

test('finance domain vendor is importable',async()=>{
  const mod=await import('@artisys/finance-domain');
  for(const name of ['sourceFingerprint','businessFingerprint','applyDeterministicRules','suggestReconciliation'])
    assert.equal(typeof mod[name],'function');
});
```

- [ ] **Step 2: rodar RED**

Run: `node --test test/architecture-boundary.test.js test/finance-domain-vendor.test.js`

Expected: FAIL porque package/vendor ainda não existem.

- [ ] **Step 3: criar package mínimo do ERP**

Dependências obrigatórias:

```json
"dependencies": {
  "@artisys/finance-domain": "file:vendor/artisys-finance-domain"
}
```

Dev dependencies:

```json
"devDependencies": {
  "electron": "^39.8.10",
  "electron-builder": "^26.0.12",
  "playwright": "1.63.0"
}
```

Build identity:

```json
"build": {
  "appId": "com.artisys.erp",
  "productName": "ArtiSys ERP",
  "asar": true,
  "directories": {"output":"dist"},
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
    "target":[{"target":"nsis","arch":["x64"]}],
    "artifactName":"ArtiSys-ERP-${version}-${arch}-Setup.${ext}"
  }
}
```

- [ ] **Step 4: copiar exatamente o finance-domain aprovado e instalar localmente**

Copiar somente `package.json`, `LICENSE`, `src/index.mjs` do vendor validado, sem módulos PDV adjacentes.

Run: `npm install`

Expected: `node_modules/@artisys/finance-domain` resolvido localmente; nenhuma rede necessária em runtime.

- [ ] **Step 5: implementar gate anti-PDV**

`scripts/check-erp-boundaries.js` percorre `js`, `server`, `desktop` e `package.json`; ignora `docs` e fixtures de teste; falha para ocorrências/imports de:

```js
[
  'createPdvRuntime','pdv-runtime','/cash/','/restaurant/','/printing/',
  '/fiscal/','/pizzeria/','/delivery/','/self-service/','serialport',
  'pdv-artisys.sqlite','com.artisys.pdv','ArtiSys PDV','Terminal PDV'
]
```

O teste cria fixture temporária com `require('../domains/cash/cash-service')` e exige exit code 1; o tree real exige exit code 0.

- [ ] **Step 6: implementar lint sintático recursivo**

`scripts/check-js-syntax.js` usa `node --check` em `.js/.cjs` de `js`, `server`, `desktop`, `scripts`, `test`.

- [ ] **Step 7: rodar GREEN**

Run: `npm run boundary:check && npm run lint && npm test`

Expected: PASS.

- [ ] **Step 8: commit**

```bash
git add package.json package-lock.json .gitignore README.md scripts vendor/artisys-finance-domain test/architecture-boundary.test.js test/finance-domain-vendor.test.js
git commit -m "chore: bootstrap standalone ArtiSys ERP"
```

## Task 2: Banco transacional e migrations próprias do ERP

**Files:**
- Create: `js/core/database/sqlite-database.js`
- Create: `js/core/database/migration-runner.js`
- Create: `js/core/database/migrations/001-core.js`
- Create: `js/core/database/migrations/index.js`
- Create: `test/database-foundation.test.js`

**Interfaces:** `openDatabase(filename)`, `withTransaction(db,fn)`, `runErpMigrations(db,now)`.

- [ ] **Step 1: escrever testes RED para banco limpo, idempotência e savepoint**

Testar `users`, `audit_log`, `settings`, `schema_migrations`; rodar migrations duas vezes; testar rollback de transação aninhada.

- [ ] **Step 2: rodar RED**

Run: `node --test test/database-foundation.test.js`

Expected: FAIL.

- [ ] **Step 3: extrair somente `sqlite-database.js` genérico**

Referência somente-leitura: `PDV-ARTISYS/feat/erp-p0-p3/js/core/database/sqlite-database.js`.

Preservar `DatabaseSync`, `foreign_keys`, `busy_timeout`, WAL para arquivo, savepoints e rejeição de callback async. Não copiar migrations do PDV.

- [ ] **Step 4: implementar runner versionado**

```js
function runMigrations(db,migrations,now=()=>new Date().toISOString()){
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  for(const migration of migrations){
    if(db.prepare('SELECT 1 FROM schema_migrations WHERE id=?').get(migration.id))continue;
    withTransaction(db,()=>{
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations(id,applied_at) VALUES(?,?)').run(migration.id,now());
    });
  }
}
```

- [ ] **Step 5: criar `001-core.js` somente com usuários, auditoria e settings**

Nenhuma tabela de cash, terminal, restaurante, fiscal ou checkout.

- [ ] **Step 6: rodar GREEN + boundary**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add js/core/database test/database-foundation.test.js
git commit -m "feat: add ERP database foundation"
```

## Task 3: Auth local, sessões bearer, RBAC, auditoria e settings

**Files:**
- Create: `js/core/auth/password.js`
- Create: `js/core/auth/auth-service.js`
- Create: `js/core/auth/session-service.js`
- Create: `js/core/auth/rbac.js`
- Create: `js/core/audit/audit-log.js`
- Create: `js/core/settings/settings-service.js`
- Modify: `js/core/database/migrations/001-core.js`
- Create: `test/auth-session-rbac-audit.test.js`

**Interfaces:**
- `createAuthService({db,now,idFactory})`: `createUser`, `authenticate`, `getUser`, `listUsers`, `setUserActive`.
- `createSessionService({now,ttlMs})`: `create(actor)`, `resolve(token)`, `revoke(token)`, `prune()`.
- Actor: `{userId,role:'admin'|'manager'|'operator'}`.

- [ ] **Step 1: testes RED**

Cobrir bootstrap do primeiro admin, senha scrypt, credencial inválida, usuário inativo, expiração/revogação de sessão, RBAC e auditoria sem hash/senha.

- [ ] **Step 2: rodar RED**

Run: `node --test test/auth-session-rbac-audit.test.js`

Expected: FAIL.

- [ ] **Step 3: implementar senha local**

Formato: `scrypt$<salt-hex>$<hash-hex>`; `timingSafeEqual`; nunca logar senha/hash.

- [ ] **Step 4: implementar sessão em memória**

Token: `randomBytes(32).toString('hex')`; TTL padrão 12h. A sessão contém apenas ator e expiração. Reinício exige novo login, sem afetar dados.

- [ ] **Step 5: implementar RBAC/audit/settings**

`assertRole(actor,allowedRoles)`. Ações sensíveis registram `actor_user_id`, `actor_role`, entidade, action, JSON de contexto sanitizado.

- [ ] **Step 6: rodar GREEN**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add js/core/auth js/core/audit js/core/settings js/core/database/migrations/001-core.js test/auth-session-rbac-audit.test.js
git commit -m "feat: add local authentication sessions and RBAC"
```

## Task 4: `createErpRuntime()` e servidor local com login próprio

**Files:**
- Create: `js/core/erp-runtime.js`
- Create: `server/http-utils.js`
- Create: `server/auth-context.js`
- Create: `server/routers/auth-router.js`
- Create: `server/local-server.js`
- Create: `server/start.js`
- Create: `test/erp-runtime.test.js`
- Create: `test/auth-api.test.js`

**Interfaces:**
- `createErpRuntime({dbPath=':memory:',now,idFactory})` inicialmente retorna `{db,auth,settings,close}`.
- `POST /api/v1/auth/login` -> `{token,user:{id,name,role}}`.
- `POST /api/v1/auth/logout` revoga bearer atual.
- `GET /api/v1/health` é público e retorna `{ok:true,product:'artisys-erp'}`.
- `resolveActor(req,sessions)` lê apenas `Authorization: Bearer ...`.

- [ ] **Step 1: testes RED**

Testar runtime em banco vazio sem acesso externo; login admin; 401 sem bearer; sessão válida; logout; health.

- [ ] **Step 2: rodar RED**

Run: `node --test test/erp-runtime.test.js test/auth-api.test.js`

Expected: FAIL.

- [ ] **Step 3: implementar runtime mínimo**

Nenhum import de módulo PDV. `server/start.js` usa `ERP_HOST`, `ERP_PORT`, `ERP_DB_PATH`; default `data/artisys-erp.sqlite`.

- [ ] **Step 4: implementar servidor/auth router**

Não usar `x-pdv-token`, terminal registry, installation token ou autorização de terminal.

- [ ] **Step 5: rodar GREEN**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add js/core/erp-runtime.js server test/erp-runtime.test.js test/auth-api.test.js
git commit -m "feat: add standalone ERP runtime and authenticated local server"
```

---

# Fase 2 — Núcleo operacional do ERP

## Task 5: Financeiro base e dimensões gerenciais

**Files:**
- Create: `js/core/database/migrations/010-finance.js`
- Modify: `js/core/database/migrations/index.js`
- Create: `js/domains/shared/money.js`
- Create: `js/domains/finance/finance-dimensions.js`
- Create: `js/domains/finance/finance-service.js`
- Create: `test/finance-base.test.js`
- Modify: `js/core/erp-runtime.js`

**Interfaces:**
- `createFinanceDimensionsService({db,now,idFactory})`.
- `createFinanceService({db,dimensions,now,idFactory})` preserva contas, pagar/receber, baixas, estorno, cancelamento e resumo.

- [ ] **Step 1: portar testes funcionais antes do código**

Cobrir contas, payable/receivable, baixa parcial/total, excesso de baixa, estorno, cancelamento, vencido, categoria, centro de custo, competência e auditoria.

- [ ] **Step 2: rodar RED**

Run: `node --test test/finance-base.test.js`

Expected: FAIL.

- [ ] **Step 3: criar migration própria**

Criar somente: `financial_accounts`, `financial_entries`, `financial_settlements`, `finance_dre_groups`, `financial_categories`, `cost_centers`, `financial_entry_dimensions` + índices e seeds estáveis.

- [ ] **Step 4: migrar serviços da origem ajustando imports**

Referências read-only:
- `js/domains/finance/finance-service.js`
- `js/domains/finance/finance-dimensions.js`

Trocar `../../core/audit-log` por `../../core/audit/audit-log`. Não copiar `pdv-finance-extension.js`.

- [ ] **Step 5: integrar diretamente ao `createErpRuntime()`**

```js
const financeDimensions=createFinanceDimensionsService(common);
const finance=createFinanceService({...common,dimensions:financeDimensions});
```

- [ ] **Step 6: rodar GREEN**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add js/core/database/migrations js/domains/shared js/domains/finance js/core/erp-runtime.js test/finance-base.test.js
git commit -m "feat: add ERP finance foundation"
```

## Task 6: Cadastros, catálogo e estoque mínimos

**Files:**
- Create: `js/core/database/migrations/020-master-data.js`
- Create: `js/core/database/migrations/021-inventory.js`
- Modify: `js/core/database/migrations/index.js`
- Create: `js/domains/contacts/contact-service.js`
- Create: `js/domains/catalog/catalog-service.js`
- Create: `js/domains/inventory/inventory-rules.js`
- Create: `js/domains/inventory/inventory-service.js`
- Create: `js/domains/inventory/inventory-logistics-service.js`
- Create: `test/master-data-inventory.test.js`
- Modify: `js/core/erp-runtime.js`

**Interfaces:**
- Clientes e fornecedores persistidos localmente.
- Produtos/categorias com `costCents`, `salePriceCents`, `trackStock`.
- Estoque: `move`, `getBalance`, `listMovements`.
- Logística: reserva, consumo e liberação de reserva por `sourceType/sourceId`.

- [ ] **Step 1: testes RED de integridade e reserva**

Produto inexistente não movimenta; fornecedor/cliente inativo rejeitado; estoque rastreado não fica negativo; reserva acima do disponível falha; release/consume preserva saldo correto.

- [ ] **Step 2: rodar RED**

Run: `node --test test/master-data-inventory.test.js`

Expected: FAIL.

- [ ] **Step 3: extrair somente regras genéricas necessárias**

Pode consultar os módulos `utilidades` e código PDV, mas não copiar kits/combo, receita culinária, promoções, variantes exclusivas de balcão ou efeitos de venda PDV.

- [ ] **Step 4: integrar runtime em ordem**

`contacts -> catalog -> inventory -> inventoryLogistics`.

- [ ] **Step 5: rodar GREEN**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add js/core/database/migrations js/domains/contacts js/domains/catalog js/domains/inventory js/core/erp-runtime.js test/master-data-inventory.test.js
git commit -m "feat: add ERP master data and inventory"
```

## Task 7: Compras -> estoque -> contas a pagar

**Files:**
- Create: `js/core/database/migrations/030-procurement.js`
- Modify: `js/core/database/migrations/index.js`
- Create: `js/domains/procurement/procurement-service.js`
- Create: `test/procurement.test.js`
- Modify: `js/core/erp-runtime.js`

**Interfaces:** `createPurchaseOrder`, `submitPurchaseOrder`, `receivePurchaseOrder`, `getPurchaseOrder`, `listPurchaseOrders`, `listReceipts`.

- [ ] **Step 1: testes RED incluindo atomicidade e idempotência**

Obrigatórios:
- manager/admin para mutações;
- recebimento parcial/total;
- idempotencyKey repetida retorna mesmo recibo;
- custo médio atualizado;
- `PAYABLE` criado com `sourceType:'purchase-receipt'`;
- falha de `finance.createEntry` reverte movimento de estoque e receipt.

- [ ] **Step 2: rodar RED**

Run: `node --test test/procurement.test.js`

Expected: FAIL.

- [ ] **Step 3: adaptar procurement da origem**

Referência: `PDV-ARTISYS/feat/erp-p0-p3/js/domains/procurement/procurement-service.js`.

Dependências permitidas: DB, audit, money, inventory, contacts/fornecedor, catálogo e finance. Nenhuma venda/cash/printing.

- [ ] **Step 4: rodar GREEN**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add js/core/database/migrations js/domains/procurement js/core/erp-runtime.js test/procurement.test.js
git commit -m "feat: add ERP procurement flow"
```

## Task 8: Vendas administrativas sem checkout e com snapshot de custo

**Files:**
- Create: `js/core/database/migrations/040-sales-admin.js`
- Modify: `js/core/database/migrations/index.js`
- Create: `js/domains/sales-admin/sales-admin-service.js`
- Create: `test/sales-admin.test.js`
- Modify: `js/core/erp-runtime.js`

**Schema mínimo:**
- `sales_admin_orders`
- `sales_admin_order_items`
- `sales_admin_invoices`
- `sales_admin_invoice_items`

`invoice_items` deve persistir `unit_price_cents`, `total_cents`, `unit_cost_cents`, `total_cost_cents` como snapshot histórico.

**Interfaces:**
- `createQuote`, `confirmOrder`, `cancelOrder`, `invoiceOrder`, `getOrder`, `listOrders`, `listInvoices`.
- `invoiceOrder(id,{items,dueAt,accountId,idempotencyKey},actor)`.

- [ ] **Step 1: testes RED do novo contrato**

Cobrir orçamento, confirmação/reserva, faturamento parcial/total, idempotência, cancelamento, snapshot de custo e rollback completo se o recebível falhar.

Teste obrigatório: chamar `invoiceOrder` sem `terminalId`, `operatorId`, `payments` ou sessão de caixa e validar `RECEIVABLE`.

- [ ] **Step 2: rodar RED**

Run: `node --test test/sales-admin.test.js`

Expected: FAIL.

- [ ] **Step 3: reaproveitar somente conceitos seguros da origem**

Referência read-only: `PDV-ARTISYS/feat/erp-p0-p3/js/domains/orders/sales-order-service.js`.

Não copiar `fulfillOrder` existente: ele abre sale do PDV e exige terminal/operador/pagamentos.

- [ ] **Step 4: implementar `invoiceOrder` transacional**

Na mesma transação:
1. validar pedido/itens/idempotencyKey;
2. consumir reserva e movimentar estoque;
3. capturar custo atual do produto em `sales_admin_invoice_items`;
4. gravar invoice;
5. criar `RECEIVABLE` com `categoryId:'SALES'`, `sourceType:'sales-admin-invoice'`, `sourceId:invoiceId`;
6. vincular `receivable_entry_id` à invoice;
7. atualizar quantidades faturadas/status do pedido;
8. auditar.

- [ ] **Step 5: rodar GREEN + boundary**

Run: `npm run verify`

Expected: PASS e nenhuma referência a `sale-service`, cash ou checkout.

- [ ] **Step 6: commit**

```bash
git add js/core/database/migrations js/domains/sales-admin js/core/erp-runtime.js test/sales-admin.test.js
git commit -m "feat: add administrative sales without checkout"
```

---

# Fase 3 — Gestão financeira, automação, API e relatórios

## Task 9: Relatórios operacionais + DRE/fluxo sem semântica PDV

**Files:**
- Create: `js/domains/reports/reporting-service.js`
- Create: `js/domains/finance/finance-management.js`
- Create: `test/reporting-management.test.js`
- Modify: `js/core/erp-runtime.js`

**Interfaces:**
- `createReportingService({db,now})`: `buildSalesSummary`, compras, estoque e relatórios operacionais.
- `createFinanceManagementService({db,finance,reports,dimensions,now})`: `dre`, `cashflow`, `dashboard`, `compare`, `drilldown`, `byCategory`, `byCostCenter`.

- [ ] **Step 1: testes RED com ciclo administrativo real**

Criar compra + invoice administrativa + baixa; validar:
- receita = total faturado administrativo;
- custo = snapshot `total_cost_cents` das invoices;
- margem = receita - custo;
- DRE competência/cash correta;
- estorno financeiro remove apenas realização de caixa;
- labels/grupos não contêm `PDV_SALES`, `PDV_COGS`, `Vendas PDV`.

- [ ] **Step 2: rodar RED**

Run: `node --test test/reporting-management.test.js`

Expected: FAIL.

- [ ] **Step 3: implementar reporting sobre tabelas ERP**

`buildSalesSummary({from,to})` lê `sales_admin_invoices` e snapshots de custo. Não consultar tabelas de venda PDV.

- [ ] **Step 4: adaptar finance-management da origem removendo PDV**

Referência read-only: `js/domains/finance/finance-management.js`.

Remover completamente `PDV_SALES`, `PDV_COGS`, filtros especiais para `source_type==='sale'|'sale-payment'`. O summary operacional vem de `reports.buildSalesSummary` do ERP; lançamentos financeiros manuais/compra/recorrência continuam classificados por dimensões.

- [ ] **Step 5: integrar runtime**

Ordem: `reports -> financeManagement` após sales-admin estar disponível.

- [ ] **Step 6: rodar GREEN**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add js/domains/reports js/domains/finance/finance-management.js js/core/erp-runtime.js test/reporting-management.test.js
git commit -m "feat: add ERP reporting and financial management"
```

## Task 10: OFX, conciliação, transferências, recorrências e alertas

**Files:**
- Create: `js/core/database/migrations/050-finance-automation.js`
- Modify: `js/core/database/migrations/index.js`
- Create: `js/domains/finance/ofx-parser.js`
- Create: `js/domains/finance/statement-import.js`
- Create: `js/domains/finance/reconciliation.js`
- Create: `js/domains/finance/recurrence.js`
- Create: `js/domains/finance/finance-alerts.js`
- Create: `test/finance-automation.test.js`
- Modify: `js/core/erp-runtime.js`

**Interfaces:**
- `createStatementImportService({db,finance,now,idFactory})`.
- `createReconciliationService({db,finance,statements,now,idFactory})`.
- `createRecurrenceService({db,finance,now,idFactory})`.
- `createFinanceAlertService({db,finance,financeManagement,settings,now})`.

- [ ] **Step 1: testes RED**

Casos obrigatórios:
- OFX preview não grava nem baixa;
- commit repetido não duplica; FITIDs diferentes com mesmo valor/descrição coexistem;
- sugestão de conciliação não baixa; confirmação explícita baixa;
- retry da confirmação não duplica settlement;
- transferência entre duas contas próprias não cria receita/despesa;
- recorrência dia 31 ajusta fim do mês e é idempotente após reabrir DB;
- ler/ocultar alerta não altera `financial_entries`, settlements ou resumo.

- [ ] **Step 2: rodar RED**

Run: `node --test test/finance-automation.test.js`

Expected: FAIL.

- [ ] **Step 3: criar migration 050**

Criar `bank_statement_batches`, `bank_statement_transactions`, `finance_reconciliations`, `financial_transfers`, `finance_recurring_rules`, `finance_recurrence_occurrences`, `finance_alert_state` + chaves únicas de idempotência.

- [ ] **Step 4: migrar/adaptar serviços da origem**

Referências read-only:
- `ofx-parser.js`
- `statement-import.js`
- `reconciliation.js`
- `recurrence.js`
- `finance-alerts.js`

Imports de audit/database devem apontar para core do ERP. `statement-import` usa o vendor local `@artisys/finance-domain` para fingerprints/classificação. Não importar `pdv-finance-extension.js`.

- [ ] **Step 5: integrar nativamente ao runtime**

```js
const bankStatements=createStatementImportService({...common,finance});
const financeReconciliation=createReconciliationService({...common,finance,statements:bankStatements});
const financeRecurrences=createRecurrenceService({...common,finance});
const financeAlerts=createFinanceAlertService({db,finance,financeManagement,settings,now});
```

- [ ] **Step 6: rodar GREEN**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add js/core/database/migrations js/domains/finance js/core/erp-runtime.js test/finance-automation.test.js
git commit -m "feat: add ERP financial automation"
```

## Task 11: API standalone para cadastros, estoque, compras, vendas, financeiro e relatórios

**Files:**
- Create: `server/routers/master-data-router.js`
- Create: `server/routers/inventory-router.js`
- Create: `server/routers/procurement-router.js`
- Create: `server/routers/sales-admin-router.js`
- Create: `server/routers/finance-router.js`
- Create: `server/routers/reporting-router.js`
- Modify: `server/local-server.js`
- Create: `test/api-contract.test.js`

**Namespace:** `/api/v1/...`.

- [ ] **Step 1: testes RED de auth/RBAC e rotas**

Validar 401 sem bearer, 403 por role, 2xx para role correta; corpo inválido -> 400; conflito idempotente -> resposta previsível; erro interno não vaza stack.

- [ ] **Step 2: rodar RED**

Run: `node --test test/api-contract.test.js`

Expected: FAIL.

- [ ] **Step 3: implementar routers sem extensão PDV**

`finance-router.js` recebe `runtime` já composto. Não chamar `ensurePdvFinance`, não usar `PdvFinanceHttpError`, terminal registry ou `x-pdv-token`.

Rotas mínimas:
- `/api/v1/customers`, `/suppliers`, `/products`;
- `/api/v1/inventory/...`;
- `/api/v1/procurement/...`;
- `/api/v1/sales/quotes`, `/orders/:id/confirm`, `/orders/:id/invoice`;
- `/api/v1/finance/accounts`, `/entries`, `/summary`, `/dre`, `/cashflow`, `/compare`;
- `/api/v1/finance/statements/preview`, `/statements/:id/commit`, `/statement-transactions`;
- `/api/v1/finance/reconciliation/...`, `/transfers/...`, `/recurrences/...`, `/alerts/...`;
- `/api/v1/reports/...`.

- [ ] **Step 4: rodar GREEN**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add server test/api-contract.test.js
git commit -m "feat: expose standalone ERP API"
```

---

# Fase 4 — Desktop, resiliência, QA e release

## Task 12: Shell Electron próprio do ERP

**Files:**
- Create: `desktop/main.cjs`
- Create: `desktop/preload.cjs`
- Create: `desktop/import-bridge.cjs`
- Create: `desktop/renderer/index.html`
- Create: `desktop/renderer/app.js`
- Create: `desktop/renderer/api-client.js`
- Create: `desktop/renderer/styles.css`
- Create: `test/desktop-identity.test.js`

**Navigation:** Dashboard, Cadastros, Estoque, Compras, Vendas, Financeiro, Relatórios, Configurações.

- [ ] **Step 1: testes RED de identidade e bridge**

HTML contém `ArtiSys ERP`; não contém Terminal PDV/Balcão/Comanda/Restaurante/Abrir caixa. Import picker aceita `.ofx` UTF-8 e arquivos locais necessários, com limite de tamanho e sender confiável.

- [ ] **Step 2: rodar RED**

Run: `node --test test/desktop-identity.test.js`

Expected: FAIL.

- [ ] **Step 3: implementar shell e API client**

Desktop sobe o servidor local, resolve porta e aponta a UI apenas para `127.0.0.1`. Nenhuma URL externa no startup. `preload` não expõe serial/hardware/fiscal.

- [ ] **Step 4: implementar telas mínimas de cada módulo**

Cada tela deve operar pela API real; nada de mocks no build de produção.

- [ ] **Step 5: smoke manual**

Run: `npm run start:desktop`

Expected: janela ArtiSys ERP, login local, health verde, navegação sem erros de console.

- [ ] **Step 6: rodar gates**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add desktop test/desktop-identity.test.js package.json
git commit -m "feat: add standalone ERP desktop shell"
```

## Task 13: Backup, restore, logs, health e diagnóstico sanitizado

**Files:**
- Create: `js/core/backup/backup-service.js`
- Create: `js/core/observability/system-logger.js`
- Create: `js/core/observability/system-health.js`
- Create: `js/core/observability/diagnostic-package.js`
- Create: `test/backup-observability.test.js`
- Modify: `js/core/erp-runtime.js`

- [ ] **Step 1: testes RED**

Criar DB em diretório temporário, inserir cliente/compra/venda/lancamento, gerar backup, modificar, restaurar em nova instância e validar snapshot original. Diagnóstico não pode conter password hash, bearer token ou conteúdo bruto de OFX.

- [ ] **Step 2: rodar RED**

Run: `node --test test/backup-observability.test.js`

Expected: FAIL.

- [ ] **Step 3: extrair/adaptar somente serviços genéricos**

Não incluir snapshot fiscal, arquivos NFC-e, ACBr ou paths do PDV.

- [ ] **Step 4: rodar GREEN**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add js/core/backup js/core/observability js/core/erp-runtime.js test/backup-observability.test.js
git commit -m "feat: add ERP backup and diagnostics"
```

## Task 14: QA E2E exclusivamente ERP

**Files:**
- Create: `qa/artisys-qa.config.json`
- Create: `qa/runtime/erp-qa.mjs`
- Create: `qa/flows/smoke.json`
- Create: `qa/flows/inventory-e2e.json`
- Create: `qa/flows/procurement-e2e.json`
- Create: `qa/flows/sales-admin-e2e.json`
- Create: os 18 fluxos financeiros listados abaixo
- Create: `test/qa-config.test.js`
- Modify: `package.json`

**18 finance flows exatos a migrar/adaptar:**
1. `finance-management-base-e2e`
2. `finance-source-link-e2e`
3. `finance-dimensions-e2e`
4. `finance-base-idempotency-e2e`
5. `business-dashboard-e2e`
6. `dre-e2e`
7. `cashflow-e2e`
8. `period-comparison-e2e`
9. `cost-center-e2e`
10. `statement-ofx-e2e`
11. `statement-dedupe-e2e`
12. `reconciliation-payable-e2e`
13. `reconciliation-receivable-e2e`
14. `bank-transfer-e2e`
15. `finance-recurrence-e2e`
16. `recurrence-idempotency-e2e`
17. `financial-alerts-e2e`
18. `cash-projection-e2e`

- [ ] **Step 1: teste RED de registry**

Validar `systemId === 'artisys-erp'`; todos os 22 fluxos acima (`smoke`, inventory, procurement, sales-admin + 18 finance) existem; `release.criticalFlows` inclui os 18 financeiros e os 3 fluxos operacionais; nenhum ID/path contém `checkout`, `restaurant`, `pizzeria`, `fiscal`, `cashier`, `self-service`.

- [ ] **Step 2: rodar RED**

Run: `node --test test/qa-config.test.js`

Expected: FAIL.

- [ ] **Step 3: criar config ERP limpa**

Environment usa apenas `NODE_ENV=test`, `ARTISYS_QA=1` e variáveis `ERP_*` necessárias. Não usar `PDV_ENABLE_LAN`, `PDV_AUTO_PRINT` ou terminal PDV.

- [ ] **Step 4: adaptar os 18 fluxos financeiros para UI/API standalone**

Manter os invariantes funcionais do P0–P3; substituir seletores e helpers `Pdv*` por contratos próprios do ERP.

- [ ] **Step 5: criar E2E operacional**

`inventory-e2e`: cadastro -> entrada -> reserva/liberação.

`procurement-e2e`: fornecedor -> pedido -> recebimento -> estoque -> payable.

`sales-admin-e2e`: cliente -> orçamento -> confirmação -> invoice -> estoque -> receivable; assert ausência de terminal/caixa.

- [ ] **Step 6: scripts de QA**

```json
"qa:quick":"node qa/runtime/erp-qa.mjs quick --config qa/artisys-qa.config.json",
"qa:full":"node qa/runtime/erp-qa.mjs full --config qa/artisys-qa.config.json",
"qa:release":"node qa/runtime/erp-qa.mjs release --config qa/artisys-qa.config.json"
```

- [ ] **Step 7: rodar QA**

Run: `npm run qa:quick && npm run qa:full`

Expected: PASS.

- [ ] **Step 8: commit**

```bash
git add qa package.json test/qa-config.test.js
git commit -m "test: add standalone ERP E2E gates"
```

## Task 15: Proveniência, licenças, capacidades comerciais e installer

**Files:**
- Create: `docs/provenance.md`
- Create: `docs/operations.md`
- Create: `release/customer-capabilities.json`
- Create: `scripts/check-customer-capabilities.js`
- Create: `scripts/check-licenses.js`
- Create: `test/release-contract.test.js`
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: registrar proveniência real**

Para cada grupo extraído, registrar repositório, ref/commit de origem e arquivos adaptados. Incluir `@artisys/finance-domain` com licença MIT e upstream `utilidades` commit `9bca8b29f3a5875433b42d01ceb84e743dabba82`. Não registrar módulos PDV excluídos como capacidades ERP.

- [ ] **Step 2: teste RED do contrato comercial**

Manifesto deve conter apenas cadastros, estoque, compras, vendas administrativas, Financeiro P0–P3, relatórios, backup e operação local. Deve rejeitar termos/capacidades de restaurante, comanda, NFC-e, balcão, gaveta, pizzaria, autoatendimento ou terminal PDV.

- [ ] **Step 3: implementar gate de licença**

Verificar package dependencies e vendors. Release falha se dependência sem licença conhecida ou se serviço pago for obrigatório para core.

- [ ] **Step 4: adicionar release gate**

```json
"release:check":"npm run verify && node scripts/check-licenses.js && node scripts/check-customer-capabilities.js && npm run qa:release"
```

- [ ] **Step 5: rodar verificação completa**

Run: `npm run release:check`

Expected: PASS.

Run: `npm run dist:win`

Expected: `dist/ArtiSys-ERP-<version>-x64-Setup.exe`.

- [ ] **Step 6: inspecionar artefato empacotado**

Listar conteúdo do `app.asar`/resources e falhar se houver `restaurant`, `cash-service`, `pizzeria`, `self-service`, `fiscal`, `serialport`, `pdv-runtime`, `ArtiSys-PDV`.

- [ ] **Step 7: teste em máquina limpa/offline**

Instalar sem internet, criar admin, cadastrar cliente/fornecedor/produto, receber compra, faturar venda administrativa, criar/baixar lançamento, importar OFX, conciliar manualmente, gerar backup e reiniciar. Nenhum passo pode pedir serviço externo.

- [ ] **Step 8: commit**

```bash
git add README.md docs release scripts package.json test/release-contract.test.js
git commit -m "docs: finalize standalone ERP release contract"
```

---

# Gate final

Após todas as tasks:

```bash
npm run boundary:check
npm run verify
npm run qa:full
npm run release:check
npm run dist:win
```

**Critério final de aceite:**

- `createErpRuntime()` cria e abre um ERP completo a partir de banco inexistente.
- Login/sessão são próprios do ERP e não dependem de terminal ou installation token.
- Nenhum módulo/runtime exclusivo de PDV está importado ou empacotado.
- Compras atualizam estoque + contas a pagar atomicamente.
- Vendas administrativas reservam/baixam estoque, salvam snapshot de custo e geram contas a receber sem checkout/caixa.
- DRE/fluxo usam dados do ERP e nunca `PDV_SALES`/`PDV_COGS`.
- OFX/Conciliação/Transferências/Recorrências/Alertas mantêm os invariantes P0–P3 e idempotência.
- QA usa `systemId: artisys-erp` e não registra flows PDV.
- Installer tem identidade ArtiSys ERP e funciona offline em máquina limpa.
- `PDV-ARTISYS` permanece sem qualquer write decorrente desta migração.
