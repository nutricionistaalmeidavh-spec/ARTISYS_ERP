# ArtiSys ERP — Rastreabilidade ponta a ponta de produto, custo, margem e lead time

Data: 2026-09-26
Status: design aprovado em conversa; aguardando revisão formal do documento antes do plano de implementação.

## 1. Objetivo

Criar uma camada transversal de rastreabilidade que conecte compra, recebimento, estoque, ordem de serviço, produção, venda administrativa, PDV, financeiro e BI sem duplicar os lançamentos já existentes.

O ERP deve conseguir responder, de forma auditável, para um produto vendido ou consumido:

- de qual compra/recebimento aquele custo se originou;
- de qual fornecedor e cotação veio;
- por quais movimentações de estoque passou;
- se foi consumido em OS, produção, venda administrativa ou PDV;
- qual foi o custo efetivamente realizado;
- qual foi a receita correspondente;
- qual foi o CMV/custo realizado;
- qual foi a margem bruta em valor e percentual;
- quanto tempo levou entre pedido, recebimento, consumo e venda;
- quais fornecedores, compras e operações explicam os indicadores gerenciais.

A implementação deve preservar o princípio local-first do produto e não pode depender de SaaS pago ou serviço externo obrigatório.

## 2. Estado atual relevante

A main atual já possui:

- compras com requisição, cotação, adjudicação, pedido, recebimento e contas a pagar;
- estoque com movimentações, reservas, lotes, séries, FIFO/FEFO, inventário, transferências e rastreabilidade operacional;
- venda administrativa com orçamento, pedido, reserva, faturamento, estoque e contas a receber;
- PDV com caixa, venda, baixa de estoque, recebível e liquidação por forma de pagamento;
- OS com reserva/consumo de peças e geração de conta a receber;
- manufatura com BOM, OP, consumo de componentes, custos adicionais, perdas e produto acabado;
- MRP com geração de requisição de compra;
- financeiro consolidado com DRE, fluxo de caixa, conciliação e centros de custo;
- relatórios e BI, porém ainda sem consolidação uniforme entre venda administrativa, PDV, OS e manufatura.

As movimentações de estoque já guardam `product_id`, `location_id`, `delta_qty`, `unit_cost_cents`, `source_type` e `source_id`. O novo desenho deve aproveitar esses vínculos e evitar reescrever módulos maduros.

## 3. Decisão arquitetural

Será adotado um **ledger de rastreabilidade com camadas de custo**, em vez de depender apenas de consultas retrospectivas ou de reestruturar o ERP em event sourcing completo.

Cada entrada de estoque elegível cria uma camada de origem imutável. Cada consumo/saída elegível cria alocações contra uma ou mais camadas. Essas alocações preservam o custo histórico realizado mesmo que o custo cadastral do produto mude posteriormente.

### 3.1. Princípios

1. O estoque físico continua sendo autoridade para saldo operacional.
2. O ledger de rastreabilidade é autoridade para origem, consumo e custo histórico.
3. Financeiro continua sendo autoridade para títulos, baixas e fluxo de caixa.
4. Relatórios/BI passam a consumir fatos comerciais/custos normalizados em vez de consultar apenas uma origem de venda.
5. Nenhuma operação deve gerar dupla contabilização financeira.
6. Todas as mutações críticas devem ser idempotentes.
7. Histórico não deve ser reescrito por alteração posterior de preço/custo cadastral.
8. Devoluções e estornos devem criar movimentos compensatórios, nunca apagar histórico.

## 4. Novos componentes

### 4.1. Inventory Cost Ledger

Responsável por criar e consumir camadas de custo.

Responsabilidades:

- criar camada em recebimento de compra;
- criar camada em produção concluída;
- opcionalmente criar camada em ajuste positivo autorizado;
- consumir camadas em venda administrativa, PDV, OS e produção;
- respeitar política FIFO/FEFO quando aplicável;
- preservar lote/série quando houver rastreamento específico;
- suportar consumo parcial;
- suportar devolução/reversão;
- expor custo realizado por operação e por produto.

Interface conceitual:

- `createLayer(input, actor)`
- `allocateOutflow(input, actor)`
- `reverseAllocation(input, actor)`
- `traceProduct(productId, filters)`
- `traceSource(sourceType, sourceId)`
- `getRealizedCost(sourceType, sourceId)`

### 4.2. Traceability Graph Service

Responsável por reconstruir a cadeia econômica e operacional entre entidades já existentes.

Relacionamentos mínimos:

- requisition -> quotation -> award -> purchase order -> purchase receipt;
- purchase receipt -> cost layer;
- cost layer -> inventory movement/transfer;
- cost layer -> sales invoice item;
- cost layer -> POS sale item;
- cost layer -> service order line consumption;
- cost layer -> manufacturing component consumption;
- manufacturing order -> finished-goods cost layer;
- sale/OS -> financial entry -> settlement;
- fiscal document -> sale/administrative invoice, quando aplicável.

