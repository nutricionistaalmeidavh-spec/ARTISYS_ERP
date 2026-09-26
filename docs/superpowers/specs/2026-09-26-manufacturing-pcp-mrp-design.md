# ArtiSys ERP — Produção / PCP-MRP

Data: 2026-09-26
Base revisada: `main` em `c0af43356be0cebe2b51abecd6a62c68907fbec0`
Branch: `feat/service-orders-manufacturing`

## Objetivo

Adicionar PCP/MRP operacional para PME sem recriar infraestrutura já presente na `main`. Produção é um domínio novo; BOM, estoque, reservas, compras, filiais, alertas, notificações, aprovações, BI, documentos e projetos devem ser reutilizados quando aplicável.

## O que já existe e deve ser reutilizado

Não criar novamente:

- catálogo de produtos;
- tipos `MANUFACTURED` e BOM (`product_boms`, `product_bom_items`);
- estoque físico, movimentos e operações;
- lotes/séries/endereçamento/inventory depth;
- `inventory_reservations`;
- requisições/cotações/compras;
- `company_branches`;
- `operational_alerts` e `notifications`;
- workflows e aprovações genéricas;
- BI/dashboards;
- projetos/tarefas;
- documentos/PDF;
- financeiro;
- Fiscal Core.

## Arquitetura

Criar somente:

- `js/domains/manufacturing/manufacturing-service.js`;
- `js/domains/manufacturing/mrp-service.js`;
- `server/routers/manufacturing-router.js`;
- `frontend/src/pages/ManufacturingPage.tsx`;
- migration `150-manufacturing.js`.

Usar o `inventory-reservation-service.js` compartilhado criado na migration/infra `140-shared-operations-extension.js` do módulo de Serviços.

Não criar um segundo serviço de BI. Indicadores de produção entram no `businessIntelligence` existente ou são consultados pelo próprio domínio sem criar infraestrutura paralela.

## Modelo de dados

### `manufacturing_orders`

Campos mínimos:

- `id`;
- `company_id`;
- `branch_id` opcional;
- `product_id`;
- `bom_id`;
- `bom_version`;
- `location_id`;
- `output_location_id`;
- `status`;
- `planned_quantity`;
- `completed_quantity`;
- `scrap_quantity`;
- `planned_start_at`;
- `due_at`;
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

Snapshot da BOM:

- `id`;
- `manufacturing_order_id`;
- `product_id`;
- `quantity_per_unit`;
- `required_quantity`;
- `consumed_quantity`;
- `planned_unit_cost_cents`;
- `actual_cost_cents`;
- `reservation_id` opcional;
- timestamps.

### `manufacturing_outputs`

- `id`;
- `manufacturing_order_id`;
- `quantity`;
- `unit_cost_cents`;
- `inventory_movement_id`;
- `idempotency_key` único;
- `created_by`;
- `created_at`.

### `manufacturing_losses`

- `id`;
- `manufacturing_order_id`;
- `loss_type` (`COMPONENT` ou `OUTPUT`);
- `product_id`;
- `quantity`;
- `reason`;
- `inventory_movement_id` opcional;
- `idempotency_key` único;
- `created_by`;
- `created_at`.

### `manufacturing_cost_entries`

- `id`;
- `manufacturing_order_id`;
- `cost_type` (`LABOR`, `OVERHEAD`, `OTHER`);
- `description`;
- `amount_cents`;
- `idempotency_key` único;
- `created_by`;
- `created_at`.

### `manufacturing_procurement_links`

- `id`;
- `company_id`;
- `manufacturing_order_id` opcional;
- `product_id`;
- `requisition_id`;
- `quantity`;
- `source_key` único;
- `created_at`.

Não criar tabelas novas para alertas, aprovação, filial, projeto ou dashboard.

## BOM

Reutilizar a BOM atual de `retail`/catálogo.

Na criação da OP:

1. exigir produto `MANUFACTURED` ou produto com BOM ativa;
2. obter BOM ativa;
3. copiar versão e componentes para a OP;
4. calcular `required_quantity = quantity_per_unit * planned_quantity`;
5. calcular custo material previsto.

Alteração futura da BOM não modifica OP existente.

Enquanto `PLANNED`, alteração da quantidade recalcula sobre o snapshot atual. Troca de BOM exige `refresh-bom` explícito.

## Estados

- `PLANNED`;
- `RELEASED`;
- `IN_PROGRESS`;
- `COMPLETED`;
- `CANCELLED`.

