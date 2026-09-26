# ArtiSys ERP — Produção / PCP-MRP

Data: 2026-09-26
Base de referência: `main` em `3f21f3aa2ea384290db2fd37835ed50dba4ee3c7`
Branch de trabalho: `feat/service-orders-manufacturing`

## Objetivo

Adicionar ao ArtiSys ERP um módulo de Produção operacional para pequena e média empresa, aproveitando a BOM/ficha técnica já existente e integrando planejamento de materiais, ordens de produção, reservas, consumo, perdas, apontamento, entrada do produto acabado, custos e requisições de compra.

O escopo é PCP/MRP operacional. Não é objetivo desta entrega construir um MES industrial avançado.

## Escopo

Incluído:

- criação de ordem de produção (OP);
- produto acabado e quantidade planejada;
- snapshot da BOM ativa na criação/liberação;
- explosão automática de componentes;
- cálculo de necessidade de materiais;
- consulta de disponibilidade considerando estoque físico e reservas;
- reserva de componentes;
- indicação estruturada de faltas;
- geração de requisição de compra para faltas;
- liberação da OP;
- início da produção;
- consumo parcial/total de matérias-primas;
- apontamento parcial de produto acabado;
- perdas/refugo;
- entrada automática do produto acabado no estoque;
- custos previstos e realizados;
- mão de obra, overhead e outros custos adicionais;
- conclusão e cancelamento;
- cálculo MRP sobre OPs abertas e estoque mínimo;
- dashboard/listagem de OPs e necessidades;
- histórico/auditoria;
- multiempresa;
- API e UI React;
- testes de domínio, API e E2E.

Fora do escopo:

- OEE;
- telemetria/IoT de máquinas;
- capacidade finita por centro de trabalho;
- sequenciamento avançado APS;
- manutenção industrial;
- apontamento por relógio/chão de fábrica dedicado;
- qualidade laboratorial;
- rastreabilidade regulatória específica de indústria farmacêutica/alimentos;
- custeio contábil completo;
- geração automática de NF-e;
- alterações no Fiscal Core atual;
- previsão de demanda por IA.

## Arquitetura

Criar domínio isolado em `js/domains/manufacturing/`.

Componentes previstos:

- `manufacturing-service.js`: ciclo de vida das OPs, apontamentos e custos;
- `mrp-service.js`: cálculo de necessidades e geração de requisições;
- `server/routers/manufacturing-router.js`: API HTTP;
- `frontend/src/pages/ManufacturingPage.tsx`: UI React;
- migration `130-manufacturing.js`.

A integração de reservas deve usar o mesmo `inventory-reservation-service.js` especificado para Serviços/OS, baseado em `inventory_reservations` existente.

Não duplicar BOM. A fonte de estrutura do produto continua sendo `product_boms` e `product_bom_items` já existentes no domínio de varejo/catálogo. A OP captura um snapshot dos componentes para que uma edição futura da BOM não altere ordens já criadas/liberadas.

## Modelo de dados

### `manufacturing_orders`

Campos mínimos:

- `id`;
- `company_id`;
- `product_id`;
- `bom_id`;
- `bom_version`;
- `location_id` para consumo;
- `output_location_id` para entrada do acabado;
- `status`;
- `planned_quantity`;
- `completed_quantity`;
- `scrap_quantity`;
- `planned_start_at` opcional;
- `due_at` opcional;
- `released_at`;
- `started_at`;
- `completed_at`;
- `cancelled_at`;
- `cancellation_reason`;
- `planned_material_cost_cents`;
- `actual_material_cost_cents`;
- `additional_cost_cents`;
- `actual_total_cost_cents`;
- `created_by`;
- `created_at`;
- `updated_at`.

### `manufacturing_order_components`

Snapshot da BOM na OP.

Campos mínimos:

- `id`;
- `manufacturing_order_id`;
- `product_id`;
- `quantity_per_unit`;
- `required_quantity`;
- `consumed_quantity`;
- `planned_unit_cost_cents`;
- `actual_cost_cents`;
- `reservation_id` opcional;
- `created_at`;
- `updated_at`.

`required_quantity = quantity_per_unit * planned_quantity` no snapshot inicial.

### `manufacturing_outputs`

Cada apontamento de produto acabado:

- `id`;
- `manufacturing_order_id`;
- `quantity`;
- `unit_cost_cents`;
- `inventory_movement_id`;
- `created_by`;
- `created_at`.

### `manufacturing_losses`

Registro de perdas/refugo:

