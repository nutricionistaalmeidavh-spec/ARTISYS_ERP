# Fiscal Interoperability P0/P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar o Fiscal Core aos fluxos de PDV, vendas administrativas, OS, devoluções, compras e transferências, com isolamento multiempresa e snapshots imutáveis, sem implementar ou duplicar a infraestrutura ACBr/SEFAZ da PR #17.

**Architecture:** Evoluir o schema/core fiscal para ser company-scoped e aceitar `nfce|nfe|nfse`, acrescentar ownership mínimo às origens legadas que ainda não carregam empresa, e criar `fiscal-interoperability-service.js` como camada neutra que resolve entidades existentes e produz intents/snapshots fiscais sem tocar estoque ou financeiro. A API `/api/v1/tax/*` expõe estado/preparação por origem e as UIs existentes apenas acionam/mostram esse estado; provider, sidecar, certificado, transporte, contingência e packaging permanecem responsabilidade exclusiva da PR #17.

**Tech Stack:** Node.js CommonJS, SQLite, HTTP router local, React/TypeScript, renderer desktop legado, Node test runner, Electron E2E, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-26-fiscal-interoperability-p0-p1-design.md`

## Global Constraints

- Não implementar nem modificar `acbr-local-provider`, `server/fiscal-sidecar/**`, `fiscal-runtime/**`, certificado, assinatura, transporte, contingência ou packaging ACBr.
- Não modificar `package.json` para empacotamento fiscal nesta branch; a PR #17 é dona desse boundary.
- Não duplicar estoque, recebíveis, pagamentos, contas a pagar, créditos de fornecedor ou movimentos de transferência.
- Produção/OP não cria documento fiscal diretamente.
- `runtime.fiscal` continua sendo a fonte de verdade dos documentos e lifecycle local; a nova camada de interoperabilidade só resolve origens e prepara snapshots/intents.
- Todos os dados fiscais de configuração, perfil, produto/serviço, sequência e documento devem ser isolados por `company_id`.
- Snapshots fiscais tornam-se imutáveis após a criação do documento.
- Rotas existentes `/api/v1/tax/documents*` e lifecycle/status devem permanecer compatíveis com a futura integração da PR #17.
- Transferência só entra no fiscal quando `fiscalRequired=true`; nenhum motor tributário automático será criado nesta fase.
- Ownership operacional adicional será limitado às origens necessárias para provar isolamento fiscal: venda administrativa e compras.

## Review Focus

1. **Cross-company leakage:** IDs de documento, idempotency keys, perfis, produtos e origens iguais/reutilizados em empresas diferentes nunca podem expor ou sobrescrever dados de outra empresa — Tasks 1, 2 e 3.
2. **Retry/idempotência:** repetir preparação de uma origem, inclusive OS mista, não pode gerar segundo documento nem consumir nova sequência — Tasks 3, 4 e 5.
3. **Snapshot drift:** alterar cliente/produto/perfil depois de preparar o documento não pode mudar `snapshot_json` existente — Task 4.
4. **Fiscal sem efeitos operacionais:** preparar/vincular documentos de venda, OS, devolução, compra ou transferência não pode alterar saldos de estoque nem financeiro — Tasks 4 a 7.
5. **Merge com PR #17:** nenhuma implementação desta branch pode importar provider/sidecar nem exigir que o provider conheça OS, compra ou devolução; o contrato termina em `fiscal_document + snapshot_json` — Tasks 3 e 10.

---

### Task 1: Schema fiscal v2 e upgrade compatível

**Files:**
- Create: `js/core/database/migrations/160-fiscal-interoperability.js`
- Modify: `js/core/database/migrations/index.js`
- Test: `test/fiscal-interoperability-migration.test.js`

**Interfaces:**
- Consumes: schema legado de `120-fiscal-core` e migrations até `151-manufacturing-loss-reservation-guard`.
- Produces: settings/perfis/vínculos/sequências/documentos company-scoped, metadados neutros de serviço, snapshots e suporte a `nfse`.

- [ ] **Step 1: Escrever teste RED de upgrade**

O teste deve criar dados no schema legado e provar após `runErpMigrations()`:
- settings legado preservado em `company_id='default'` e `company_id` único;
- perfis legados recebem `company_id='default'`;
- `product_fiscal_data` passa a ser chaveado por `(company_id, product_id)` e suporta `service_code` + `service_description`;
- sequências passam a ser chaveadas por `(company_id, document_type, environment, series)`;
- documentos legados sobrevivem com `company_id='default'`;
- `document_type` aceita `nfce|nfe|nfse`;
- documentos passam a ter `direction`, `operation_kind`, `snapshot_json`, `parent_document_id`;
- idempotência passa a ser `UNIQUE(company_id,idempotency_key)`;
- origem/documento/operação não duplica dentro da mesma empresa.

- [ ] **Step 2: Rodar o teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-migration.test.js`
Expected: FAIL porque a migration `160-fiscal-interoperability` ainda não existe.

- [ ] **Step 3: Implementar migration `160-fiscal-interoperability`**

Reconstruir somente as tabelas fiscais necessárias, preservando IDs e dados. Source types permitidos:
`POS_SALE`, `ADMIN_INVOICE`, `SERVICE_ORDER_SERVICE`, `SERVICE_ORDER_PARTS`, `POS_RETURN`, `ADMIN_RETURN`, `PURCHASE_RECEIPT`, `PURCHASE_RETURN`, `INVENTORY_TRANSFER`.

Directions: `INBOUND|OUTBOUND`.
Operation kinds: `ISSUE|RETURN|TRANSFER|INBOUND_LINK`.

- [ ] **Step 4: Registrar migration e rodar teste**

Run: `node --test test/fiscal-interoperability-migration.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat: evolve fiscal schema for interoperability"`

---

### Task 2: Ownership multiempresa das origens administrativas/compras

**Files:**
- Create: `js/core/database/migrations/161-fiscal-source-company-ownership.js`
- Modify: `js/core/database/migrations/index.js`
- Modify: `js/domains/sales-admin/sales-admin-service.js`
- Modify: `js/domains/procurement/procurement-service.js`
- Test: `test/fiscal-source-company-ownership.test.js`

**Interfaces:**
- Consumes: `actor.companyId` já usado pelo runtime.
- Produces: `company_id` persistido em `sales_admin_orders`, `sales_admin_invoices`, `purchase_orders`, `purchase_receipts`; getters/listagens usados pelo fiscal podem validar empresa sem inferência insegura.

- [ ] **Step 1: Escrever teste RED de ownership**

Criar duas empresas e provar que uma fatura administrativa e um recebimento de compra criados pela empresa A não são retornados por getters company-scoped da empresa B. Dados legados devem migrar para `default`.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-source-company-ownership.test.js`
Expected: FAIL porque as tabelas/serviços ainda não persistem empresa.

- [ ] **Step 3: Implementar migration e escrita company-scoped**

Adicionar `company_id NOT NULL DEFAULT 'default'` nas quatro tabelas e índices adequados. `createQuote()/invoiceOrder()` e `createPurchaseOrder()/receivePurchaseOrder()` persistem `actor.companyId` e rejeitam encadeamento cross-company.

- [ ] **Step 4: Expor leitura company-scoped sem quebrar callers antigos**

Adicionar actor opcional nos getters/listagens necessários ao fiscal; quando actor existir, filtrar por empresa. Callers legados internos sem actor mantêm compatibilidade somente onde não há boundary de usuário.

- [ ] **Step 5: Rodar teste**

Run: `node --test test/fiscal-source-company-ownership.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -am "feat: scope fiscal source ownership by company"`

---

### Task 3: Fiscal Core multiempresa e primitive de documento preparado

**Files:**
- Modify: `js/domains/tax/tax-service.js`
- Test: `test/fiscal-multicompany.test.js`
- Test: `test/fiscal-core.test.js`

**Interfaces:**
- Consumes: schemas das Tasks 1 e 2.
- Produces:
  - `settings(actorOrCompany)`
  - `saveSettings(input, actor)`
  - `saveProfile(input, actor)` / `listProfiles(actor)`
  - `assignProduct(productId, input, actor)` / `productFiscal(productId, actor)`
  - `createPreparedDocument(intent, actor)`
  - `getDocument(id, actor)` / `listDocuments(filters, actor)`
  - `documentsForSource(sourceType, sourceId, actor)`
  - `transition(id, input, actor)` preservado para PR #17.

- [ ] **Step 1: Escrever testes RED de isolamento/idempotência**

Cobrir duas empresas com configurações/perfis/vínculos diferentes, mesma idempotency key em empresas distintas, sequências independentes, `getDocument()` cross-company bloqueado e produto SERVICE com `serviceCode/serviceDescription` independentes por empresa.

- [ ] **Step 2: Rodar testes e confirmar RED**

Run: `node --test test/fiscal-multicompany.test.js test/fiscal-core.test.js`
Expected: FAIL em settings/perfis/documentos globais.

- [ ] **Step 3: Refatorar `tax-service.js` para company scope**

Todas as queries fiscais usam a empresa ativa. `assignProduct()` aceita `serviceCode` e `serviceDescription` além de profile/GTIN/overrides.

`createPreparedDocument(intent, actor)` recebe:
`sourceType`, `sourceId`, `documentType`, `direction`, `operationKind`, `snapshot`, `parentDocumentId?`, `idempotencyKey`, `initialStatus?`.

`initialStatus` é `PENDING` por padrão; `AUTHORIZED` só é aceito quando `direction='INBOUND'` e `operationKind='INBOUND_LINK'`.

- [ ] **Step 4: Preservar lifecycle da PR #17**

`transition()` continua atualizando status/access key/protocol/XML, sempre company-scoped. Nenhum import de ACBr/Focus/provider.

- [ ] **Step 5: Rodar testes**

Run: `node --test test/fiscal-multicompany.test.js test/fiscal-core.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -am "feat: scope fiscal core by company"`

---

### Task 4: Orquestrador de PDV, venda administrativa e OS

**Files:**
- Create: `js/domains/tax/fiscal-interoperability-service.js`
- Modify: `js/core/erp-runtime.js`
- Test: `test/fiscal-interoperability-sales-service.test.js`

**Interfaces:**
- Consumes: `runtime.fiscal.createPreparedDocument(...)`, `retail`, `salesAdmin`, `serviceOrders`, `catalog`, `contacts` e DB.
- Produces:
  - `inspectSource(sourceType, sourceId, actor) -> {sourceType, sourceId, ready, pendingReasons, documents}`
  - `prepareSource({sourceType, sourceId, idempotencyKey}, actor) -> {documents}`
  - snapshots neutros consumíveis pela PR #17 sem consultar o módulo de origem.

- [ ] **Step 1: Escrever testes RED dos três fluxos**

Cobrir:
- `POS_SALE` → exatamente uma `nfce`;
- `ADMIN_INVOICE` → exatamente uma `nfe`;
- origem de outra empresa → rejeitada;
- OS só serviço → uma `nfse`, exigindo `serviceCode` no readiness;
- OS só peças → uma `nfe` apenas com peças efetivamente consumidas;
- OS mista → dois documentos, e a soma dos snapshots reconcilia com `totalCents`;
- OS não concluída → `ready=false`;
- retry com mesma chave-base não gera documento/sequence extra;
- preparar não muda contagem de movimentos de estoque nem lançamentos financeiros;
- alterar cliente/produto/perfil após preparação não muda snapshot persistido.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-sales-service.test.js`
Expected: FAIL porque o serviço não existe.

- [ ] **Step 3: Implementar resolvers e snapshot builders**

Para OS mista, derivar `${base}:service` e `${base}:parts`. Se uma parcela for zero, não criar o documento correspondente. Snapshot inclui emissor, contraparte, origem, itens, quantidades, valores, total e dados fiscais resolvidos.

- [ ] **Step 4: Registrar `runtime.fiscalInteroperability`**

Instanciar depois de `fiscal`, `retail`, `salesAdmin` e `serviceOrders`, sem interface de provider.

- [ ] **Step 5: Rodar teste**

Run: `node --test test/fiscal-interoperability-sales-service.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -am "feat: prepare fiscal intents for sales and service orders"`

---

### Task 5: Devoluções e relacionamento com documento original

**Files:**
- Modify: `js/domains/tax/fiscal-interoperability-service.js`
- Test: `test/fiscal-interoperability-returns.test.js`

**Interfaces:**
- Consumes: `documentsForSource()`, `POS_RETURN`, `ADMIN_RETURN` e documentos fiscais originais.
- Produces: intents `operationKind='RETURN'` com `parentDocumentId` quando houver original; sem referência inventada quando não houver.

- [ ] **Step 1: Escrever testes RED**

Cobrir:
- devolução PDV relaciona documento original quando existente;
- devolução administrativa relaciona NF-e original;
- sem original, `parentDocumentId=null` e snapshot registra `originalDocumentStatus='NO_ORIGINAL_DOCUMENT'`;
- retry é idempotente;
- preparação não duplica reembolso, estoque ou financeiro.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-returns.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar resolvers de retorno**

Quando houver original, o intent de retorno herda seu `documentType`; sem original, usar `nfe` como intent neutro de retorno e deixar explícita a ausência de documento pai no snapshot.

- [ ] **Step 4: Rodar teste**

Run: `node --test test/fiscal-interoperability-returns.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat: relate fiscal returns to original documents"`

---

### Task 6: NF-e de entrada e devolução a fornecedor

**Files:**
- Modify: `js/domains/tax/fiscal-interoperability-service.js`
- Test: `test/fiscal-interoperability-procurement.test.js`

**Interfaces:**
- Consumes: `purchase_receipts`, `purchase_returns`, fornecedores e Fiscal Core.
- Produces:
  - `linkInboundPurchaseReceipt(receiptId, input, actor)`
  - `prepareSource({sourceType:'PURCHASE_RETURN', ...}, actor)`.

- [ ] **Step 1: Escrever testes RED**

Cobrir:
- NF-e recebida cria documento `INBOUND + INBOUND_LINK + nfe` com `initialStatus='AUTHORIZED'`;
- `accessKey`, `series`, `number`, `xml?`, `issuerTaxId` ficam no documento/snapshot sem chamar provider;
- origem de outra empresa é rejeitada;
- estoque e AP antes/depois do vínculo são idênticos;
- retry é idempotente;
- devolução a fornecedor referencia a NF-e de entrada quando existente;
- sem entrada vinculada, devolução é preparável com `parentDocumentId=null` e pendência explícita.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-procurement.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar vínculo de entrada e resolver `PURCHASE_RETURN`**

Nenhum parser XML é criado. Documento inbound não usa sequência de emissão própria nem provider remoto; metadados recebidos são persistidos como referência externa autorizada.

- [ ] **Step 4: Rodar teste**

Run: `node --test test/fiscal-interoperability-procurement.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat: link inbound invoices and supplier returns"`

---

### Task 7: Transferência com decisão fiscal explícita

**Files:**
- Create: `js/core/database/migrations/162-transfer-fiscal-routing.js`
- Modify: `js/core/database/migrations/index.js`
- Modify: `js/domains/sales-admin/retail-operations-service.js`
- Modify: `js/domains/tax/fiscal-interoperability-service.js`
- Test: `test/fiscal-interoperability-transfer.test.js`

**Interfaces:**
- Consumes: `inventory_transfer_orders` atual.
- Produces: `fiscal_required`, `from_branch_id`, `to_branch_id` e resolver `INVENTORY_TRANSFER`.

- [ ] **Step 1: Escrever teste RED**

Cobrir:
- padrão `fiscalRequired=false` não prepara documento;
- `fiscalRequired=true` exige `fromBranchId` e `toBranchId` válidos da mesma empresa do actor;
- preparar antes/na expedição produz exatamente um `nfe + OUTBOUND + TRANSFER`;
- recebimento não cria segundo documento;
- preparação não altera movimentos da transferência.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-transfer.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar migration e extensão da transferência**

Persistir a decisão explícita; não inferir obrigatoriedade fiscal por localização, filial, CNPJ ou UF.

- [ ] **Step 4: Implementar resolver fiscal**

`inspectSource()` retorna `NOT_FISCAL_REQUIRED` quando a flag for falsa.

- [ ] **Step 5: Rodar teste**

Run: `node --test test/fiscal-interoperability-transfer.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -am "feat: add explicit fiscal routing to transfers"`

---

### Task 8: API fiscal orientada à origem

**Files:**
- Modify: `server/routers/tax-router.js`
- Test: `test/fiscal-interoperability-api.test.js`

**Interfaces:**
- Consumes: `runtime.fiscal` e `runtime.fiscalInteroperability`.
- Produces:
  - `GET /api/v1/tax/sources/:sourceType/:sourceId`
  - `POST /api/v1/tax/sources/:sourceType/:sourceId/prepare`
  - `POST /api/v1/tax/inbound/purchase-receipts/:id`
  - filtros de source em `GET /api/v1/tax/documents`
  - rotas legadas preservadas.

- [ ] **Step 1: Escrever teste RED de API**

Validar autenticação/company scope, inspect/prepare para POS/OS/devolução, vínculo inbound e bloqueio cross-company por ID.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-api.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar rotas mantendo compatibilidade**

Todas as chamadas a settings/profiles/products/documents/get/transition recebem actor. O legado `POST /api/v1/tax/documents` continua aceitando `POS_SALE`/`ADMIN_INVOICE`, mas delega para `fiscalInteroperability.prepareSource()` em vez de reconstruir snapshot no router.

- [ ] **Step 4: Rodar teste**

Run: `node --test test/fiscal-interoperability-api.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat: expose source oriented fiscal API"`

---

### Task 9: UI fiscal nos fluxos de origem

**Files:**
- Modify: `frontend/src/pages/RetailPage.tsx`
- Modify: `frontend/src/pages/ServiceOrdersPage.tsx`
- Modify: `desktop/renderer/views/vendas.js`
- Modify: `desktop/renderer/views/compras.js`
- Test: `qa/e2e/fiscal-interoperability.test.js`

**Interfaces:**
- Consumes: API da Task 8.
- Produces: estado/ação fiscal contextual em PDV, devoluções, transferência, venda administrativa, OS e compras; a aba Fiscal atual permanece monitor consolidado.

- [ ] **Step 1: Escrever E2E RED**

Cobrir no mínimo:
- venda PDV concluída mostra estado fiscal e prepara NFC-e;
- OS mista concluída mostra ações/estados separados de NFS-e e NF-e de peças;
- devolução mostra original fiscal/estado;
- compra vincula NF-e recebida sem repetir recebimento;
- transferência não fiscal não oferece emissão obrigatória e transferência fiscal mostra ação.

- [ ] **Step 2: Rodar E2E e confirmar RED**

Run: `node --test --test-concurrency=1 qa/e2e/fiscal-interoperability.test.js`
Expected: FAIL nos pontos de UI ausentes.

- [ ] **Step 3: Atualizar `RetailPage.tsx`**

Usar inspect/prepare por origem para PDV/devoluções; incluir decisão fiscal na transferência; manter Fiscal como monitor consolidado.

- [ ] **Step 4: Atualizar `ServiceOrdersPage.tsx`**

Após `COMPLETED`, consultar estado fiscal e renderizar Serviço/NFS-e e Peças/NF-e separadamente, com preparação independente.

- [ ] **Step 5: Atualizar vendas/compras legadas**

`vendas.js`: estado/ação NF-e junto à fatura administrativa.
`compras.js`: vínculo de NF-e recebida no receipt e ação/status de devolução ao fornecedor.

- [ ] **Step 6: Rodar E2E**

Run: `node --test --test-concurrency=1 qa/e2e/fiscal-interoperability.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

`git commit -am "feat: surface fiscal state in ERP workflows"`

---

### Task 10: Boundary PR #17, capacidades e gates finais

**Files:**
- Test: `test/fiscal-provider-boundary.test.js`
- Modify: `release/customer-capabilities.json`
- Modify only if required by tests: `js/core/erp-runtime.js`, `server/routers/tax-router.js`

**Interfaces:**
- Consumes: todos os contratos anteriores e `runtime.fiscal.transition()`.
- Produces: branch pronta para reconciliação com `feat/fiscal-acbr-runtime-port`, sem provider duplicado.

- [ ] **Step 1: Escrever teste de boundary**

Static/runtime assertions:
- `fiscal-interoperability-service.js` não importa `acbr-local-provider` nem sidecar;
- snapshot contém tudo que o provider precisa sem consultar módulos de origem;
- lifecycle `PROCESSING/AUTHORIZED/REJECTED/UNKNOWN/FAILED/CANCELLED` continua válido para outbound;
- inbound autorizado não exige provider.

- [ ] **Step 2: Verificar diff da branch contra `main`**

Confirmar manualmente que esta branch não altera `js/domains/tax/acbr-local-provider.js`, `server/fiscal-sidecar/**`, `fiscal-runtime/**` nem `package.json`.

- [ ] **Step 3: Rodar domínio/API completo**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 4: Rodar coverage**

Run: `npm run coverage`
Expected: PASS nos thresholds existentes.

- [ ] **Step 5: Rodar Electron E2E completo**

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 6: Atualizar `release/customer-capabilities.json`**

Declarar interoperabilidade/preparação fiscal por origem disponível; emissão remota/provider continua separada e condicionada à PR #17.

- [ ] **Step 7: Reconsultar a PR #17 antes do handoff/merge**

Se `feat/fiscal-acbr-runtime-port` tiver avançado e tocar `tax-service.js` ou runtime, reconciliar preservando:
- provider/runtime dela;
- company scope, source resolvers e snapshots desta branch.

Depois da reconciliação com a PR #17, rodar também `npm run release:check` e `npm run dist:win`, pois o packaging fiscal pertence àquela branch.

- [ ] **Step 8: Commit final**

`git commit -am "test: verify fiscal interoperability readiness"`
