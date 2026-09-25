# ARTISYS ERP — núcleo operacional 1–6

Data: 2026-09-25
Branch alvo: `feat/erp-standalone`

## Objetivo

Evoluir o `ARTISYS_ERP` do estado atual — backend funcional com interface majoritariamente de consulta — para um ERP desktop operacional nos seis blocos aprovados:

1. base técnica;
2. CRUD operacional;
3. estoque;
4. compras avançadas;
5. vendas administrativas;
6. financeiro.

O resultado deve continuar sendo um produto standalone, local-first, sem dependência paga obrigatória, sem acoplamento ao `PDV-ARTISYS` e compatível com Electron/Windows.

O repositório `nutricionistaalmeidavh-spec/PDV-ARTISYS` permanece somente leitura e não deve receber alterações.

## Restrições e critérios de sucesso

- Core obrigatório com custo de infraestrutura R$ 0.
- SQLite continua sendo a fonte de verdade local.
- Nenhum SaaS, broker, Redis, Kafka, RabbitMQ ou serviço pago pode ser requisito de runtime.
- `prompt()`/`window.prompt()` são proibidos no renderer. `alert()` e `confirm()` também não serão usados como UX de produto.
- Entrada de dados deve ocorrer por formulários/modais próprios.
- Diálogos nativos necessários devem passar pelo processo principal/preload com IPC controlado.
- Ações críticas devem manter atomicidade transacional no SQLite.
- Todo botão operacional novo deve ter ação funcional ou estado desabilitado explícito.
- Cada fluxo implementado deve ganhar teste de domínio/API e E2E real com Electron + Playwright desde a sua entrega; a suíte E2E completa de release continua sendo uma etapa posterior.
- Nenhuma mudança pode reintroduzir conceitos de checkout, terminal, caixa de operador, NFC-e ou hardware de PDV no núcleo.

## Abordagens consideradas

### A. Expandir os serviços atuais de forma monolítica

Menor mudança inicial, porém aumenta o acoplamento entre compras, estoque e financeiro e tende a tornar `procurement-service.js`, `sales-admin-service.js` e o renderer difíceis de manter.

### B. Evolução modular por subdomínios integrados — escolhida

Preserva os domínios existentes, separa responsabilidades novas e usa contratos explícitos entre módulos. Reutiliza o EventBus compartilhado da ArtiSys para efeitos secundários sem transformar eventos em fonte de verdade.

### C. Criar primeiro um motor genérico de workflow

Teria maior flexibilidade, mas adicionaria complexidade que ainda não é necessária. Aprovações serão configuráveis, porém implementadas como domínio de compras neste ciclo.

## 1. Base técnica

### 1.1 EventBus compartilhado

Reutilizar o módulo já existente em `nutricionistaalmeidavh-spec/utilidades/modules/artisys-eventbus`, versão 0.2.0, incluindo:

- `DomainEventBus`;
- `DomainEventDispatcher`;
- `SqliteOutboxStore`;
- `SqliteEffectStore`;
- `IdempotentEffectRunner`;
- schema SQLite exportado pelo módulo.

O ERP consumirá uma cópia vendorizada/pinada do módulo no próprio repositório, com arquivo de proveniência apontando para o commit de origem em `utilidades`. Isso mantém o build standalone e não cria dependência de rede em runtime.

O EventBus não substitui transações de negócio. O padrão será:

```text
comando de negócio
  -> BEGIN SQLite
     -> mutações críticas
     -> registro de evento na outbox
  -> COMMIT
  -> dispatcher
     -> efeitos secundários/idempotentes
```

Exemplos de efeitos críticos que permanecem síncronos/transacionais: entrada de estoque + atualização de custo + criação/ajuste de conta a pagar no recebimento de compra.

Exemplos de efeitos adequados ao EventBus: auditoria derivada, atualização de projeções, refresh de UI, alertas, histórico auxiliar e reprocessamentos idempotentes.

### 1.2 Eventos iniciais

Eventos mínimos:

- `procurement.request.created`;
- `procurement.quotation.received`;
- `procurement.approval.requested`;
- `procurement.approval.approved`;
- `procurement.approval.rejected`;
- `procurement.order.created`;
- `procurement.receipt.partial`;
- `procurement.receipt.completed`;
- `procurement.receipt.excess_authorized`;
- `procurement.return.completed`;
- `inventory.stock.changed`;
- `sales.quote.created`;
- `sales.order.confirmed`;
- `sales.invoice.created`;
- `finance.payable.created`;
- `finance.receivable.created`;
- `finance.supplier_credit.created`.

Cada envelope deve possuir identificador único, tipo, agregado, `aggregateId`, origem, ator, timestamp e payload mínimo necessário.

### 1.3 Compatibilidade Electron

Criar gate estático para o renderer bloqueando:

- `prompt`/`window.prompt`;
- `alert`/`window.alert`;
- `confirm`/`window.confirm`;
- acesso direto a APIs Node no renderer fora do preload permitido.

Nos E2E, qualquer diálogo web inesperado deve falhar o teste.

## 2. CRUD operacional

### 2.1 Cadastros

Completar clientes, fornecedores, categorias e produtos com:

- listagem;
- busca e filtros;
- criação;
- visualização;
- edição;
- inativação;
- reativação.

Não haverá exclusão física de cadastros empresariais já expostos ao usuário. A remoção funcional será por inativação para preservar referências históricas.

### 2.2 API

Padronizar endpoints REST do namespace `/api/v1`:

- `GET /resource` — lista com filtros;
- `POST /resource` — cria;
- `GET /resource/:id` — detalhe;
- `PATCH /resource/:id` — edição parcial;
- `POST /resource/:id/deactivate`;
- `POST /resource/:id/reactivate`.

Coleções operacionais devem aceitar paginação e busca sem quebrar os contratos existentes. Erros terão código estável, mensagem segura e status HTTP adequado.

### 2.3 Segurança e auditoria

Toda mutação deve:

- passar por autenticação/RBAC;
- validar dados no backend;
- registrar ator e timestamp;
- auditar mudanças sensíveis;
- rejeitar operação inválida mesmo que a UI tente enviá-la.

### 2.4 UI desktop

O renderer será dividido em páginas/componentes menores, mantendo HTML/CSS/JS e evitando introduzir framework novo neste ciclo.

Primitivas compartilhadas:

- tabela com estado vazio/loading/erro;
- formulário;
- modal próprio;
- confirmação própria;
- toast/feedback de sucesso e erro;
- busca/filtro;
- detalhe/edição;
- `data-testid` nos controles necessários aos E2E.

## 3. Estoque

### 3.1 Operações

Adicionar interface e API para:

- consulta de saldo por local;
- histórico de movimentações;
- ajuste de entrada;
- ajuste de saída;
- transferência entre locais;
- reservas de venda;
- liberação de reserva;
- consumo por faturamento administrativo;
- entrada por recebimento de compra;
- saída por devolução ao fornecedor.

### 3.2 Integridade

Movimentações são append-only do ponto de vista contábil/operacional. Correções devem gerar nova movimentação inversa/compensatória quando aplicável, nunca apagar silenciosamente histórico.

Transferência deve ser atômica: saída da origem e entrada no destino na mesma transação.

Não permitir saldo negativo quando a política do movimento exigir disponibilidade. Reservas não podem consumir saldo já reservado por outro pedido.

## 4. Compras avançadas

O domínio de compras será separado em responsabilidades menores dentro de `js/domains/procurement/`:

```text
procurement/
  requisitions
  quotations
  approvals
  purchase-orders
  receipts
  returns
  supplier-scoring
  pricing-history
```

A estrutura física pode usar arquivos/pastas equivalentes, desde que as responsabilidades permaneçam separadas.

### 4.1 Solicitação de compra

Permitir:

- criar rascunho;
- incluir múltiplos itens;
- justificar necessidade;
- editar enquanto permitido;
- enviar para cotação;
- cancelar com motivo e auditoria.

### 4.2 Cotações

Uma solicitação pode receber propostas de vários fornecedores.

Cada proposta deve registrar, por item quando aplicável:

- preço;
- quantidade disponível;
- prazo de entrega;
- frete;
- condição/prazo de pagamento;
- validade;
- observações.

O sistema deve comparar propostas e manter histórico de preços por produto e fornecedor.

### 4.3 Sugestão automática de fornecedores

O ERP deve sugerir uma combinação de fornecedores considerando pesos configuráveis na empresa local:

- preço;
- frete;
- prazo de entrega;
- prazo de pagamento;
- disponibilidade;
- confiabilidade/histórico quando houver dados suficientes.

A sugestão deve mostrar justificativa e score. Ela nunca seleciona definitivamente nem gera pedido sem confirmação humana.

Uma mesma solicitação pode ser dividida entre vários fornecedores, inclusive por item. A confirmação gera pedidos de compra separados por fornecedor preservando vínculos com solicitação e cotações.

### 4.4 Aprovação configurável multinível

A empresa local poderá configurar:

- faixas de valor;
- quantidade de níveis;
- papéis autorizados em cada nível;
- aprovação sequencial;
- quem pode rejeitar;
- motivo obrigatório de rejeição.

Exemplo possível:

- até R$ 2.000: gerente;
- de R$ 2.000 a R$ 10.000: gerente + administrador;
- acima de R$ 10.000: gerente + administrador + diretor.

Uma instalação pequena pode configurar somente um nível.

Alteração relevante depois de uma aprovação invalida as aprovações anteriores e reinicia o fluxo. Alterações relevantes incluem:

- valor total;
- fornecedor selecionado;
- itens;
- quantidades;
- preço unitário;
- frete/despesas;
- condição de pagamento.

O histórico de aprovações anteriores permanece disponível para auditoria.

### 4.5 Pedido e recebimento

O pedido aprovado pode ter recebimentos parciais ou completos.

Para cada item a UI deve exibir sempre:

- quantidade pedida;
- quantidade recebida nesta entrega;
- acumulado recebido;
- saldo faltante;
- quantidade excedente;
- percentual da diferença;
- status `Parcial`, `Completo` ou `Excedente`.

A empresa local terá tolerância configurável para excedente. Dentro da tolerância, a política pode permitir recebimento automático. Acima dela, autorização explícita será obrigatória.

Excedente autorizado:

- entra no estoque;
- usa o custo unitário acordado;
- reajusta o valor efetivo da compra;
- reajusta/cria o contas a pagar correspondente;
- registra quem autorizou e qual diferença foi aceita.

Recebimento continua transacional e idempotente.

### 4.6 Devolução ao fornecedor

A devolução deve:

- vincular-se ao recebimento original;
- exigir motivo;
- reduzir o estoque;
- reduzir o contas a pagar se ainda estiver em aberto;
- se a obrigação já estiver liquidada, gerar crédito com o fornecedor;
- registrar usuário, data e auditoria;
- aparecer no histórico da compra e do fornecedor.

## 5. Vendas administrativas

Preservar o domínio já existente e completar a operação pela interface/API:

- criar orçamento;
- editar orçamento enquanto permitido;
- converter/confirmar como pedido;
- reservar estoque;
- liberar reserva em cancelamento;
- atender parcialmente ou totalmente;
- faturar administrativamente;
- baixar estoque pelo atendimento/faturamento conforme a regra atual;
- gerar conta a receber;
- cancelar/reverter quando permitido, com compensações e auditoria;
- consultar histórico completo.

`Faturamento administrativo` continua sendo gerencial e não emite documento fiscal.

O fluxo não pode exigir terminal, sessão de caixa, operador de PDV, gaveta, checkout ou forma de pagamento de balcão.

## 6. Financeiro operacional

Manter as regras P0–P3 existentes e expor os fluxos necessários na API e interface desktop:

- contas financeiras;
- contas a pagar;
- contas a receber;
- baixa parcial/total;
- estorno;
- cancelamento com regra de integridade;
- transferências entre contas próprias;
- categorias e dimensões/centro de custo;
- recorrências;
- importação OFX com preview antes do commit;
- conciliação explícita;
- alertas financeiros;
- projeções já existentes.

