# ARTISYS ERP — arquitetura standalone

Data: 2026-09-24

## Objetivo

Transformar `ARTISYS_ERP` no repositório definitivo e independente do ERP ArtiSys, reaproveitando apenas componentes empresariais adequados e o trabalho do Financeiro P0–P3 existente na branch `feat/erp-p0-p3` do repositório `PDV-ARTISYS`.

O repositório `PDV-ARTISYS` é somente fonte de leitura para esta migração e não deve receber alterações, commits, merges, exclusões ou mudanças de configuração como parte deste trabalho.

## Princípios obrigatórios

1. O ERP deve ser um produto independente, com identidade, runtime, empacotamento, documentação, QA e release próprios.
2. O núcleo obrigatório deve operar localmente e sem dependência paga obrigatória.
3. Serviços externos pagos ou SaaS, se adicionados no futuro, devem ser integrações opcionais, desligadas por padrão e nunca requisito para inicialização ou continuidade de operação.
4. O ERP não deve depender do runtime do PDV nem de módulos específicos de frente de caixa.
5. Código reutilizado do PDV deve ser extraído por responsabilidade, não copiado em bloco.
6. O ERP deve continuar funcional sem internet para as funções essenciais locais.
7. Cada módulo migrado deve ter proveniência, licença e dependências revisadas antes de entrar no produto comercial.

## Escopo funcional da primeira linha do produto

### Core

- SQLite e migrations próprias do ERP.
- Usuários, autenticação e RBAC.
- Auditoria.
- Configurações locais.
- Backup e restore.
- Importação de dados compatível com o domínio do ERP.
- Logs, health check e pacote de diagnóstico.

### Cadastros

- Clientes.
- Fornecedores.
- Produtos.
- Categorias.
- Unidades e locais de estoque.

### Estoque

- Saldo por local.
- Movimentações.
- Entradas e saídas gerenciais.
- Reservas necessárias para pedidos administrativos.
- Custo de produto e atualização por recebimento de compra.

### Compras

- Pedido de compra.
- Aprovação/submissão conforme RBAC.
- Recebimento parcial ou total.
- Entrada automática no estoque.
- Atualização de custo.
- Geração automática de conta a pagar.
- Consulta de pedidos e recebimentos.

### Vendas administrativas

- Orçamento.
- Pedido de venda.
- Confirmação.
- Reserva de estoque quando aplicável.
- Atendimento parcial ou total.
- Faturamento administrativo sem frente de caixa.
- Geração de conta a receber.
- Histórico de pedidos e faturamentos.

`Faturamento administrativo` nesta versão significa consolidar a venda gerencial e gerar o recebível correspondente. Não significa emissão fiscal.

### Financeiro P0–P3

- Contas financeiras.
- Contas a pagar.
- Contas a receber.
- Baixas parciais e totais.
- Estornos.
- Cancelamentos com auditoria.
- Categorias financeiras.
- Centros de custo.
- Data de competência.
- DRE gerencial.
- Fluxo de caixa.
- Comparativos gerenciais.
- Importação OFX local.
- Preview e commit idempotente de extrato.
- Conciliação com confirmação humana.
- Transferência entre contas próprias sem impacto indevido em receita/despesa.
- Recorrências idempotentes.
- Alertas financeiros com estado de leitura/ocultação sem alterar os lançamentos.

### Relatórios

- Financeiro.
- Vendas administrativas.
- Compras.
- Estoque.

## Explicitamente fora do núcleo do ERP

Não serão migrados para o núcleo do `ARTISYS_ERP`:

- Balcão / frente de caixa.
- Abertura, suprimento, sangria e fechamento de caixa de operador.
- Fluxo de troco e terminal de PDV.
- Impressão térmica de cupom de balcão.
- Gaveta de dinheiro.
- Balança e integração serial específica de PDV.
- Epson/Star/Urano e demais hardware específico de checkout.
- NFC-e e DANFE NFC-e.
- Fiscal sidecar/ACBr do PDV.
- Restaurante, mesas, comandas e KDS.
- Pizzaria.
- Delivery operacional do PDV.
- Fast-food.
- Autoatendimento.
- Garçom/mobile de restaurante.
- Verticais de varejo que só existam para operação de balcão.