Falta de material é condição derivada (`materialStatus`), não novo status persistido.

## PLANNED

- editável;
- sem consumo;
- participa do cálculo MRP;
- pode ser cancelada;
- shortages podem ser consultados.

## Liberação

`release`:

1. calcula necessidade remanescente;
2. consulta disponibilidade líquida pelo serviço compartilhado de reservas;
3. se houver falta, mantém `PLANNED` e retorna shortages;
4. se houver estoque, cria todas as reservas atomicamente;
5. muda para `RELEASED`.

A liberação é all-or-nothing.

Não criar mecanismo de aprovação próprio. Se uma empresa desejar aprovação interna da liberação, usar `generic_approvals` existente como extensão opcional, sem duplicar estado da OP.

## RELEASED

- todos os componentes obrigatórios estão reservados;
- `start` muda para `IN_PROGRESS`.

## IN_PROGRESS

Permite:

- consumo parcial de componentes;
- perdas de componente;
- apontamento parcial de produto acabado;
- refugo de saída;
- custos adicionais.

Consumo usa reserva compartilhada e movimento com `source_type='manufacturing-consumption'`.

## Saída de produto acabado

`report-output`:

1. exige `IN_PROGRESS`;
2. valida quantidade positiva;
3. impede sobreprodução por padrão;
4. calcula custo realizado disponível;
5. gera movimento positivo em `output_location_id` com `source_type='manufacturing-output'`;
6. registra output e atualiza `completed_quantity` atomicamente.

Sobreprodução somente com flag explícita e `admin`/`manager`, sempre auditada.

## Perdas e refugo

### COMPONENT

- consumo adicional de matéria-prima;
- reduz estoque;
- aumenta custo real;
- exige motivo.

### OUTPUT

- representa produção rejeitada;
- não entra no estoque de produto acabado;
- aumenta `scrap_quantity`;
- exige motivo.

## Custos

Planejado:

`required_quantity * costPriceCents` por componente.

Real:

- materiais efetivamente consumidos;
- `LABOR`;
- `OVERHEAD`;
- `OTHER`.

`actual_total_cost = material + custos adicionais`.

`actual_unit_cost = actual_total_cost / completed_quantity`.

Refugo permanece absorvido no custo da ordem.

Produção não cria conta a pagar/receber por si só. Compras e vendas continuam responsáveis pelos fatos financeiros.

## Conclusão

`complete`:

1. exige `IN_PROGRESS`;
2. exige `completed_quantity + scrap_quantity == planned_quantity`;
3. libera reservas remanescentes;
4. consolida custos;
5. marca `COMPLETED`.

Não reescrever movimentos históricos de estoque ao recalcular custo final.

## Cancelamento

- `PLANNED`: cancela diretamente;
- `RELEASED`: libera reservas;
- `IN_PROGRESS`: somente `admin`/`manager`, preserva consumos e outputs existentes e libera saldo reservado;
- `COMPLETED`: não cancela diretamente.

## MRP

Criar cálculo sob demanda em `mrp-service.js`, sem serviço cloud.

Entradas:

- saldo físico;
- reservas ativas remanescentes;
- componentes remanescentes de OPs abertas;
- `minStock`;
- `targetStock`;
- requisições de compra já vinculadas ao manufacturing.

### Regra para não contar reservas duas vezes

Para cada componente:

- `physical = saldo físico`;
- `reserved_all = reservas ACTIVE remanescentes de todos os domínios`;
- `reserved_for_open_manufacturing = parcela das reservas ACTIVE pertencente às OPs abertas analisadas`;
- `unreserved_available = physical - reserved_all`;
- `open_requirement = soma(required_quantity - consumed_quantity)`;
- `uncovered_production_requirement = max(0, open_requirement - reserved_for_open_manufacturing)`;
- `projected_after_production = unreserved_available - uncovered_production_requirement`.

Necessidade de segurança:

- se `projected_after_production < minStock`, repor até `targetStock`;
- se `targetStock` for ausente ou menor que `minStock`, usar `minStock`.

Depois subtrair quantidades já cobertas por requisições ligadas ao manufacturing e ainda abertas.

Saída MRP por produto:

- saldo físico;
- reservado total;
- reservado para produção aberta;
- disponível não reservado;
- necessidade de produção não coberta;
- estoque mínimo/alvo;
- quantidade já requisitada;
- necessidade líquida;
- OPs causadoras.

