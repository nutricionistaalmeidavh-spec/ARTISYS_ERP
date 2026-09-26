# Fiscal Interoperability P0/P1 Design

## Goal

Transformar o Fiscal Core atual em uma camada transversal do ERP, conectando os fluxos comerciais e operacionais já existentes sem duplicar estoque, financeiro ou infraestrutura de emissão.

Esta especificação trata **P0 + P1 de interoperabilidade**. A infraestrutura operacional do provider fiscal permanece fora deste escopo e continua sendo responsabilidade da PR #17 / branch `feat/fiscal-acbr-runtime-port`.

## Explicit non-scope

Esta branch **não** implementa nem modifica:

- `acbr-local-provider`;
- sidecar fiscal;
- certificado digital;
- assinatura de XML;
- transporte HTTP para ACBr, SEFAZ ou Focus;
- contingência;
- consulta/autorização remota;
- packaging do runtime ACBr;
- binários externos do ACBr.

A interoperabilidade deve terminar em documentos/intents fiscais persistidos e prontos para o runtime/provider consumir.

## Parallel branch boundary

A PR #17 parte da mesma `main` (`410808e18e42fcbf06b8b827d91d834622f21cfa`) e, no momento desta especificação, possui somente o contrato RED do runtime ACBr. Ela deve continuar dona de provider, sidecar, transporte e packaging.

Esta branch pode alterar `tax-service.js` apenas no que diz respeito a contratos de origem, isolamento por empresa, snapshots, relações e lifecycle local. Não deve introduzir dependência do provider.

## Current problems to solve

1. `tax-service` reconhece somente `POS_SALE` e `ADMIN_INVOICE`.
2. `fiscal_documents.document_type` aceita somente `nfce` e `nfe`.
3. OS concluída gera estoque/recebível, mas não possui ligação fiscal.
4. Devoluções de PDV e de venda administrativa atualizam estoque/financeiro sem vínculo com documento fiscal original.
5. Recebimento de compra e devolução a fornecedor não possuem representação fiscal.
6. Transferências internas não possuem ponto explícito para decisão fiscal.
7. `fiscal_company_settings` contém `company_id`, mas a implementação lê/escreve o registro fixo `id='default'`.
8. documentos e listagens fiscais não são filtrados consistentemente pela empresa ativa.
9. perfil fiscal de produto é efetivamente global, impedindo configuração diferente por empresa/CNPJ.
10. a UI fiscal está concentrada na aba Fiscal da Operação, em vez de expor estado/ação dentro dos fluxos de origem.

## Architecture

### 1. Fiscal Core remains the source of truth for fiscal documents

`runtime.fiscal` continua responsável por:

- configuração fiscal por empresa;
- perfis fiscais;
- vínculo fiscal por produto/serviço;
- criação idempotente de documento fiscal;
- sequência local;
- status e eventos;
- relação entre documentos;
- consulta/listagem por empresa.

Ele **não** movimenta estoque, não cria financeiro e não executa emissão remota.

### 2. Add a neutral fiscal interoperability/orchestration layer

Criar um serviço focado em converter entidades existentes do ERP em snapshots fiscais neutros.

Responsabilidades:

- validar que a origem pertence à empresa ativa;
- obter destinatário/fornecedor/cliente da origem;
- congelar itens, quantidades, preços e dados fiscais no momento da preparação;
- decidir quais intents fiscais a operação produz;
- criar relação com documento fiscal anterior quando houver devolução/cancelamento;
- devolver estado fiscal para a UI do módulo de origem.

O serviço não conhece ACBr/Focus.

### 3. Source contracts

#### POS sale

- source: `POS_SALE`
- direction: `OUTBOUND`
- document type: `nfce`
- UI: ação/status junto à venda concluída
- não duplicar estoque, recebível ou pagamento

#### Administrative invoice

- source: `ADMIN_INVOICE`
- direction: `OUTBOUND`
- document type: `nfe`
- UI: ação/status no faturamento administrativo
- não duplicar estoque ou recebível

#### Service order

Uma OS concluída pode produzir até dois intents fiscais independentes:

1. `SERVICE_ORDER_SERVICE`
   - document type: `nfse`
   - inclui somente linhas `SERVICE`
   - total deve reconciliar com `service_total_cents`

2. `SERVICE_ORDER_PARTS`
   - document type: `nfe`
   - inclui somente peças efetivamente consumidas
   - total deve reconciliar com `parts_total_cents`

Se uma das parcelas for zero, nenhum documento daquela natureza é criado.

A conclusão da OS continua sendo dona do recebível e do estoque. O Fiscal apenas referencia a OS concluída.

#### POS return