Emissão fiscal pode existir futuramente como módulo opcional, separado do núcleo e sem impedir uso do ERP quando ausente.

## Estratégia de migração

A estratégia escolhida é extração limpa para o novo repositório.

Não será feita cópia integral da branch `feat/erp-p0-p3` seguida de exclusões. Em vez disso, serão migrados somente arquivos e responsabilidades cuja dependência pertença ao ERP. Isso reduz acoplamento residual e impede que módulos do PDV entrem no novo produto por dependências transitivas.

A branch `feat/erp-p0-p3` continuará sendo referência para o Financeiro P0–P3 e componentes compartilháveis. O histórico e os arquivos do `PDV-ARTISYS` não serão modificados.

## Estrutura alvo

```text
ARTISYS_ERP/
├── package.json
├── desktop/
│   ├── main.cjs
│   ├── preload.cjs
│   └── renderer/
├── js/
│   ├── core/
│   │   ├── database/
│   │   ├── auth/
│   │   ├── audit/
│   │   ├── settings/
│   │   ├── backup/
│   │   ├── import/
│   │   └── observability/
│   └── domains/
│       ├── shared/
│       ├── contacts/
│       ├── catalog/
│       ├── inventory/
│       ├── procurement/
│       ├── sales-admin/
│       ├── finance/
│       └── reports/
├── server/
│   ├── start.js
│   ├── local-server.js
│   └── routers/
├── test/
├── qa/
├── release/
└── docs/
```

Essa estrutura pode ser ajustada durante a implementação se o código extraído exigir separação adicional, mas não pode reintroduzir dependência estrutural com módulos exclusivos do PDV.

## Runtime

Será criado `createErpRuntime()` próprio.

O runtime deve inicializar somente componentes necessários ao ERP, em ordem explícita:

1. banco e migrations;
2. autenticação/RBAC/auditoria/configurações;
3. cadastros;
4. catálogo e estoque;
5. financeiro base;
6. compras;
7. vendas administrativas;
8. relatórios;
9. OFX, conciliação, recorrências e alertas;
10. backup/observabilidade.

O runtime não pode importar ou instanciar serviços de restaurante, cash register, checkout, fiscal de NFC-e, delivery de PDV, pizzeria, self-service ou hardware de PDV.

## Vendas administrativas

O serviço atual de pedidos do PDV não será reutilizado integralmente porque o fechamento atual está acoplado a `terminalId`, `operatorId`, abertura de venda no serviço de PDV e pagamentos de checkout.

A nova implementação será dividida em responsabilidades:

- orçamento/pedido administrativo;
- reserva e baixa de estoque;
- faturamento administrativo;
- geração de recebível no financeiro;
- auditoria e idempotência.

O fechamento administrativo não exigirá terminal de PDV, sessão de caixa, forma de pagamento de balcão ou gaveta. A liquidação financeira continuará sendo tratada pelo módulo de contas a receber.

## Compras

O fluxo atual de compras é uma boa base porque já integra fornecedor, estoque, custo e conta a pagar. Antes de migrá-lo, serão extraídas suas dependências mínimas:

- banco;
- auditoria;
- regras monetárias;
- estoque;
- produtos/fornecedores;
- financeiro.

Nenhuma dependência do PDV deverá ser adicionada somente para manter compatibilidade com o código antigo.

## Financeiro P0–P3

O trabalho existente será preservado funcionalmente, mas adaptado ao runtime e às migrations próprias do ERP.

Os seguintes componentes são candidatos diretos de migração/refatoração:

- `finance-service`;
- migrations financeiras;
- dimensões financeiras;
- gestão financeira/DRE/fluxo;
- parser OFX;
- importação de extrato;
- conciliação;
- recorrências;
- alertas;
- domínio financeiro vendorizado já utilizado pelo P0–P3;
- testes unitários e de integração correspondentes;
- fluxos QA específicos do ERP Financeiro.

A extensão `ensurePdvFinance` não será migrada como arquitetura final. Seu conteúdo será absorvido por `createErpRuntime()` para remover a dependência conceitual e técnica do runtime do PDV.

## API e servidor local