- `id`;
- `manufacturing_order_id`;
- `loss_type` em `COMPONENT` ou `OUTPUT`;
- `product_id`;
- `quantity`;
- `reason`;
- `inventory_movement_id` opcional;
- `created_by`;
- `created_at`.

Perda de componente consome estoque adicional. Refugo de saída não entra no estoque de produto acabado.

### `manufacturing_cost_entries`

Custos não materiais:

- `id`;
- `manufacturing_order_id`;
- `cost_type` em `LABOR`, `OVERHEAD` ou `OTHER`;
- `description`;
- `amount_cents`;
- `created_by`;
- `created_at`.

### `manufacturing_procurement_links`

Evita gerar requisições duplicadas para a mesma necessidade.

Campos mínimos:

- `id`;
- `company_id`;
- `manufacturing_order_id` opcional;
- `product_id`;
- `requisition_id`;
- `quantity`;
- `source_key` único;
- `created_at`.

## Ciclo de vida da OP

Estados persistidos:

- `PLANNED`;
- `RELEASED`;
- `IN_PROGRESS`;
- `COMPLETED`;
- `CANCELLED`.

Falta de material não cria um sexto status persistido. Ela é uma condição derivada (`materialStatus`) para evitar explosão de estados.

### `PLANNED`

- OP criada com produto, quantidade, locais e datas;
- BOM ativa é validada e copiada para os componentes da OP;
- custos planejados são calculados;
- ainda não há consumo;
- MRP considera a OP como demanda aberta;
- pode ser editada/cancelada.

### Liberação

A ação `release`:

1. recalcula a necessidade remanescente dos componentes;
2. verifica disponibilidade líquida por componente/local;
3. se houver falta, não altera o status e retorna lista estruturada de faltas;
4. se houver estoque suficiente, cria todas as reservas necessárias atomicamente;
5. muda a OP para `RELEASED`.

A liberação é all-or-nothing: uma OP não fica parcialmente liberada.

### `RELEASED`

- todos os componentes necessários estão reservados;
- pode ser iniciada;
- ainda não houve produção física obrigatória.

### `IN_PROGRESS`

A ação `start` altera `RELEASED -> IN_PROGRESS`.

Durante produção:

- componentes podem ser consumidos parcialmente;
- consumo reduz estoque e reserva na mesma transação;
- apontamentos de produto acabado podem ocorrer parcialmente;
- custos adicionais podem ser registrados;
- perdas/refugo podem ser registrados.

### Apontamento de produto acabado

A ação `report-output`:

1. valida OP `IN_PROGRESS`;
2. valida quantidade positiva;
3. impede que `completed_quantity + scrap_quantity` ultrapasse a quantidade planejada, salvo opção explícita de manager/admin para sobreprodução;
4. calcula custo unitário realizado até o momento;
5. gera movimento positivo em `output_location_id` com `source_type='manufacturing-output'`;
6. registra `manufacturing_outputs`;
7. incrementa `completed_quantity`.

No escopo padrão, sobreprodução não é permitida. Eventual exceção exige `allowOverproduction=true` e papel `admin`/`manager`, com auditoria explícita.

### Perdas/refugo

#### `COMPONENT`

- consome estoque adicional do componente;
- aumenta custo material real;
- exige motivo;
- não reduz automaticamente a quantidade planejada do produto acabado.

#### `OUTPUT`

- registra quantidade produzida e rejeitada;
- não cria entrada em estoque do acabado;
- incrementa `scrap_quantity`;
- exige motivo.

### Conclusão

A ação `complete`:

1. exige `IN_PROGRESS`;
2. exige `completed_quantity + scrap_quantity == planned_quantity`;
3. libera saldos de reservas não consumidos;
4. recalcula custos realizados;
5. grava `actual_total_cost_cents`;
6. marca `COMPLETED`.

A conclusão não cria lançamento financeiro por padrão. Produção altera valor econômico do estoque, mas não representa entrada/saída de caixa. O financeiro permanece responsável por compras, pagamentos e vendas.

### Cancelamento

- `PLANNED`: pode cancelar sem efeitos físicos;
- `RELEASED`: libera reservas e cancela;
- `IN_PROGRESS`: somente `admin`/`manager`; preserva consumos e outputs já realizados, libera reservas remanescentes e exige motivo;
- `COMPLETED`: não pode ser cancelada diretamente.

## BOM e snapshot

Na criação da OP:

- exigir produto `MANUFACTURED` ou produto com BOM ativa;
- obter `activeBom(productId)`;
- copiar `bom_id`, versão e componentes;
- armazenar `quantity_per_unit` e `required_quantity`.

Edições posteriores da BOM não alteram a OP existente.

