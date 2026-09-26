# ArtiSys ERP — Evolução de Serviços / Ordens de Serviço

Data: 2026-09-26
Base revisada: `main` em `c0af43356be0cebe2b51abecd6a62c68907fbec0`
Branch: `feat/service-orders-manufacturing`

## Objetivo

Evoluir a infraestrutura de Ativos / Ordens de Serviço que já existe na `main` para um módulo operacional completo de serviços, sem recriar entidades, workflows ou infraestrutura já incorporados ao ERP.

A `main` atual já contém `assets`, `service_orders`, `maintenance_plans`, `maintenance_history`, filiais, workflows genéricos, aprovações, alertas, notificações, tabelas de preço, BI e projetos. Esta entrega deve reutilizar essas estruturas.

## Reuso obrigatório da main atual

Não criar novamente:

- `assets`;
- `service_orders`;
- `maintenance_plans`;
- `maintenance_history`;
- filiais (`company_branches`);
- workflows genéricos;
- aprovações genéricas;
- alertas operacionais;
- notificações;
- tabelas de preço;
- dashboards/BI;
- armazenamento de documentos;
- infraestrutura de impressão/PDF.

A implementação deve evoluir os serviços existentes e manter compatibilidade com `/api/v1/ops/assets`, `/api/v1/ops/service-orders` e manutenção.

## Catálogo de serviços

Não criar tabela paralela de serviços.

Reutilizar `products` como catálogo vendável e acrescentar suporte a `product_type='SERVICE'`.

Regras:

- serviço usa `trackStock=false`;
- `salePriceCents` continua sendo o preço padrão;
- tabelas de preço existentes podem ser aplicadas a serviços;
- `attributes_json` pode guardar metadados como duração estimada e especialidade;
- produto `SERVICE` não participa de BOM nem de reserva de estoque;
- os tipos já existentes (`STANDARD`, `VARIANT`, `KIT`, `MANUFACTURED`) permanecem válidos.

## Ativos

Reutilizar `assets`.

A migration compartilhada deve adicionar apenas o que falta para uso em OS de cliente:

- `customer_id` opcional referenciando `contacts`;
- índice por `company_id, customer_id`.

Marca, modelo e demais dados específicos continuam em `metadata_json`; não criar uma segunda tabela de equipamentos.

## Ordens de serviço

Reutilizar `service_orders` como cabeçalho.

Adicionar de forma aditiva os campos operacionais ausentes:

- `location_id`;
- `technician_user_id` opcional;
- `diagnosis`;
- `notes`;
- `approved_at`;
- `started_at`;
- `completed_at`;
- `cancelled_at`;
- `cancellation_reason`;
- `service_total_cents`;
- `parts_total_cents`;
- `total_cents`;
- `receivable_entry_id`;
- `completion_idempotency_key`.

Preservar os campos atuais (`branch_id`, `asset_id`, `customer_id`, `number`, `title`, `description`, `priority`, `opened_at`, `due_at`, `closed_at`, `history_json`).

Registros legados com status `CLOSED` permanecem legíveis e são tratados como terminal/concluído. Novas OS usam o ciclo de estados definido abaixo.

## Linhas da OS

Criar apenas a estrutura que ainda não existe: `service_order_lines`.

Campos mínimos:

- `id`;
- `service_order_id`;
- `product_id`;
- `line_type` (`SERVICE` ou `PART`);
- `description_snapshot`;
- `quantity`;
- `unit_price_cents`;
- `reservation_id` opcional;
- `consumed_quantity`;
- `created_at`;
- `updated_at`.

Regras:

- `SERVICE`: produto precisa ter `product_type='SERVICE'`, sem reserva;
- `PART`: produto normal; se `trackStock=true`, usa reserva;
- preço e descrição são snapshot para preservar o orçamento;
- tabelas de preço existentes podem fornecer `unit_price_cents` antes do snapshot.

## Reserva de estoque compartilhada

A tabela `inventory_reservations` já existe. Não criar uma segunda estrutura.

Criar `js/domains/inventory/inventory-reservation-service.js` como contrato genérico para OS e Produção.