O ERP terá servidor local próprio e namespace próprio de rotas. As rotas deverão refletir o produto ERP e não serão registradas junto com routers exclusivos do PDV.

Autorização será aplicada por RBAC. Operações destrutivas, cancelamentos, estornos, compras e funções administrativas sensíveis terão exigência explícita de perfil adequado e registro de auditoria.

## Desktop e identidade de produto

O aplicativo deverá ter identidade própria:

- package name: `artisys-erp`;
- product name: `ArtiSys ERP`;
- app id: `com.artisys.erp`;
- banco padrão próprio, sem nome `pdv-artisys.sqlite`;
- instalador e artefatos com nome `ArtiSys-ERP`;
- título, menus e telas sem referências a `ArtiSys PDV`, loja/terminal de caixa ou fluxo de balcão.

O empacotamento deve listar explicitamente os módulos necessários ao ERP. Não será usado um padrão amplo que inclua automaticamente todo o conteúdo de um diretório herdado do PDV.

## Dependências e licenças

Antes da entrada no release comercial:

- revisar licença de cada dependência NPM e de cada módulo vendorizado;
- registrar proveniência dos módulos copiados de outros repositórios ArtiSys;
- manter somente dependências necessárias;
- impedir dependência de serviço pago obrigatório;
- impedir chamadas externas silenciosas no startup;
- documentar integrações opcionais separadamente.

## Dados e migrations

O ERP terá sequência própria de migrations. Migrations herdadas do PDV não serão copiadas por conveniência.

Somente tabelas exigidas pelos módulos aprovados serão incluídas. O banco deve conseguir ser criado do zero em máquina limpa sem precisar executar migrations de restaurante, checkout, fiscal de PDV, delivery ou outros domínios excluídos.

Migrations financeiras P0–P3 serão reorganizadas na sequência própria do ERP, preservando seus contratos e testes de idempotência.

## Tratamento de erros

Erros de domínio devem ser explícitos e previsíveis, sem depender de erros genéricos de módulos ausentes.

Regras mínimas:

- operações transacionais de estoque/financeiro devem usar transação de banco;
- importações OFX devem manter preview separado de commit;
- commits/importações e recebimentos que já usam chave de idempotência devem manter esse comportamento;
- falha em integração opcional não pode impedir inicialização do ERP;
- falha de migration deve interromper startup com diagnóstico claro, sem continuar em estado parcial;
- ações financeiras destrutivas devem exigir motivo quando previsto e gerar auditoria.

## QA e critérios de aceite

O QA do ERP será independente do QA do PDV.

A configuração deve usar um identificador de sistema próprio do ERP e conter apenas fluxos relevantes. Os 18 fluxos E2E do Financeiro P0–P3 deverão ser migrados/adaptados e continuar release-critical enquanto fizerem parte do escopo vigente.

Antes de considerar a migração concluída, devem passar:

1. criação do banco do zero;
2. testes unitários dos domínios migrados;
3. testes de integração do runtime;
4. testes de compras → estoque → contas a pagar;
5. testes de vendas administrativas → estoque → contas a receber;
6. testes P0–P3 do financeiro;
7. testes de RBAC e auditoria;
8. teste de backup/restore;
9. E2E Electron específico do ERP;
10. instalação em máquina limpa e inicialização sem serviços externos;
11. verificação de que nenhum módulo excluído do PDV é importado ou empacotado.

## Documentação e verdade comercial

`README.md`, `release/customer-capabilities.json` e documentação de operação serão escritos especificamente para o ArtiSys ERP.

A lista comercial de funcionalidades deve ser derivada do que estiver implementado e validado no ERP, não do manifesto do PDV.

Funcionalidades opcionais futuras não podem aparecer como disponíveis no produto antes de serem implementadas e validadas.

## Resultado esperado

Ao final da migração, `ARTISYS_ERP` deve ser construível, testável, instalável e utilizável sozinho. Clonar ou instalar o ERP não deve exigir o repositório `PDV-ARTISYS`, runtime de PDV, hardware de caixa ou qualquer serviço pago externo.

O código do ERP Financeiro P0–P3 deve continuar aproveitado, mas integrado nativamente ao ERP e não como extensão do PDV.