Se uma OP `PLANNED` for editada em quantidade antes de ser liberada, recalcular `required_quantity` sobre o snapshot original da BOM, não sobre uma nova versão silenciosamente. Trocar a versão da BOM exige ação explícita `refresh-bom` enquanto `PLANNED`.

## Custos

### Planejado

Para cada componente:

`planned_component_cost = required_quantity * catalog.costPriceCents`.

`planned_material_cost = soma dos componentes`.

### Realizado

Material real usa o custo informado no movimento/consumo quando disponível; caso contrário, usa o custo do produto no momento do consumo.

`actual_total_cost = actual_material_cost + LABOR + OVERHEAD + OTHER`.

Custo unitário realizado final:

`actual_unit_cost = actual_total_cost / completed_quantity`.

Quando houver refugo de saída, o custo do refugo permanece absorvido na ordem; portanto o custo unitário das unidades boas aumenta.

O custo unitário usado na entrada do produto acabado deve refletir o custo realizado acumulado disponível no momento de cada apontamento. Na conclusão, registrar o custo final da ordem; não reescrever movimentos históricos de estoque.

## MRP

Criar `mrp-service.js` com cálculo sob demanda. Não é necessário job cloud ou serviço externo.

### Entradas consideradas

- saldo físico por produto/local;
- reservas `ACTIVE` ainda não consumidas;
- componentes remanescentes de OPs `PLANNED`, `RELEASED` e `IN_PROGRESS`;
- estoque mínimo (`minStock`) do produto;
- estoque alvo (`targetStock`) quando configurado;
- requisições de compra já ligadas ao módulo de produção para evitar duplicidade.

### Disponibilidade líquida

`available_unreserved = physical_balance - active_reserved_remaining`.

### Necessidade bruta de produção

Somar, por componente, o saldo ainda necessário de todas as OPs abertas:

`gross_production_requirement = required_quantity - consumed_quantity`.

Para OPs já `RELEASED`/`IN_PROGRESS`, a parte coberta por reserva não deve ser contada novamente como falta de compra.

### Estoque de segurança

Após considerar a demanda produtiva, calcular projeção.

Se a projeção ficar abaixo de `minStock`, gerar necessidade adicional até `targetStock`. Se `targetStock` não estiver definido ou for menor que `minStock`, usar `minStock` como alvo.

### Saída do MRP

Por produto:

- saldo físico;
- reservado;
- disponível não reservado;
- demanda de produção;
- estoque mínimo;
- estoque alvo;
- quantidade já coberta por requisição vinculada;
- necessidade líquida;
- OPs causadoras da demanda.

## Requisição de compra por falta

A geração de requisição deve reutilizar `procurementRequisitions.createRequisition`.

Não criar pedido de compra diretamente.

A ação pode operar:

- para uma OP específica (`generate-shortage-requisition`);
- para resultado agregado do MRP (`generate-mrp-requisition`).

Regras:

- somente quantidades líquidas positivas;
- agrupar por local de consumo;
- justificativa identifica OP/MRP;
- gravar link em `manufacturing_procurement_links`;
- usar `source_key` determinístico para impedir duplicidade;
- requisição criada permanece no fluxo normal de compras/cotação/aprovação.

## Reservas e consumo

Usar `inventory-reservation-service` compartilhado.

Para cada componente reservado:

- `source_type='manufacturing-order'`;
- `source_id=<component-id ou op-id conforme contrato escolhido no plano>`;
- local de consumo da OP.

O contrato deve permitir uma reserva independente por componente e rastreabilidade até a OP.

O consumo deve gerar movimento:

- `source_type='manufacturing-consumption'`;
- `source_id=<manufacturing-order-id>`.

Perdas adicionais usam `source_type='manufacturing-loss'`.

Saída acabada usa `source_type='manufacturing-output'`.

## API

Prefixo: `/api/v1/manufacturing`.

Rotas mínimas:

- `GET /orders` com filtros/paginação;
- `POST /orders`;
- `GET /orders/:id`;
- `PATCH /orders/:id` somente `PLANNED`;
- `POST /orders/:id/refresh-bom` somente `PLANNED`;
- `POST /orders/:id/release`;
- `POST /orders/:id/start`;
- `POST /orders/:id/components/:componentId/consume`;
- `POST /orders/:id/losses`;
- `POST /orders/:id/outputs`;
- `POST /orders/:id/costs`;
- `POST /orders/:id/complete`;
- `POST /orders/:id/cancel`;
- `GET /orders/:id/shortages`;
- `POST /orders/:id/generate-shortage-requisition`;
- `GET /mrp`;
- `POST /mrp/requisition`.

Listagens seguem o padrão de paginação do ERP.