- source: `POS_RETURN`
- direction: `OUTBOUND`
- operation kind: `RETURN`
- deve referenciar o documento fiscal original da venda quando existir
- se não existir documento original autorizado, a operação fica registrada como `NO_ORIGINAL_DOCUMENT` para tratamento explícito e não inventa um documento anterior

#### Administrative return

- source: `ADMIN_RETURN`
- direction: `OUTBOUND`
- operation kind: `RETURN`
- relação obrigatória com NF-e original quando esta existir

#### Purchase receipt

- source: `PURCHASE_RECEIPT`
- direction: `INBOUND`
- document type: `nfe`
- o ERP não emite esse documento; apenas registra/vincula metadados fiscais recebidos
- deve ser possível vincular chave/XML/metadados posteriormente sem repetir estoque/AP
- parser/validador de XML fica fora desta especificação

#### Purchase return

- source: `PURCHASE_RETURN`
- direction: `OUTBOUND`
- document type: `nfe`
- deve referenciar a NF-e de entrada vinculada ao recebimento quando disponível
- estoque/crédito/AP continuam sob domínio de Compras

#### Inventory transfer

- source: `INVENTORY_TRANSFER`
- direction: `OUTBOUND`
- document type: `nfe` quando a transferência estiver marcada como fiscalmente exigível
- por padrão, transferência continua sem documento fiscal
- esta especificação não tenta inferir regra tributária automaticamente apenas pelos IDs de localização
- o fluxo deve possuir flag/decisão explícita `fiscalRequired` e, quando aplicável, vínculo com filial/estabelecimento de origem/destino

#### Manufacturing

Nenhum documento fiscal é criado ao concluir OP. Produção continua fora da camada fiscal direta.

## Data model evolution

### Fiscal company settings

Manter a tabela atual, mas tornar leitura e escrita baseadas em `company_id`, não em `id='default'`.

Compatibilidade:

- o registro legado da empresa `default` deve continuar válido;
- novas empresas recebem registro próprio;
- nenhuma empresa pode sobrescrever configuração de outra.

### Company-scoped product/service fiscal data

Criar estrutura por `(company_id, product_id)` para permitir que o mesmo produto tenha tributação diferente por CNPJ.

Dados de mercadoria continuam suportando:

- profile fiscal;
- GTIN;
- overrides.

Para `product_type='SERVICE'`, adicionar metadados neutros de serviço suficientes para snapshot fiscal, sem implementar cálculo municipal/provider. Campos específicos do provider permanecem fora do core e podem ficar em `overrides_json`.

### Fiscal documents v2

A migration nova deve reconstruir `fiscal_documents` preservando todos os registros existentes e ampliando os contratos.

Campos/semântica adicionais:

- `company_id` obrigatório;
- `source_type` ampliado;
- `direction`: `INBOUND|OUTBOUND`;
- `operation_kind`: `ISSUE|RETURN|TRANSFER|INBOUND_LINK`;
- `document_type`: `nfce|nfe|nfse`;
- `source_id`;
- `snapshot_json` imutável após criação;
- `parent_document_id` opcional para devolução/referência;
- idempotência por empresa;
- unicidade da origem por empresa/documento/operação.

### Fiscal source links

Quando uma operação puder gerar mais de um documento, especialmente OS, a ligação deve ser explícita e consultável pela origem.

A UI deve conseguir consultar todos os documentos associados à entidade sem precisar conhecer detalhes de banco.

## Snapshot rules

O snapshot fiscal deve congelar os dados no momento da preparação para impedir que alterações posteriores em produto/cliente/perfil mudem um documento já criado.

O snapshot deve conter, no mínimo:

- empresa emissora;
- contraparte;
- tipo de operação;
- documento solicitado;
- itens;
- quantidade;
- valor unitário;
- total de linha;
- total da operação;
- dados fiscais resolvidos de cada item;
- referência da origem;
- relação com documento anterior quando houver.

O provider da PR #17 deve poder consumir este snapshot sem precisar buscar novamente OS, venda, compra ou devolução.

## Multi-company isolation

Todos os métodos fiscais de leitura/escrita recebem `actor` ou `companyId` e filtram por empresa.

Obrigatório:

- settings por empresa;
- perfis/vínculos fiscais por empresa;
- documentos por empresa;
- source lookup deve validar empresa da origem;
- uma empresa não pode buscar documento de outra por ID;
- idempotency key pode repetir em empresas diferentes;
- sequências fiscais devem ser separadas por empresa + tipo + ambiente + série.

## Application flow integration

### PDV

Após venda concluída:

- mostrar estado fiscal da venda;
- botão `Preparar/Emitir NFC-e` cria ou recupera documento idempotente;
- quando PR #17 estiver integrada, o mesmo documento poderá seguir para emissão real.