A migration compartilhada adiciona, se ainda ausente:

- `consumed_quantity REAL NOT NULL DEFAULT 0`.

Métodos:

- `getAvailable(productId, locationId)`;
- `reserve(input, actor)`;
- `consume(reservationId, quantity, movementContext, actor)`;
- `release(reservationId, actor)`;
- `getReservation(id)`;
- `listReservations(filters)`.

Disponibilidade:

`saldo físico - soma do saldo remanescente de todas as reservas ACTIVE`.

Assim, reservas de vendas, OS e Produção concorrem pelo mesmo estoque.

Consumo da reserva e movimento físico devem ser atômicos.

## Serviço de domínio

Criar `js/domains/services/service-order-service.js` para evoluir a lógica existente.

Não criar um segundo armazenamento de OS.

O `operations-suite` deve delegar suas operações legadas de OS ao novo serviço, preservando compatibilidade da API antiga e impedindo que `setServiceOrderStatus` continue burlando as regras do novo ciclo.

Manutenção preventiva continua no `operations-suite` existente e passa a poder abrir/associar uma OS operacional quando necessário, sem nova tabela.

## Ciclo de vida

Novos estados:

- `OPEN`;
- `APPROVED`;
- `WAITING_PARTS`;
- `IN_PROGRESS`;
- `COMPLETED`;
- `CANCELLED`.

`CLOSED` é aceito somente como status legado terminal.

### OPEN

- cabeçalho e linhas editáveis;
- técnico pode ser definido;
- nenhum recebível;
- nenhum consumo físico.

### Aprovação

`approve`:

1. valida cliente, filial/local e linhas;
2. congela quantidades e preços do orçamento;
3. tenta reservar as peças controladas em estoque;
4. se todas forem cobertas, vai para `APPROVED`;
5. se houver falta, vai para `WAITING_PARTS` e retorna shortages.

Não criar tabela de aprovação própria. Aprovação interna sofisticada, se configurada futuramente, usa `generic_approvals` já existente.

### WAITING_PARTS

- orçamento permanece aprovado;
- não pode iniciar;
- `retry-parts` tenta apenas linhas pendentes;
- quando todas forem reservadas, vai para `APPROVED`;
- falta de peça pode gerar `operational_alert` existente, sem nova tabela de alertas.

### APPROVED

- preços e quantidades comerciais congelados;
- todas as peças necessárias estão reservadas;
- `start` muda para `IN_PROGRESS`.

### IN_PROGRESS

- permite consumo parcial das reservas;
- movimento usa `source_type='service-order'` e `source_id=<os-id>`;
- diagnóstico e observações operacionais podem ser atualizados;
- peça adicional exige ação explícita `add-extra-part`: cria uma nova linha, tenta reservar e registra auditoria.

### COMPLETED

`complete`:

1. exige `IN_PROGRESS`;
2. libera reservas remanescentes;
3. totaliza serviços aprovados e apenas peças efetivamente consumidas;
4. cria exatamente um `RECEIVABLE` no financeiro;
5. grava `receivable_entry_id`;
6. marca `COMPLETED`, `completed_at` e `closed_at`;
7. registra auditoria.

A conclusão é idempotente.

Peça reservada e não consumida não é cobrada.

### CANCELLED

- exige motivo;
- libera reservas restantes;
- `IN_PROGRESS` exige `admin` ou `manager`;
- `COMPLETED`/`CLOSED` não pode ser cancelada diretamente.

## Financeiro

Reutilizar `finance`.

Na conclusão:

- `kind='RECEIVABLE'`;
- `source_type='service-order'`;
- `source_id=<os-id>`;
- valor = serviços aprovados + peças consumidas;
- vencimento = `due_at` ou data da conclusão.

Não liquidar automaticamente.

## Documentos e PDF

Reutilizar `documents` para anexos com `entity_type='service-order'` e `entity_id=<os-id>`.

Reutilizar `desktop/document-bridge.cjs` para impressão/PDF. Não criar outro motor de PDF.

O documento não fiscal da OS inclui empresa, cliente, ativo, problema, diagnóstico, técnico, serviços, peças consumidas, totais, status, datas e observações.