O serviço não deve duplicar entidades de domínio. Ele deve manter links/fatos de rastreabilidade e consultar os domínios originais para detalhes.

### 4.3. Commercial Fact Service

Responsável por normalizar receitas, custos, devoluções e margens de todos os canais comerciais.

Origens mínimas:

- `ADMIN_INVOICE`
- `POS_SALE`
- `SERVICE_ORDER`

Campos mínimos por fato:

- companyId;
- sourceType/sourceId;
- productId quando aplicável;
- customerId quando aplicável;
- quantity;
- revenueCents;
- realizedCostCents;
- grossMarginCents;
- grossMarginPercent;
- occurredAt;
- financialEntryId;
- return/reversal linkage quando aplicável.

Esse serviço deve impedir que o mesmo fato seja contado novamente via `financial_entries` genéricos na DRE.

### 4.4. Product Performance Analytics

Responsável por indicadores por produto, fornecedor e canal.

Indicadores mínimos:

- quantidade comprada;
- custo médio de aquisição;
- último custo de aquisição;
- quantidade vendida;
- receita;
- CMV/custo realizado;
- margem bruta em valor;
- margem bruta percentual;
- preço médio de venda;
- lead time pedido de compra -> recebimento;
- lead time recebimento -> venda/consumo;
- lead time pedido de compra -> venda/consumo;
- estoque atual;
- valor atual do estoque pelas camadas remanescentes;
- devoluções em quantidade e valor;
- uso em OS;
- uso em produção;
- fornecedores efetivamente consumidos;
- margem por fornecedor quando houver amostra suficiente.

## 5. Modelo de dados proposto

Os nomes abaixo são normativos para o plano, salvo impedimento técnico encontrado na implementação.

### 5.1. `inventory_cost_layers`

Campos mínimos:

- `id`
- `company_id`
- `product_id`
- `location_id`
- `lot_id` nullable
- `serial_id` nullable
- `source_type`
- `source_id`
- `source_item_id` nullable
- `supplier_id` nullable
- `purchase_order_id` nullable
- `purchase_receipt_id` nullable
- `manufacturing_order_id` nullable
- `original_quantity`
- `remaining_quantity`
- `unit_cost_cents`
- `received_at`
- `created_at`

### 5.2. `inventory_cost_allocations`

Campos mínimos:

- `id`
- `company_id`
- `layer_id`
- `product_id`
- `quantity`
- `unit_cost_cents`
- `total_cost_cents`
- `destination_type`
- `destination_id`
- `destination_item_id` nullable
- `allocated_at`
- `reversed_allocation_id` nullable
- `idempotency_key`

`destination_type` deve suportar no mínimo:

- `SALES_ADMIN_INVOICE`
- `POS_SALE`
- `SERVICE_ORDER`
- `MANUFACTURING_ORDER`

### 5.3. `traceability_links`

Tabela genérica somente para relações que não estejam representadas de forma confiável por FK já existente.

Campos:

- `id`
- `company_id`
- `from_type`
- `from_id`
- `to_type`
- `to_id`
- `relation_type`
- `metadata_json`
- `created_at`

Não duplicar vínculo quando uma FK existente já for suficiente para reconstrução.

### 5.4. `commercial_facts`

Materialização opcional para estabilidade de BI e performance. Se implementada, deve ser derivável e idempotente.

Campos mínimos:

- `id`
- `company_id`
- `source_type`
- `source_id`
- `source_item_id` nullable
- `product_id` nullable
- `customer_id` nullable
- `quantity`
- `revenue_cents`
- `realized_cost_cents`
- `gross_margin_cents`
- `occurred_at`
- `financial_entry_id` nullable
- `reversal_of_id` nullable

## 6. Fluxos obrigatórios

### 6.1. Compra até venda administrativa

1. Requisição é criada.
2. Cotação é criada/enviada.
3. Adjudicação seleciona fornecedor.
4. Pedido de compra é gerado.
5. Recebimento gera entrada física.
6. Cada item recebido cria camada de custo com vínculo ao fornecedor/pedido/recebimento.
7. Confirmação de pedido de venda reserva estoque sem consumir camada.
8. Faturamento consome camada(s) conforme política.
9. Fatura gera conta a receber, como já ocorre.
10. Fato comercial recebe receita e CMV realizado.
11. BI calcula margem e lead times.

### 6.2. Compra até PDV