### Administrative sales

Após criar fatura:

- mostrar estado fiscal junto à fatura;
- ação `Preparar/Emitir NF-e` no próprio fluxo;
- aba Fiscal pode permanecer como monitor central, não como único ponto de criação.

### Service orders

Após `COMPLETED`:

- mostrar resumo fiscal da OS;
- oferecer preparação dos documentos aplicáveis;
- serviço e peças aparecem separadamente;
- status de cada documento é independente.

### Returns

Ao registrar devolução:

- não emitir automaticamente durante a transação de estoque/financeiro;
- registrar disponibilidade de ação fiscal associada;
- UI mostra original fiscal relacionado e estado do retorno.

### Purchases

Recebimento:

- permitir vincular NF-e de entrada ao receipt;
- não refazer estoque/AP.

Devolução a fornecedor:

- expor ação fiscal da devolução;
- referenciar documento de entrada quando disponível.

### Transfers

Na solicitação/transição de transferência:

- suportar `fiscalRequired` explícito;
- quando `false`, nenhum documento é criado;
- quando `true`, expor preparação do documento antes/na expedição;
- recebimento de destino nunca duplica o documento.

## API contract

Manter `/api/v1/tax/*` como namespace fiscal.

Adicionar operações orientadas à origem, sem provider:

- consultar fiscal por origem;
- preparar documentos por origem;
- registrar documento fiscal de entrada;
- listar relações com documento original;
- consultar readiness/pendências fiscais da origem.

As rotas existentes de documento permanecem compatíveis para a PR #17.

## UI contract

Não criar um segundo módulo fiscal separado.

Usar:

- `RetailPage`: PDV, devoluções e monitor fiscal;
- fluxo de vendas administrativas: estado/ação NF-e;
- `ServiceOrdersPage`: estado/ações NFS-e/NF-e de peças;
- Compras: vínculo de NF-e recebida e devolução;
- Transferências: opção fiscal e status;
- aba Fiscal atual: monitor consolidado de todos os documentos.

## Merge compatibility with PR #17

Arquivos que esta branch deve evitar tocar salvo necessidade absoluta:

- `js/domains/tax/acbr-local-provider.js`;
- `server/fiscal-sidecar/**`;
- `fiscal-runtime/**`;
- blocos de `package.json` exclusivamente relacionados ao sidecar/runtime externo.

Ponto de integração esperado:

1. esta branch prepara `fiscal_documents` + `snapshot_json`;
2. PR #17 recebe o documento/snapshot e executa emissão/consulta/cancelamento;
3. retorno do provider usa o lifecycle/status já existente do Fiscal Core.

Se a PR #17 alterar `tax-service.js`, a reconciliação deve preservar:

- os contratos de provider dela;
- os source resolvers, company scope e snapshots desta branch.

## Testing strategy

TDD obrigatório.

Testes de domínio/API devem cobrir:

1. empresa A não lê/configura fiscal da empresa B;
2. idempotência isolada por empresa;
3. POS continua produzindo exatamente uma NFC-e fiscal sem duplicar checkout;
4. fatura administrativa produz exatamente uma NF-e fiscal sem duplicar AR/estoque;
5. OS somente serviço produz NFS-e;
6. OS somente peças produz NF-e;
7. OS mista produz dois documentos e a soma reconcilia com `total_cents`;
8. devolução referencia documento original quando existente;
9. devolução sem original não fabrica referência falsa;
10. recebimento de compra vincula NF-e sem duplicar inventory/AP;
11. devolução a fornecedor referencia entrada quando possível;
12. transferência `fiscalRequired=false` não gera documento;
13. transferência `fiscalRequired=true` gera somente um intent/documento;
14. snapshot não muda após alteração posterior de cadastro/perfil;
15. documentos legados de `120-fiscal-core` sobrevivem à migration;
16. PR #17 pode continuar consumindo lifecycle/status sem depender dos módulos de origem.

E2E Electron deve validar os pontos de acionamento nos fluxos de PDV, OS e pelo menos um fluxo de devolução/compra.

## Success criteria

A interoperabilidade estará pronta quando:

- todos os fluxos listados puderem consultar e preparar seu estado fiscal sem provider;
- nenhuma operação fiscal duplicar estoque ou financeiro;
- documentos forem isolados por empresa;
- OS suportar serviço e peças separadamente;
- devoluções e compras preservarem referência ao documento anterior/entrada;
- transferências suportarem decisão fiscal explícita;
- a PR #17 puder ser mergeada depois como runtime/provider sem reimplementar regras de negócio dos módulos.
