# Fiscal Interoperability P0/P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar o Fiscal Core aos fluxos de PDV, vendas administrativas, OS, devoluções, compras e transferências, com isolamento multiempresa e snapshots imutáveis, sem implementar ou duplicar a infraestrutura ACBr/SEFAZ da PR #17.

**Architecture:** Evoluir o schema/core fiscal para ser company-scoped e aceitar `nfce|nfe|nfse`, depois criar `fiscal-interoperability-service.js` como camada neutra que resolve entidades existentes e produz intents/snapshots fiscais sem tocar estoque ou financeiro. A API `/api/v1/tax/*` expõe estado/preparação por origem e as UIs existentes apenas acionam/mostram esse estado; provider, sidecar, certificado, transporte, contingência e packaging permanecem responsabilidade exclusiva da PR #17.

**Tech Stack:** Node.js CommonJS, SQLite, HTTP router local, React/TypeScript, renderer desktop legado, Node test runner, Electron E2E, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-26-fiscal-interoperability-p0-p1-design.md`

## Global Constraints

- Não implementar nem modificar `acbr-local-provider`, `server/fiscal-sidecar/**`, `fiscal-runtime/**`, certificado, assinatura, transporte, contingência ou packaging ACBr.
- Não duplicar estoque, recebíveis, pagamentos, contas a pagar, créditos de fornecedor ou movimentos de transferência.
- Produção/OP não cria documento fiscal diretamente.
- `runtime.fiscal` continua sendo a fonte de verdade dos documentos e lifecycle local; a nova camada de interoperabilidade só resolve origens e prepara snapshots/intents.
- Todos os dados fiscais de configuração, perfil, produto/serviço, sequência e documento devem ser isolados por `company_id`.
- Snapshots fiscais tornam-se imutáveis após a criação do documento.
- Rotas existentes `/api/v1/tax/documents*` e lifecycle/status devem permanecer compatíveis com a futura integração da PR #17.
- Transferência só entra no fiscal quando `fiscalRequired=true`; nenhum motor tributário automático será criado nesta fase.

## Review Focus

1. **Cross-company leakage:** IDs de documento, idempotency keys, perfis e produtos iguais/reutilizados em empresas diferentes nunca podem expor ou sobrescrever dados de outra empresa — coberto nas Tasks 1 e 2.
2. **Retry/idempotência:** repetir preparação de uma origem, inclusive OS mista, não pode gerar segundo documento nem consumir nova sequência — coberto nas Tasks 2, 3 e 4.
3. **Snapshot drift:** alterar cliente/produto/perfil depois de preparar o documento não pode mudar `snapshot_json` existente — coberto na Task 3.
4. **Fiscal sem efeitos operacionais:** preparar/vincular documentos de venda, OS, devolução, compra ou transferência não pode alterar saldos de estoque nem financeiro — coberto nas Tasks 3, 4, 5 e 6.
5. **Merge com PR #17:** nenhuma implementação desta branch pode importar provider/sidecar nem exigir que o provider conheça OS, compra ou devolução; o contrato de consumo deve terminar em `fiscal_document + snapshot_json` — coberto nas Tasks 2 e 9.

---

### Task 1: Fiscal schema v2 e migração compatível

**Files:**
- Create: `js/core/database/migrations/160-fiscal-interoperability.js`
- Modify: `js/core/database/migrations/index.js`
- Test: `test/fiscal-interoperability-migration.test.js`

**Interfaces:**
- Consumes: schema legado de `120-fiscal-core` e migrations até `151-manufacturing-loss-reservation-guard`.
- Produces: settings/perfis/vínculos/sequências/documentos company-scoped, `snapshot_json`, `direction`, `operation_kind`, `parent_document_id` e suporte a `nfse`.

- [ ] **Step 1: Escrever o teste RED de upgrade**

Criar teste que inicializa banco no schema legado, insere settings/perfil/vínculo/documento `POS_SALE`, executa `runErpMigrations()` e verifica:
- registro legado preservado na empresa `default`;
- `fiscal_company_settings.company_id` único;
- `fiscal_profiles.company_id='default'` no legado;
- vínculo fiscal por `(company_id, product_id)`;
- `fiscal_sequences` chaveada por empresa + tipo + ambiente + série;
- documento legado preservado com `company_id='default'`;
- novo `document_type='nfse'` aceito;
- `snapshot_json`, `direction`, `operation_kind`, `parent_document_id` presentes;
- `UNIQUE(company_id,idempotency_key)`, permitindo a mesma chave em empresas diferentes.

- [ ] **Step 2: Rodar o teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-migration.test.js`
Expected: FAIL porque a migration `160-fiscal-interoperability` ainda não existe.

- [ ] **Step 3: Implementar migration `160-fiscal-interoperability`**

Reconstruir as tabelas fiscais necessárias preservando dados legados. Manter IDs existentes, migrar legado para `company_id='default'`, e usar `CHECK`/índices compatíveis com:
- source types: `POS_SALE`, `ADMIN_INVOICE`, `SERVICE_ORDER_SERVICE`, `SERVICE_ORDER_PARTS`, `POS_RETURN`, `ADMIN_RETURN`, `PURCHASE_RECEIPT`, `PURCHASE_RETURN`, `INVENTORY_TRANSFER`;
- document types: `nfce`, `nfe`, `nfse`;
- directions: `INBOUND`, `OUTBOUND`;
- operation kinds: `ISSUE`, `RETURN`, `TRANSFER`, `INBOUND_LINK`.

- [ ] **Step 4: Registrar migration no índice e rodar teste**

Run: `node --test test/fiscal-interoperability-migration.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat: evolve fiscal schema for interoperability"`

---

### Task 2: Fiscal Core multiempresa e primitive de documento preparado

**Files:**
- Modify: `js/domains/tax/tax-service.js`
- Test: `test/fiscal-multicompany.test.js`
- Test: `test/fiscal-core.test.js`

**Interfaces:**
- Consumes: schema da Task 1.
- Produces:
  - `settings(actorOrCompany)`
  - `saveSettings(input, actor)`
  - `saveProfile(input, actor)` / `listProfiles(actor)`
  - `assignProduct(productId, input, actor)` / `productFiscal(productId, actor)`
  - `createPreparedDocument(intent, actor)`
  - `getDocument(id, actor)` / `listDocuments(filters, actor)`
  - `documentsForSource(sourceType, sourceId, actor)`
  - `transition(id, input, actor)` preservado para PR #17.

- [ ] **Step 1: Escrever testes RED de isolamento e idempotência**

Cobrir duas empresas com configurações/perfis/vínculos diferentes, mesma `idempotencyKey`, sequências independentes e bloqueio de `getDocument()` cross-company.

- [ ] **Step 2: Rodar testes e confirmar RED**

Run: `node --test test/fiscal-multicompany.test.js test/fiscal-core.test.js`
Expected: FAIL em settings/perfis/documentos globais.

- [ ] **Step 3: Refatorar `tax-service.js` para company scope**

Todas as queries de settings, perfil, produto, sequência, documento e listagem devem usar a empresa do actor. `createPreparedDocument(intent, actor)` recebe intent já resolvido contendo `sourceType`, `sourceId`, `documentType`, `direction`, `operationKind`, `snapshot`, `parentDocumentId?`, `idempotencyKey`; não consulta módulos de origem nem provider.

- [ ] **Step 4: Manter compatibilidade do lifecycle**

`transition()` deve continuar atualizando status/access key/protocol/XML como hoje, mas somente dentro da empresa ativa. Nenhum import de ACBr/Focus é permitido.

- [ ] **Step 5: Rodar testes**

Run: `node --test test/fiscal-multicompany.test.js test/fiscal-core.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -am "feat: scope fiscal core by company"`

---

### Task 3: Orquestrador de PDV, venda administrativa e OS

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
- OS só serviço → uma `nfse`;
- OS só peças → uma `nfe` com apenas quantidade efetivamente consumida;
- OS mista → dois documentos independentes, soma dos snapshots = `totalCents` da OS;
- OS ainda não concluída retorna `ready=false`;
- repetir preparação com mesma chave-base retorna os mesmos documentos e não avança sequência novamente;
- preparar qualquer origem não altera quantidade de movimentos de estoque nem lançamentos financeiros;
- editar produto/cliente/perfil após preparação não altera o snapshot persistido.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-sales-service.test.js`
Expected: FAIL porque o serviço não existe.

- [ ] **Step 3: Implementar resolvers e snapshot builders**

`prepareSource()` deve resolver apenas as origens desta task. Para OS mista, derivar chaves idempotentes `${base}:service` e `${base}:parts`. Se uma parcela for zero, não criar o documento correspondente.

- [ ] **Step 4: Registrar `runtime.fiscalInteroperability`**

Instanciar depois de `fiscal`, `retail`, `salesAdmin` e `serviceOrders`, sem alterar a interface de provider.

- [ ] **Step 5: Rodar teste**

Run: `node --test test/fiscal-interoperability-sales-service.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -am "feat: prepare fiscal intents for sales and service orders"`

---

### Task 4: Devoluções e relacionamento com documento original

**Files:**
- Modify: `js/domains/tax/fiscal-interoperability-service.js`
- Test: `test/fiscal-interoperability-returns.test.js`

**Interfaces:**
- Consumes: `documentsForSource()`, `POS_RETURN`, `ADMIN_RETURN` e documentos fiscais originais.
- Produces: intents `operationKind='RETURN'` com `parentDocumentId` quando houver original; sem referência inventada quando não houver.

- [ ] **Step 1: Escrever testes RED de devolução**

Cobrir:
- devolução PDV relaciona documento original quando existente;
- devolução administrativa relaciona NF-e original;
- sem original, `parentDocumentId=null` e snapshot registra `originalDocumentStatus='NO_ORIGINAL_DOCUMENT'`;
- repetição é idempotente;
- preparação não duplica reembolso, estoque ou financeiro.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-returns.test.js`
Expected: FAIL porque resolvers de retorno não existem.

- [ ] **Step 3: Implementar resolvers de retorno**

Usar o documento original relacionado quando disponível. O tipo do documento de retorno deve seguir o documento original quando ele existir; sem original, usar `nfe` como intent neutro de devolução, sem fabricar chave/protocolo anterior.

- [ ] **Step 4: Rodar teste**

Run: `node --test test/fiscal-interoperability-returns.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat: relate fiscal returns to original documents"`

---

### Task 5: NF-e de entrada e devolução a fornecedor

**Files:**
- Modify: `js/domains/tax/fiscal-interoperability-service.js`
- Test: `test/fiscal-interoperability-procurement.test.js`

**Interfaces:**
- Consumes: `purchase_receipts`, `purchase_returns`, fornecedor, itens recebidos e Fiscal Core.
- Produces:
  - `linkInboundPurchaseReceipt(receiptId, input, actor)`
  - `prepareSource({sourceType:'PURCHASE_RETURN', ...}, actor)`.

- [ ] **Step 1: Escrever testes RED de compras**

Cobrir:
- vínculo de NF-e de entrada cria documento `INBOUND + INBOUND_LINK + nfe` associado ao receipt;
- metadados externos (`accessKey`, `series`, `number`, `xml?`, `issuerTaxId`) ficam no documento/snapshot sem chamar provider;
- estoque e AP antes/depois do vínculo são idênticos;
- nova tentativa com mesma chave é idempotente;
- devolução a fornecedor referencia a NF-e de entrada quando existente;
- sem entrada vinculada, devolução continua preparável com `parentDocumentId=null` e pendência explícita no snapshot.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-procurement.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar vínculo de entrada e resolver `PURCHASE_RETURN`**

Documento inbound pode nascer `AUTHORIZED` porque representa NF-e externa já recebida; não deve passar pelo provider da PR #17. Nenhum parser XML é implementado aqui.

- [ ] **Step 4: Rodar teste**

Run: `node --test test/fiscal-interoperability-procurement.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat: link inbound invoices and supplier returns"`

---

### Task 6: Transferência com decisão fiscal explícita

**Files:**
- Create: `js/core/database/migrations/161-transfer-fiscal-routing.js`
- Modify: `js/core/database/migrations/index.js`
- Modify: `js/domains/sales-admin/retail-operations-service.js`
- Modify: `js/domains/tax/fiscal-interoperability-service.js`
- Test: `test/fiscal-interoperability-transfer.test.js`

**Interfaces:**
- Consumes: `inventory_transfer_orders` atual.
- Produces: campos `fiscal_required`, `from_branch_id`, `to_branch_id` e resolver `INVENTORY_TRANSFER`.

- [ ] **Step 1: Escrever teste RED**

Cobrir:
- transferência padrão salva `fiscalRequired=false` e não é preparável fiscalmente;
- `fiscalRequired=true` exige dados mínimos de estabelecimento/filial definidos no input;
- preparar antes/na expedição produz exatamente um intent `nfe + OUTBOUND + TRANSFER`;
- recebimento da transferência não cria segundo documento;
- preparação não altera movimentos da transferência.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-transfer.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar migration e extensão do fluxo de transferência**

Persistir somente a decisão explícita; não inferir obrigatoriedade fiscal por localização, filial ou UF.

- [ ] **Step 4: Implementar resolver fiscal da transferência**

`inspectSource()` deve indicar `NOT_FISCAL_REQUIRED` quando a flag for falsa.

- [ ] **Step 5: Rodar teste**

Run: `node --test test/fiscal-interoperability-transfer.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -am "feat: add explicit fiscal routing to transfers"`

---

### Task 7: API fiscal orientada à origem

**Files:**
- Modify: `server/routers/tax-router.js`
- Test: `test/fiscal-interoperability-api.test.js`

**Interfaces:**
- Consumes: `runtime.fiscal` e `runtime.fiscalInteroperability`.
- Produces:
  - `GET /api/v1/tax/sources/:sourceType/:sourceId`
  - `POST /api/v1/tax/sources/:sourceType/:sourceId/prepare`
  - `POST /api/v1/tax/inbound/purchase-receipts/:id`
  - filtros opcionais de source em `GET /api/v1/tax/documents`
  - rotas legadas de settings/profiles/products/documents/transition preservadas.

- [ ] **Step 1: Escrever teste RED de API**

Validar autenticação/company scope, inspect/prepare para POS/OS/devolução, vínculo inbound e bloqueio cross-company por ID.

- [ ] **Step 2: Rodar teste e confirmar RED**

Run: `node --test test/fiscal-interoperability-api.test.js`
Expected: FAIL com rotas ausentes e/ou leitura global.

- [ ] **Step 3: Implementar rotas mantendo compatibilidade**

Todas as chamadas a `settings`, `profiles`, `productFiscal`, `documents`, `getDocument` e `transition` devem receber actor/company scope. O endpoint legado `POST /api/v1/tax/documents` pode permanecer como compatibilidade para `POS_SALE`/`ADMIN_INVOICE`, delegando à interoperabilidade em vez de reconstruir snapshot no router.

- [ ] **Step 4: Rodar teste**

Run: `node --test test/fiscal-interoperability-api.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat: expose source oriented fiscal API"`

---

### Task 8: UI fiscal nos fluxos de origem

**Files:**
- Modify: `frontend/src/pages/RetailPage.tsx`
- Modify: `frontend/src/pages/ServiceOrdersPage.tsx`
- Modify: `desktop/renderer/views/vendas.js`
- Modify: `desktop/renderer/views/compras.js`
- Test: `qa/e2e/fiscal-interoperability.test.js`

**Interfaces:**
- Consumes: API da Task 7.
- Produces: estado/ação fiscal contextual em PDV, devoluções, transferência, venda administrativa, OS e compras; aba Fiscal atual permanece monitor consolidado.

- [ ] **Step 1: Escrever E2E RED**

Cobrir no mínimo:
- venda PDV concluída mostra estado fiscal e prepara NFC-e;
- OS mista concluída mostra ações/estados separados para NFS-e e NF-e de peças;
- um fluxo de devolução mostra documento original/estado;
- compra permite vincular NF-e recebida sem repetir recebimento;
- transferência não fiscal não mostra criação obrigatória; transferência fiscal mostra ação.

- [ ] **Step 2: Rodar E2E e confirmar RED**

Run: `npm run e2e:electron -- --test fiscal-interoperability`
Expected: FAIL nos pontos de UI ainda ausentes.

- [ ] **Step 3: Atualizar `RetailPage.tsx`**

Trocar criação fiscal ad hoc por inspect/prepare da origem; mostrar status fiscal após venda/devolução e decisão fiscal na transferência. Monitor central continua usando `/api/v1/tax/documents`.

- [ ] **Step 4: Atualizar `ServiceOrdersPage.tsx`**

Após `COMPLETED`, consultar a origem OS e renderizar separadamente Serviço/NFS-e e Peças/NF-e, com botões de preparação independentes.

- [ ] **Step 5: Atualizar vendas e compras legadas**

`vendas.js`: estado/ação NF-e junto à fatura administrativa.
`compras.js`: vínculo de NF-e de entrada no receipt e estado fiscal da devolução ao fornecedor.

- [ ] **Step 6: Rodar E2E**

Run: `npm run e2e:electron -- --test fiscal-interoperability`
Expected: PASS.

- [ ] **Step 7: Commit**

`git commit -am "feat: surface fiscal state in ERP workflows"`

---

### Task 9: Compatibilidade com PR #17, capacidades e gates finais

**Files:**
- Test: `test/fiscal-provider-boundary.test.js`
- Modify: `release/customer-capabilities.json`
- Modify only if required by tests: `js/core/erp-runtime.js`, `server/routers/tax-router.js`

**Interfaces:**
- Consumes: todos os contratos anteriores e o lifecycle `runtime.fiscal.transition()`.
- Produces: branch pronta para ser reconciliada com `feat/fiscal-acbr-runtime-port` sem provider duplicado.

- [ ] **Step 1: Escrever teste de boundary da PR #17**

Asserts:
- `fiscal-interoperability-service.js` não importa provider/sidecar;
- um documento preparado contém snapshot suficiente para emissão sem consultar módulos de origem;
- `transition(PROCESSING/AUTHORIZED/REJECTED/UNKNOWN/FAILED/CANCELLED)` continua funcionando no documento preparado;
- documento inbound não exige provider;
- nenhum arquivo `server/fiscal-sidecar/**`, `fiscal-runtime/**` ou `acbr-local-provider.js` foi criado/modificado nesta branch.

- [ ] **Step 2: Rodar suíte de domínio/API completa**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 3: Rodar coverage**

Run: `npm run coverage`
Expected: PASS nos thresholds existentes.

- [ ] **Step 4: Rodar Electron E2E completo**

Run: `npm run e2e:electron`
Expected: PASS sem regressão nos fluxos anteriores.

- [ ] **Step 5: Rodar release check e Windows build**

Run: `npm run release:check`
Expected: PASS.

Run: `npm run dist:win`
Expected: instalador válido; nenhuma dependência da PR #17 deve ser necessária para os fluxos de preparação/local state.

- [ ] **Step 6: Atualizar `release/customer-capabilities.json`**

Declarar interoperabilidade fiscal por origem como disponível, deixando emissão remota ACBr/provider separada e condicionada à PR #17.

- [ ] **Step 7: Comparar com a PR #17 atual antes de abrir/atualizar PR**

Reconsultar `feat/fiscal-acbr-runtime-port`; se ela tiver avançado e tocar `tax-service.js`/runtime, reconciliar preservando simultaneamente:
- provider/runtime dela;
- company scope, source resolvers e snapshots desta branch.

- [ ] **Step 8: Commit final**

`git commit -am "test: verify fiscal interoperability release readiness"`
