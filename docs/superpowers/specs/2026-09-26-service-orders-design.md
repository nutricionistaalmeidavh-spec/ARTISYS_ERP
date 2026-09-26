# ArtiSys ERP — Serviços / Ordens de Serviço

Data: 2026-09-26
Base de referência: `main` em `3f21f3aa2ea384290db2fd37835ed50dba4ee3c7`
Branch de trabalho: `feat/service-orders-manufacturing`

## Objetivo

Adicionar ao ArtiSys ERP um módulo operacional de Serviços / Ordens de Serviço (OS) adequado a PMEs, integrado ao cadastro de clientes, estoque, financeiro, documentos, usuários, auditoria e multiempresa, sem duplicar funcionalidades já existentes e sem introduzir dependências externas obrigatórias.

O módulo deve cobrir o ciclo completo de uma OS: cadastro de serviços, abertura, orçamento, aprovação, reserva de peças, execução, consumo de materiais, conclusão, geração de conta a receber e emissão de documento não fiscal da OS.

## Escopo

Incluído:

- catálogo de serviços;
- ativos/equipamentos opcionais vinculados ao cliente;
- abertura e edição de OS;
- técnico/responsável;
- problema relatado, diagnóstico e observações;
- linhas de serviço e linhas de peças;
- orçamento e aprovação;
- reserva de peças em estoque;
- estado `WAITING_PARTS` para OS aprovada com falta de material;
- execução da OS;
- consumo das peças reservadas;
- liberação do saldo de reserva não consumido;
- conclusão e cancelamento;
- geração idempotente de conta a receber na conclusão;
- anexos usando o serviço de documentos existente;
- histórico/auditoria;
- listagem, busca, filtros e paginação;
- impressão/PDF não fiscal da OS;
- isolamento por empresa;
- API e tela React;
- testes de domínio, API e E2E.

Fora do escopo:

- NFS-e;
- contratos de manutenção recorrente;
- agenda/calendário avançado de técnicos;
- roteirização de equipes externas;
- assinatura eletrônica;
- portal do cliente;
- garantia/RMA avançado;
- integração com WhatsApp ou CRM;
- alterações no Fiscal Core atual de NF-e/NFC-e.

## Arquitetura

Criar um domínio isolado em `js/domains/services/`.

Componentes previstos:

- `service-catalog-service.js`: catálogo de serviços;
- `customer-asset-service.js`: ativos/equipamentos do cliente;
- `service-order-service.js`: ciclo de vida da OS;
- `service-order-document-service.js`: documento imprimível/PDF não fiscal da OS;
- `server/routers/service-orders-router.js`: API HTTP;
- `frontend/src/pages/ServiceOrdersPage.tsx`: UI React;
- migration dedicada `120-service-orders.js`.

A integração com estoque não deve acessar tabelas de reserva diretamente. Como OS e Produção precisam da mesma capacidade, será criado um serviço genérico de reservas em `js/domains/inventory/inventory-reservation-service.js`, operando sobre a tabela `inventory_reservations` já existente.

Esse serviço será infraestrutura compartilhada e não substituirá, nesta entrega, os fluxos internos já existentes de reservas de vendas administrativas. A migration poderá acrescentar metadados aditivos à tabela existente, sem quebrar consumidores atuais.

## Modelo de dados

### `service_catalog_items`

Campos mínimos:

- `id`;
- `company_id`;
- `code`;
- `name`;
- `description`;
- `unit`;
- `default_price_cents`;
- `estimated_minutes`;
- `active`;
- `created_at`;
- `updated_at`.

Regra: `code` é único por empresa quando preenchido.

### `customer_assets`

Campos mínimos:

- `id`;
- `company_id`;
- `customer_id`;
- `name`;
- `brand`;
- `model`;
- `serial_number`;
- `notes`;
- `active`;
- `created_at`;
- `updated_at`.

O ativo é opcional para a OS. Não se cria um novo cadastro de clientes: `customer_id` referencia o contato já existente.

### `service_orders`

Campos mínimos:

- `id`;
- `company_id`;
- `customer_id`;
- `asset_id` opcional;
- `location_id`;
- `technician_user_id` opcional;
- `status`;
- `problem_description`;
- `diagnosis`;
- `notes`;
- `due_at` opcional;
- `approved_at`;
- `started_at`;
- `completed_at`;
- `cancelled_at`;
- `cancellation_reason`;
- `service_total_cents`;
- `parts_total_cents`;
- `total_cents`;
- `receivable_entry_id` opcional;
- `idempotency_key` para conclusão/faturamento;
- `created_by`;
- `created_at`;
- `updated_at`.

### `service_order_lines`

Tabela única para evitar duplicação entre serviço e peça.

Campos mínimos:

- `id`;
- `service_order_id`;
- `line_type` em `SERVICE` ou `PART`;
- `service_catalog_item_id` opcional;
- `product_id` opcional;
- `description_snapshot`;
- `quantity`;
- `unit_price_cents`;
- `estimated_minutes` opcional;
- `reservation_id` opcional;
- `consumed_quantity` para peças;
- `created_at`;
- `updated_at`.