## Permissões

- `admin` / `manager`: criar/editar/liberar/cancelar OP, custos, geração de requisição, sobreprodução excepcional;
- `operator`: iniciar OP liberada, consumir componentes, registrar perdas e apontar saída;
- `director`: leitura e dashboard por padrão;
- `system`: somente chamadas internas explícitas.

Toda operação é isolada por `company_id`.

## UI

Nova navegação: `Produção`.

A página deve conter:

1. dashboard resumido: planejadas, liberadas, em produção, atrasadas, faltas de material;
2. lista paginada de OPs com filtros por status, produto e período;
3. criação/edição de OP;
4. componentes explodidos da BOM;
5. coluna de requerido, reservado, consumido e falta;
6. ação de liberação;
7. geração de requisição de compra quando houver falta;
8. execução com consumo, perdas e apontamentos;
9. custos planejados x realizados;
10. aba MRP com necessidades agregadas e geração de requisição.

A UI deve usar rótulos em português e não expor JSON técnico como interface principal.

## Eventos e auditoria

Registrar auditoria para:

- criação/edição;
- refresh de BOM;
- liberação;
- início;
- consumo;
- perdas;
- apontamento de saída;
- custo adicional;
- geração de requisição;
- conclusão;
- cancelamento;
- sobreprodução excepcional.

Quando apropriado, emitir eventos via outbox existente para estoque/compras sem criar dependência síncrona adicional além dos serviços já usados no runtime.

## Erros, transações e idempotência

- liberação + criação das reservas deve ser atômicas;
- consumo + movimento de estoque + atualização da reserva deve ser atômico;
- apontamento + entrada de estoque + atualização da OP deve ser atômico;
- conclusão + liberação de reservas + status deve ser atômico;
- geração de requisição deve ser idempotente por `source_key`;
- repetição de consumo/output com a mesma chave de idempotência não pode duplicar movimento físico;
- estoque negativo continua proibido pelo domínio de inventory.

## Migração e compatibilidade

A migration `130-manufacturing.js` deve ser aditiva.

Não alterar semanticamente:

- BOM existente;
- PDV;
- vendas administrativas;
- NF-e/NFC-e;
- compras existentes;
- financeiro;
- estoque avançado já disponível.

A única infraestrutura compartilhada nova é o serviço genérico sobre `inventory_reservations` e, se necessário, coluna aditiva de quantidade consumida.

## Testes obrigatórios

### Domínio

Cobrir no mínimo:

- criação de OP com snapshot da BOM;
- falha sem BOM;
- recálculo de quantidade `PLANNED`;
- refresh explícito de BOM;
- liberação com estoque suficiente;
- liberação bloqueada por falta;
- reservas considerando outras reservas ativas;
- geração de requisição sem duplicidade;
- início;
- consumo parcial/total;
- consumo acima da reserva bloqueado;
- perda de componente;
- refugo de saída;
- saída parcial de produto acabado;
- sobreprodução bloqueada e exceção autorizada;
- custo planejado e realizado;
- conclusão apenas quando quantidade planejada estiver resolvida;
- liberação de reservas remanescentes;
- cancelamento por estado;
- isolamento multiempresa;
- RBAC;
- MRP com minStock/targetStock e múltiplas OPs.

### API

Cobrir contratos, filtros, paginação, transições inválidas, idempotência e erros de permissão.

### E2E Electron

Fluxo mínimo:

1. usar produto manufaturado com BOM;
2. criar OP;
3. liberar;
4. iniciar;
5. consumir componentes;
6. apontar saída;
7. registrar custo adicional;
8. concluir;
9. validar entrada do acabado e custo da ordem.

Adicionar cenário de falta de material:

1. criar OP sem estoque suficiente;
2. liberação falhar com shortages;
3. gerar requisição;
4. verificar vínculo sem duplicação.

## Critérios de aceite

O módulo será considerado concluído quando:

- uma OP puder percorrer todo o ciclo pela UI e API;
- BOM for reutilizada e snapshotada sem duplicação de cadastro;
- reservas impedirem concorrência de estoque entre vendas, OS e produção;
- consumo e saída alterarem estoque corretamente;
- faltas gerarem necessidade clara e requisição de compra idempotente;
- MRP considerar estoque, reservas, OPs abertas e política mínima/alvo;
- custos planejados e realizados forem visíveis;
- conclusão liberar reservas e preservar rastreabilidade;
- multiempresa e RBAC funcionarem;
- migrations preservarem bases existentes;
- testes de domínio, API, E2E e gates atuais passarem;
- Fiscal Core atual permanecer inalterado.