## Compras

Reutilizar `procurementRequisitions.createRequisition`.

Nunca criar pedido de compra diretamente pelo MRP.

Ações:

- `generate-shortage-requisition` para uma OP;
- `generate-mrp-requisition` para necessidade agregada.

Regras:

- somente necessidade positiva;
- agrupar por local;
- `source_key` determinístico;
- `manufacturing_procurement_links` impede duplicidade;
- requisição segue cotação/aprovação/compras existentes.

## Filiais, alertas e notificações

- `branch_id` referencia `company_branches` existente;
- atraso de OP/falta crítica pode criar `operational_alert` existente;
- mensagens ao usuário usam `notifications` existente;
- não criar infraestrutura paralela.

## BI

Estender `businessIntelligence.overview()` com bloco opcional `manufacturing` contendo, no mínimo:

- OPs planejadas;
- liberadas;
- em produção;
- atrasadas;
- custo planejado x realizado;
- shortages relevantes.

Não criar `manufacturing-dashboard-service` separado.

## Projetos

`projects` e `project_tasks` já existem e não serão duplicados.

Nesta entrega, OP não exige projeto. Pode existir `project_id` opcional somente se a implementação mostrar valor concreto para rastreabilidade, sem transformar PCP em gestão de projetos.

## API

Prefixo `/api/v1/manufacturing`:

- `GET /orders`;
- `POST /orders`;
- `GET /orders/:id`;
- `PATCH /orders/:id` enquanto `PLANNED`;
- `POST /orders/:id/refresh-bom`;
- `GET /orders/:id/shortages`;
- `POST /orders/:id/release`;
- `POST /orders/:id/start`;
- `POST /orders/:id/components/:componentId/consume`;
- `POST /orders/:id/losses`;
- `POST /orders/:id/outputs`;
- `POST /orders/:id/costs`;
- `POST /orders/:id/complete`;
- `POST /orders/:id/cancel`;
- `POST /orders/:id/generate-shortage-requisition`;
- `GET /mrp`;
- `POST /mrp/requisition`.

Listagens seguem paginação existente.

## UI

Criar `Produção` como área operacional própria.

Não duplicar BI geral, alertas, aprovações ou projetos.

A página contém:

- lista de OPs;
- estados e atrasos;
- BOM explodida;
- requerido/reservado/consumido/falta;
- release/start;
- consumo/perdas/refugo;
- outputs;
- custos;
- MRP;
- geração de requisição.

Indicadores executivos aparecem também no BI já existente.

## Permissões

- `admin` / `manager`: criar/editar/liberar/cancelar, custos, requisições, sobreprodução excepcional;
- `operator`: iniciar, consumir, registrar perdas e outputs;
- `director`: leitura/BI;
- `system`: integrações internas explícitas.

Isolamento obrigatório por `company_id`.

## Migração

Usar `150-manufacturing.js`.

Não usar `130`, já ocupado por `130-erp-utilities-p0-p2`.

A migration é aditiva e não altera semanticamente BOM, estoque, compras, projetos, BI, Fiscal ou financeiro existentes.

## Testes obrigatórios

Cobrir:

- snapshot da BOM;
- produto sem BOM;
- refresh explícito;
- release com e sem estoque;
- concorrência de reservas com venda e OS;
- consumo parcial/total;
- perda e refugo;
- outputs parciais;
- idempotência de output/perda/custo;
- sobreprodução bloqueada e exceção autorizada;
- custo previsto/real;
- conclusão;
- cancelamento;
- MRP sem dupla contagem de reservas;
- minStock/targetStock;
- requisição sem duplicidade;
- integração com alertas/BI existentes;
- multiempresa/RBAC;
- E2E Electron do ciclo completo e cenário de shortage.

## Critérios de aceite

Concluído quando:

- não houver duplicação de BOM, estoque, reserva, compras, alertas, notificações, workflows, aprovações, filiais, BI ou projetos;
- OP percorrer o ciclo completo na UI/API;
- reservas compartilharem disponibilidade real com vendas e OS;
- MRP não contar demanda/reserva duas vezes;
- shortages puderem virar requisição existente de compras;
- custos e outputs estiverem rastreáveis;
- BI atual receber indicadores de produção sem serviço paralelo;
- migrations preservarem bases existentes;
- todos os gates e E2E passarem;
- Fiscal Core permanecer inalterado.