Regras:

- linha `SERVICE` exige `service_catalog_item_id` e não possui reserva;
- linha `PART` exige `product_id`;
- preço e descrição ficam em snapshot na OS para preservar histórico;
- peças sem controle de estoque não precisam de reserva, mas continuam registradas na OS.

### Histórico

A auditoria global existente continuará sendo a fonte oficial de trilha. Não é necessário criar uma segunda tabela de histórico se as transições e alterações relevantes forem registradas por `writeAudit`.

## Serviço genérico de reservas de estoque

### Objetivo

Expor uma interface reutilizável para OS e Produção usando `inventory_reservations`.

Métodos conceituais:

- `getAvailable(productId, locationId)`;
- `reserve(input, actor)`;
- `consume(reservationId, quantity, movementContext, actor)`;
- `release(reservationId, actor)`;
- `getReservation(id)`;
- `listReservations(filters)`.

### Disponibilidade

`available = saldo físico - quantidade ativa ainda não consumida de todas as reservas`.

Reservas de vendas já existentes devem reduzir a disponibilidade vista por OS e Produção.

### Compatibilidade

Adicionar, se necessário, `consumed_quantity REAL NOT NULL DEFAULT 0` a `inventory_reservations`. A semântica dos estados existentes permanece:

- `ACTIVE`: saldo reservado ainda disponível;
- `CONSUMED`: reserva totalmente consumida;
- `RELEASED`: saldo remanescente liberado.

O consumo deve executar movimento de estoque e atualização da reserva na mesma transação do banco.

## Ciclo de vida da OS

Estados persistidos:

- `OPEN`;
- `APPROVED`;
- `WAITING_PARTS`;
- `IN_PROGRESS`;
- `COMPLETED`;
- `CANCELLED`.

### `OPEN`

- OS editável;
- serviços, peças, técnico e diagnóstico podem ser alterados;
- nenhum recebível é criado;
- nenhuma peça é consumida;
- orçamento é calculado a partir das linhas.

### Aprovação

A ação `approve`:

1. valida cliente, local e linhas;
2. congela a versão comercial atual do orçamento;
3. tenta reservar todas as peças controladas em estoque;
4. registra `approved_at`;
5. vai para `APPROVED` se todas as peças forem reservadas;
6. vai para `WAITING_PARTS` se uma ou mais peças não puderem ser reservadas.

A aprovação não pode deixar reserva parcial inconsistente: reservas bem-sucedidas de outras linhas são mantidas e identificadas; as linhas faltantes permanecem sem reserva. A resposta deve listar faltas por produto e quantidade.

### `WAITING_PARTS`

- representa OS comercialmente aprovada, porém bloqueada por material;
- ação `retry-parts` tenta reservar somente as linhas pendentes;
- quando todas as peças necessárias estiverem reservadas, o status passa para `APPROVED`;
- não permite iniciar a execução enquanto houver falta.

### `APPROVED`

- orçamento aprovado;
- peças necessárias reservadas;
- ação `start` muda para `IN_PROGRESS`.

### `IN_PROGRESS`

- permite registrar consumo parcial de peças reservadas;
- consumo efetua movimento negativo no estoque com `source_type='service-order'` e `source_id` da OS;
- não permite consumir quantidade acima do saldo reservado;
- técnico pode atualizar diagnóstico e observações operacionais;
- preços aprovados não são alterados nesta fase.

### Conclusão

A ação `complete`:

1. valida status `IN_PROGRESS`;
2. libera toda quantidade reservada que não foi consumida;
3. recalcula totais a partir das linhas aprovadas;
4. cria uma única conta a receber em `finance` com `source_type='service-order'` e `source_id` da OS;
5. grava `receivable_entry_id`;
6. marca `COMPLETED` e `completed_at`;
7. registra auditoria.

A operação deve ser idempotente. Repetir a conclusão não pode gerar segundo recebível.

O valor cobrado é o valor aprovado das linhas da OS. Consumo físico menor que a quantidade orçada deve exigir ajuste explícito antes do início; após `APPROVED`, valores e quantidades comerciais ficam bloqueados para evitar divergência entre orçamento e cobrança.

### Cancelamento

- exige motivo;
- permitido em `OPEN`, `APPROVED` ou `WAITING_PARTS`;
- `IN_PROGRESS` só pode ser cancelada por `admin` ou `manager` e deve liberar reservas remanescentes;
- OS concluída não pode ser cancelada diretamente; eventual estorno financeiro é fluxo separado do módulo financeiro.

## Financeiro

Na conclusão, criar entrada:

- `kind='RECEIVABLE'`;
- descrição contendo número/ID da OS;
- valor igual ao total aprovado;
- vencimento em `due_at` se informado, senão data de conclusão;
- `source_type='service-order'`;
- `source_id=<os-id>`.