1. Recebimento cria camada.
2. Venda PDV baixa estoque.
3. No mesmo transaction boundary, consumo da camada é registrado.
4. Recebível e settlements continuam sendo criados como atualmente.
5. Fato comercial registra receita e CMV.
6. Fechamento de caixa permanece baseado nas formas de pagamento.
7. Relatório consolidado de vendas passa a incluir PDV.

### 6.3. Compra até Ordem de Serviço

1. Recebimento cria camada.
2. Aprovação da OS apenas reserva quantidade; não reconhece custo ainda.
3. `consumePart` consome camada na quantidade efetivamente usada.
4. Conclusão da OS gera conta a receber como atualmente.
5. O custo das peças é a soma das alocações efetivamente consumidas.
6. Receita de serviço e receita de peças podem ser apresentadas separadamente.
7. Margem da OS deve distinguir margem conhecida de peças e custo de mão de obra somente quando houver custo/hora configurado. Sem custo/hora, não inventar custo trabalhista.

### 6.4. Compra até produção e produto acabado

1. Recebimento de matéria-prima cria camada.
2. OP reserva componentes.
3. Consumo da OP aloca custos das camadas de componentes.
4. Custos adicionais da OP são somados ao custo material realizado.
5. Quantidade boa produzida recebe nova camada de produto acabado.
6. Custo unitário da camada produzida = custo atribuível / quantidade boa produzida.
7. Refugo/perda deve permanecer rastreado como custo/perda da OP e não ser silenciosamente incorporado a quantidade inexistente.
8. Venda futura do produto acabado consome essa camada e herda a cadeia de origem até os componentes/fornecedores.

### 6.5. Transferências

Transferência entre locais não reconhece receita nem custo novo. Deve mover a disponibilidade da camada preservando origem e custo. A solução pode representar isso por subcamada/localização ou por saldo de camada por localização, desde que a identidade da origem seja preservada.

### 6.6. Devoluções

#### Devolução de venda

- entrada física deve restaurar estoque quando aplicável;
- deve criar reversão/compensação de alocação original;
- deve reduzir receita e CMV proporcionalmente no BI;
- não deve apagar a venda original.

#### Devolução a fornecedor

- deve reduzir/remover disponibilidade das camadas compatíveis;
- deve manter relação com recebimento e crédito do fornecedor;
- custo histórico de saídas já consumidas não pode ser reescrito.

## 7. Política de custo

A política de consumo deve seguir a configuração já suportada pelo estoque:

- FIFO para produtos sem validade quando configurado;
- FEFO quando validade/lote exigir prioridade por vencimento;
- série específica quando número de série determinar a unidade;
- lote específico quando operação selecionar lote.

Se o estoque não tiver rastreamento físico específico, o ledger deve usar a mesma política operacional escolhida para evitar divergência entre saldo físico e custo.

Não usar custo atual do cadastro para reconstruir venda passada.

## 8. Consolidação de relatórios e DRE

### 8.1. Relatório comercial consolidado

Deve consolidar:

- vendas administrativas;
- PDV;
- OS concluídas;
- devoluções/estornos.

Métricas:

- receita bruta;
- devoluções;
- receita líquida;
- CMV/custo realizado;
- margem bruta;
- margem percentual;
- quantidade;
- ticket/preço médio;
- canal;
- produto;
- cliente quando aplicável.

### 8.2. DRE

A DRE não deve duplicar receitas que já tenham sido reconhecidas via fatos comerciais.

Regra:

- fatos comerciais reconhecem receita operacional e CMV dos canais suportados;
- `financial_entries` continua alimentando despesas, outras receitas/custos e itens financeiros;
- recebíveis originados de venda/PDV/OS servem ao fluxo de caixa e liquidação, mas não devem duplicar receita operacional na DRE.

### 8.3. Fluxo de caixa

Permanece baseado em settlements reais. O novo ledger de custo não altera entrada/saída de caixa.

## 9. APIs e consultas

Endpoints/handlers deverão oferecer no mínimo:

- rastreabilidade por produto;
- rastreabilidade por venda/OS/OP/recebimento;
- indicadores de performance por produto;
- indicadores por fornecedor;
- relatório comercial consolidado;
- drill-down da margem até as camadas de custo;
- lead times agregados e individuais.

A UI deve permitir navegar de um indicador agregado até a transação de origem.

## 10. UI mínima

### 10.1. Produto > Rastreabilidade

Exibir linha do tempo ou tabela navegável com:

- cotação;
- fornecedor;
- pedido de compra;
- recebimento;
- lote/série quando houver;
- transferências;
- OS/produção/venda que consumiram o produto;
- custo por origem;
- saldo remanescente da camada.

### 10.2. Produto > Performance

Exibir indicadores definidos na seção 4.4, com filtros por período, empresa, local, fornecedor e canal.

### 10.3. Relatórios > Vendas consolidadas