NFS-e permanece fora do escopo.

## API

Adicionar endpoints operacionais sob `/api/v1/service-orders`, mas manter a API legada `/api/v1/ops/service-orders` delegando ao mesmo serviço.

Rotas principais:

- `GET /` com paginação e filtros;
- `POST /`;
- `GET /:id`;
- `PATCH /:id` enquanto editável;
- `POST /:id/lines`;
- `PATCH /:id/lines/:lineId`;
- `DELETE /:id/lines/:lineId` enquanto editável;
- `POST /:id/approve`;
- `POST /:id/retry-parts`;
- `POST /:id/start`;
- `POST /:id/parts/:lineId/consume`;
- `POST /:id/add-extra-part`;
- `POST /:id/complete`;
- `POST /:id/cancel`.

Ativos e manutenção continuam usando `/api/v1/ops/*` já existente, apenas ampliados onde necessário.

## UI

Criar uma experiência dedicada `Serviços`, mas sem duplicar a área `Ativos/OS` de Inteligência.

- `ServicesPage.tsx` será a interface operacional completa;
- o tab `Ativos/OS` de `IntelligencePage` vira resumo/atalho para Serviços, ou é removido se redundante;
- manutenção preventiva existente aparece em uma aba da área Serviços reutilizando os dados atuais;
- nenhuma segunda tela independente para os mesmos registros.

A tela inclui lista de OS, orçamento, disponibilidade/reservas, execução, consumo, anexos, manutenção relacionada, conclusão e PDF.

## BI, alertas e workflows

Não criar serviços paralelos.

- indicadores agregados de OS podem ser acrescentados ao `businessIntelligence` existente;
- atrasos/faltas usam `operational_alerts`;
- notificações usam `notifications`;
- aprovações internas opcionais usam `generic_approvals`;
- workflows configuráveis continuam disponíveis, mas o estado oficial da OS permanece `service_orders.status` para não duplicar estado persistido.

## Migrações

Não usar números 120 ou 130, pois já pertencem ao Fiscal Core e Utilities P0-P2.

Planejamento:

- `140-shared-operations-extension.js`: extensão de `inventory_reservations` e `assets`;
- `141-service-orders-operational.js`: extensão de `service_orders` e criação de `service_order_lines`.

Migrations são estritamente aditivas e preservam dados existentes.

## Permissões

- `admin` / `manager`: gestão integral, aprovação, conclusão, cancelamento;
- `operator`: criar/editar OPEN, iniciar, consumir peças, atualizar execução;
- `director`: leitura/BI por padrão;
- `system`: apenas integração interna explícita.

Todas as consultas/escritas respeitam `company_id`.

## Testes obrigatórios

Cobrir:

- compatibilidade de OS legadas da Utilities P0-P2;
- produto `SERVICE` sem estoque;
- ativo existente vinculado a cliente;
- criação/edição de OS;
- tabela de preço aplicada sem duplicar pricing;
- aprovação com e sem estoque;
- WAITING_PARTS e retry;
- concorrência de reservas com venda/produção;
- consumo parcial/total;
- peça extra;
- conclusão cobrando somente peças consumidas;
- recebível único/idempotente;
- cancelamento/liberação de reserva;
- anexos/PDF via infraestrutura existente;
- manutenção existente associada à OS;
- multiempresa e RBAC;
- API nova e API legada delegando ao mesmo domínio;
- E2E Electron do ciclo completo e cenário de falta.

## Critérios de aceite

Concluído quando:

- não existir tabela duplicada de ativos, OS, manutenção, workflow, aprovação, alerta, pricing, documento ou BI;
- OS existente for evoluída, não substituída;
- API antiga continuar funcional e obedecer às novas invariantes;
- produto SERVICE reutilizar catálogo/preços;
- estoque/reservas forem consistentes;
- conclusão gerar um único recebível correto;
- manutenção preventiva existente continuar funcionando;
- UI não duplicar a mesma funcionalidade em duas áreas;
- migrations preservarem bases existentes;
- todos os testes e gates atuais passarem;
- Fiscal Core permanecer inalterado.