Não liquidar automaticamente. O recebimento segue o fluxo financeiro existente.

## Documentos e anexos

Anexos devem usar o serviço `documents` existente, vinculados por metadados de entidade (`service-order`, ID da OS) sem criar armazenamento paralelo.

O documento de OS é não fiscal e deve incluir:

- empresa;
- cliente;
- ativo/equipamento se houver;
- problema relatado;
- diagnóstico;
- técnico;
- serviços;
- peças;
- quantidades e preços;
- totais;
- status;
- datas relevantes;
- observações.

Não incluir DANFE, NF-e, NFC-e ou NFS-e.

## API

Prefixo: `/api/v1/service-orders`.

Rotas mínimas:

- `GET /services`;
- `POST /services`;
- `PATCH /services/:id`;
- `GET /assets`;
- `POST /assets`;
- `PATCH /assets/:id`;
- `GET /` com filtros/paginação;
- `POST /`;
- `GET /:id`;
- `PATCH /:id` somente nos campos permitidos pelo estado;
- `POST /:id/approve`;
- `POST /:id/retry-parts`;
- `POST /:id/start`;
- `POST /:id/parts/:lineId/consume`;
- `POST /:id/complete`;
- `POST /:id/cancel`;
- `GET /:id/document`.

As respostas de listagem seguem o padrão de paginação já usado no ERP.

## Permissões

- `admin` / `manager`: catálogo de serviços, ativos, aprovação, conclusão, cancelamento e administração integral;
- `operator`: criar/editar OS `OPEN`, iniciar OS aprovada, registrar consumo e atualizar diagnóstico/observações;
- `director`: leitura e relatórios, sem alteração operacional por padrão;
- `system`: permitido apenas em integrações internas explícitas.

Toda escrita deve validar `company_id` pelo contexto autenticado; IDs de outra empresa devem responder como não encontrados/indisponíveis, nunca vazar dados.

## UI

Nova navegação: `Serviços`.

A página deve conter:

1. painel/lista de OS com busca, status, cliente, técnico e período;
2. criação/edição de OS;
3. aba de orçamento com linhas de serviço e peças;
4. indicador claro de peças reservadas/faltantes;
5. ação de aprovar/reprocessar reserva;
6. execução com consumo de peças;
7. anexos;
8. conclusão e impressão/PDF;
9. cadastros auxiliares de serviços e ativos.

A UI deve traduzir os estados para português e evitar expor JSON técnico ao usuário final.

## Erros, transações e idempotência

- aprovação e reservas devem ser transacionais por linha e produzir diagnóstico explícito de faltas;
- consumo de reserva + movimento de estoque deve ser atômico;
- conclusão + criação de recebível + mudança de status deve ser atômico;
- ações destrutivas ou financeiras exigem chave de idempotência quando expostas por API;
- falha parcial não pode deixar OS `COMPLETED` sem recebível ou reserva consumida sem movimento de estoque.

## Migração e compatibilidade

A migration `120-service-orders.js` deve ser aditiva.

Não alterar semanticamente:

- vendas administrativas;
- PDV;
- NF-e/NFC-e;
- compras;
- conciliação financeira;
- reservas existentes de vendas.

Se `inventory_reservations` receber `consumed_quantity`, o valor padrão zero deve manter dados antigos válidos.

## Testes obrigatórios

### Domínio

Cobrir no mínimo:

- catálogo de serviços;
- ativo do cliente;
- criação e edição de OS;
- aprovação com estoque suficiente;
- aprovação com falta e `WAITING_PARTS`;
- retry de reservas;
- início bloqueado quando há falta;
- consumo parcial e total;
- bloqueio de consumo acima da reserva;
- conclusão com recebível único;
- conclusão idempotente;
- liberação de reserva não consumida;
- cancelamento e liberação de reservas;
- isolamento multiempresa;
- RBAC.

### API

Cobrir contratos das rotas e erros de estado/permissão.

### E2E Electron

Fluxo mínimo:

1. cadastrar serviço;
2. criar OS para cliente;
3. adicionar serviço e peça;
4. aprovar;
5. iniciar;
6. consumir peça;
7. concluir;
8. confirmar recebível criado;
9. gerar/abrir documento da OS.

Adicionar segundo cenário de `WAITING_PARTS`.

## Critérios de aceite

O módulo será considerado concluído quando:

- todo o ciclo da OS funcionar na UI e API;
- reserva e consumo de peças respeitarem disponibilidade real incluindo outras reservas;
- falta de peça resultar em `WAITING_PARTS`, não em estoque negativo;
- a conclusão gerar exatamente um recebível;
- anexos e documento imprimível funcionarem;
- multiempresa e RBAC forem respeitados;
- migrations preservarem bases existentes;
- testes de domínio, API, E2E e gates atuais do repositório passarem;
- nenhum fluxo fiscal atual for alterado ou duplicado.