Permitir separar e consolidar venda administrativa, PDV e OS.

## 11. Tratamento de erros e consistência

- criação da saída física e alocação de custo devem ocorrer atomicamente quando fizerem parte da mesma operação;
- se não houver camada suficiente para produto controlado, a operação deve falhar em vez de gerar CMV inventado;
- inconsistências entre saldo físico e saldo de camadas devem aparecer em health check/diagnóstico;
- idempotência deve impedir alocação duplicada em retries;
- estornos devem ser compensatórios e auditáveis;
- relações de empresa devem respeitar `company_id` em todas as tabelas novas;
- queries de BI não podem misturar empresas sem solicitação explícita de visão consolidada autorizada.

## 12. Migração e compatibilidade

Dados novos devem passar a usar o ledger imediatamente após a migração.

Para dados históricos existentes:

- não inventar origem que não esteja comprovada;
- quando `inventory_movements.source_type/source_id` permitir reconstrução segura, backfill pode criar camadas históricas;
- quando origem exata não for demonstrável, marcar como `LEGACY_UNATTRIBUTED` com custo conhecido disponível no movimento, sem atribuir fornecedor fictício;
- relatórios devem distinguir custo rastreado de custo legado estimado quando houver diferença material.

## 13. Testes obrigatórios

### 13.1. Cenário ponta a ponta principal

Teste E2E/integrado deverá executar:

produto -> requisição -> cotação -> adjudicação -> pedido de compra -> recebimento -> camada de custo -> estoque -> OS parcial -> venda administrativa -> PDV -> financeiro -> BI -> DRE -> rastreabilidade.

Validar:

- quantidade física final;
- quantidade remanescente por camada;
- contas a pagar/receber;
- settlements quando aplicável;
- receita por canal;
- CMV por canal;
- margem por produto;
- lead time compra-recebimento;
- lead time recebimento-venda;
- lead time pedido-venda;
- trilha até fornecedor/cotação;
- ausência de dupla contabilização na DRE.

### 13.2. Cenários adicionais

Obrigatórios:

- duas compras do mesmo produto com custos distintos;
- recebimento parcial;
- consumo parcial de camada;
- FIFO;
- FEFO;
- lote;
- número de série;
- transferência entre locais;
- devolução parcial de venda;
- devolução a fornecedor;
- OS cancelada antes de consumo;
- OS com consumo parcial de peças;
- produção com matéria-prima de múltiplas compras;
- refugo na produção;
- produto acabado vendido após produção;
- retry/idempotência;
- reversão sem reescrever histórico;
- isolamento multiempresa;
- relatório consolidado incluindo venda administrativa + PDV + OS;
- DRE sem duplicidade entre fato comercial e financial_entries.

## 14. Critérios de aceite

A entrega só pode ser considerada concluída quando:

1. uma unidade/quantidade vendida puder ser rastreada até a(s) camada(s) de custo que a originaram;
2. a camada recebida puder ser rastreada até fornecedor, pedido e recebimento quando essa origem existir;
3. produto produzido puder ser rastreado até componentes consumidos e custos adicionais da OP;
4. venda administrativa, PDV e OS aparecerem em visão comercial consolidada;
5. CMV de cada canal usar custo realizado do ledger;
6. DRE não duplicar receitas provenientes dos recebíveis desses canais;
7. indicadores por produto calcularem margem e lead times com valores reproduzíveis por drill-down;
8. devoluções e estornos preservarem histórico e corrigirem indicadores;
9. testes automatizados cobrirem o fluxo ponta a ponta e os negativos principais;
10. health check detectar divergência entre quantidade rastreável e estoque quando houver quebra de invariantes.

## 15. Fora de escopo desta implementação

- contabilidade societária completa;
- valuation contábil avançado além do necessário para CMV/estoque gerencial;
- custo trabalhista automático sem fonte de custo configurada;
- integrações externas pagas;
- previsão por IA;
- reestruturação integral do ERP em event sourcing;
- alteração de fluxos maduros sem relação direta com rastreabilidade, custo, margem ou consolidação gerencial.

## 16. Sequência arquitetural sugerida

1. migrações e invariantes do ledger;
2. serviço de camadas/alocações;
3. integração com recebimento de compras;
4. integração com venda administrativa;
5. integração com PDV;
6. integração com OS;
7. integração com produção/MRP;
8. devoluções/reversões/transferências;
9. fatos comerciais e relatório consolidado;
10. DRE/BI e indicadores de produto/fornecedor;
11. APIs/UI de rastreabilidade e performance;
12. migração/backfill histórico seguro;
13. testes E2E, health check e documentação.

Essa sequência preserva os fluxos atuais e adiciona a rastreabilidade de forma incremental, mantendo cada etapa verificável antes da próxima.