A UI deve permitir executar essas operações sem `prompt/alert/confirm` e sem editar diretamente estado derivado.

Operações de baixa, estorno, transferência, recorrência e conciliação devem manter as garantias atuais de idempotência e não duplicação.

Créditos de fornecedor provenientes de devolução serão registrados como entidade/lançamento financeiro identificável e poderão ser aplicados em obrigação futura de forma explícita e auditável.

## 7. Fluxos de dados principais

### Compra

```text
Solicitação
 -> Cotações
 -> Comparação/sugestão
 -> Seleção humana
 -> Aprovação multinível
 -> Pedido(s)
 -> Recebimento
 -> Estoque/custo
 -> Conta a pagar
 -> eventual devolução
 -> ajuste de AP ou crédito fornecedor
```

### Venda administrativa

```text
Orçamento
 -> Pedido confirmado
 -> Reserva de estoque
 -> Atendimento/faturamento administrativo
 -> Baixa/consumo de estoque
 -> Conta a receber
 -> liquidação no financeiro
```

## 8. Estado e migrations

Novas tabelas/migrations devem cobrir, no mínimo:

- outbox/effects do EventBus;
- solicitações de compra e itens;
- cotações de fornecedor e itens;
- políticas/níveis/instâncias/ações de aprovação;
- vínculos de seleção por item/fornecedor;
- devoluções de compra e itens;
- histórico de preço;
- crédito de fornecedor quando necessário;
- novos campos/status de recebimento/tolerância;
- flags de ativo/inativo em cadastros que ainda não possuam esse estado.

Migrations devem ser incrementais e compatíveis com banco já existente.

## 9. Estratégia de testes durante os itens 1–6

### Testes de domínio/API

Cada nova regra entra primeiro com teste reproduzindo o comportamento esperado:

- CRUD/inativação;
- RBAC e validações;
- transferências de estoque;
- aprovação multinível;
- reset de aprovação após alteração;
- divisão entre fornecedores;
- scoring configurável;
- recebimento parcial/excedente;
- tolerância/autorização;
- devolução e crédito de fornecedor;
- venda administrativa;
- AP/AR e operações financeiras;
- idempotência e rollback transacional.

### E2E Electron + Playwright

Criar suíte real em `qa/e2e/` usando Playwright `_electron.launch()` e banco SQLite temporário por teste/suite.

Fluxos mínimos entregues junto aos itens 1–6:

1. abrir Electron e autenticar;
2. criar/editar/inativar/reativar cadastro;
3. ajustar e transferir estoque;
4. criar solicitação, cadastrar cotações, selecionar fornecedores, aprovar em múltiplos níveis e receber parcialmente;
5. receber excedente e validar autorização/diferença visível;
6. devolver compra e validar estoque + financeiro;
7. criar orçamento, confirmar pedido, faturar e validar recebível;
8. liquidar/estornar AP/AR;
9. importar OFX e conciliar;
10. reiniciar o aplicativo e confirmar persistência.

Todo E2E deve falhar caso ocorra diálogo web inesperado (`prompt`, `alert`, `confirm`) ou erro não tratado no renderer.

## 10. Sequência de implementação

A implementação deve ocorrer em incrementos verificáveis:

1. EventBus + outbox + gate Electron + estrutura E2E;
2. CRUD backend + UI operacional de cadastros;
3. estoque operacional;
4. compras avançadas;
5. vendas administrativas operacionais;
6. financeiro operacional;
7. rodada integrada dos E2E cobrindo todos os fluxos 1–6.

Cada incremento só avança após testes locais/CI correspondentes passarem.

## Fora deste ciclo

Não fazem parte dos itens 1–6 agora:

- redesenho completo dos relatórios/PDF/CSV;
- suíte final de release comercial e instalação limpa;
- emissão fiscal;
- PDV/checkout;
- restaurante/KDS/delivery;
- serviços pagos obrigatórios;
- motor genérico de workflow para outros domínios.

Os itens fora deste ciclo não devem impedir que a arquitetura criada aqui seja reutilizada posteriormente.
