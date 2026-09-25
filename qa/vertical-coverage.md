# Matriz de cobertura vertical por funcionalidade

Critério: uma funcionalidade só é considerada verticalmente coberta quando existe evidência verificável nas camadas aplicáveis: domínio/backend, persistência, API, frontend, E2E pela interface e caminhos negativos. A quantidade total de testes não substitui esta matriz.

| Funcionalidade | Backend/domínio | Persistência | API | Frontend | E2E usuário | Negativos | Status |
|---|---|---|---|---|---|---|---|
| Cliente: criar/editar/desativar/reativar | test/master-data-inventory.test.js | SQLite + reabertura/listagem | test/master-data-api.test.js | Cadastros | qa/e2e/master-data.test.js | permissão + inativo | COBERTO |
| Fornecedor: CRUD/ciclo ativo | test/master-data-inventory.test.js | SQLite | test/master-data-api.test.js (parcial) | Cadastros | procurement cria fornecedor | permissão/inativo | PARCIAL |
| Categoria de produto: criar/editar/ciclo ativo | test/master-data-inventory.test.js | SQLite | test/master-data-api.test.js | Cadastros | qa/e2e/master-data.test.js (criação) | categoria inativa/preço inválido | PARCIAL |
| Produto: criar/editar/ciclo ativo | test/master-data-inventory.test.js | SQLite | test/master-data-api.test.js | Cadastros | qa/e2e/master-data.test.js | validações/permissão | PARCIAL |
| Local de estoque: criar | inventory domain | SQLite | test/inventory-api.test.js | Estoque | qa/e2e/inventory.test.js | — | PARCIAL |
| Ajuste de estoque | test/inventory-operations.test.js | operação+movimento | test/inventory-api.test.js | Estoque | qa/e2e/inventory.test.js | permissão/idempotência | COBERTO |
| Transferência de estoque | test/inventory-operations.test.js | transação atômica | test/inventory-api.test.js | Estoque | qa/e2e/inventory.test.js | saldo insuficiente/origem=destino/idempotência | COBERTO |
| Estorno de operação de estoque | test/inventory-operations.test.js | movimento compensatório | test/inventory-api.test.js | não evidenciado | não evidenciado | duplo estorno | PARCIAL |
| Reserva/liberação/consumo | test/master-data-inventory.test.js | SQLite | test/inventory-api.test.js | não evidenciado | vendas cobre reserva/consumo indiretamente | saldo insuficiente | PARCIAL |
| Requisição de compra | test/procurement-advanced.test.js | SQLite | test/procurement-api-advanced.test.js | Compras | qa/e2e/procurement.test.js | estados/permissões parciais | PARCIAL |
| Cotação de fornecedor | test/procurement-advanced.test.js | histórico de preço | test/procurement-api-advanced.test.js | Compras | qa/e2e/procurement.test.js | estados parciais | PARCIAL |
| Sugestão/scoring e adjudicação | test/procurement-advanced.test.js | award/versionamento | test/procurement-api-advanced.test.js | Compras | qa/e2e/procurement.test.js | política/versionamento | COBERTO |
| Aprovação de compra | test/procurement-advanced.test.js | snapshot política | test/procurement-api-advanced.test.js | Compras | qa/e2e/procurement.test.js | papéis/estado | COBERTO |
| Pedido de compra | test/procurement.test.js | SQLite | test/procurement-api-advanced.test.js | Compras | qa/e2e/procurement.test.js | permissão/estado | PARCIAL |
| Recebimento parcial/excedente | test/procurement.test.js + procurement-advanced | estoque+financeiro atômicos | test/procurement-api-advanced.test.js | Compras | qa/e2e/procurement.test.js | tolerância/rollback/idempotência | COBERTO |
| Devolução de compra/crédito fornecedor | test/procurement-advanced.test.js | estoque+financeiro | procurement API | Compras | qa/e2e/procurement.test.js | receipt inexistente + limites | COBERTO |
| Orçamento de venda: criar/editar | test/sales-admin.test.js | SQLite | test/sales-admin-api-operational.test.js | Vendas | qa/e2e/sales-admin.test.js (criar) | permissão | PARCIAL |
| Confirmar pedido/reservar estoque | test/sales-admin.test.js | reserva persistida | sales API | Vendas | qa/e2e/sales-admin.test.js | estoque/permissão | COBERTO |
| Faturamento parcial/total | test/sales-admin.test.js | estoque+recebível atômicos | sales API | Vendas | qa/e2e/sales-admin.test.js (parcial) | rollback/idempotência | PARCIAL |
| Cancelar saldo de pedido | test/sales-admin.test.js | libera reserva | sales API | Vendas | qa/e2e/sales-admin.test.js | motivo/estado | COBERTO |
| Conta financeira | test/finance-base.test.js | SQLite | finance API | Financeiro | qa/e2e/finance.test.js (criar) | ciclo ativo não E2E | PARCIAL |
| Lançamento pagar/receber | test/finance-base.test.js | SQLite | finance API | Financeiro | qa/e2e/finance.test.js (pagar) | validações/cancelamento | PARCIAL |
| Baixa e estorno financeiro | test/finance-base.test.js | settlement append-only | finance API | Financeiro | qa/e2e/finance.test.js | excesso + estorno | COBERTO |
| Categoria/centro de custo/dimensões | test/finance-base.test.js | SQLite | vertical-api-gaps.test.js | Financeiro | qa/e2e/finance.test.js | incompatibilidade categoria | COBERTO |
| Recorrências | test/finance-automation.test.js | reinício/idempotência | finance API | Financeiro | qa/e2e/finance.test.js | fechamento dia 31 | COBERTO |
| Importação OFX | test/finance-automation.test.js | fingerprint/idempotência | finance API | Financeiro | qa/e2e/finance.test.js | duplicidade | COBERTO |
| Conciliação bancária | test/finance-automation.test.js | match persistido | finance API | Financeiro | qa/e2e/finance.test.js | confirmação explícita/idempotência | COBERTO |
| Transferência entre contas | test/finance-automation.test.js | transações vinculadas | finance API | não evidenciado | não evidenciado | não gerar receita/despesa | PARCIAL |
| Alertas financeiros | test/finance-automation.test.js | estado apresentação | finance API | não evidenciado | não evidenciado | não mutar financeiro | PARCIAL |
| DRE | test/reporting-management.test.js | tabelas ERP | vertical-api-gaps.test.js | Dashboard/Financeiro | dashboard E2E indireto | caixa/competência | PARCIAL |
| Fluxo de caixa | test/reporting-management.test.js | tabelas ERP | vertical-api-gaps.test.js | Dashboard/Financeiro | dashboard indireto | projeção | PARCIAL |
| Relatório vendas | reporting-management | tabelas ERP | reporting API | Relatórios | react-migration.test.js | filtros/exportação não cobertos | PARCIAL |
| Relatório compras | reporting-management | tabelas ERP | vertical-api-gaps.test.js | Relatórios | react-migration.test.js | filtros/exportação não cobertos | PARCIAL |
| Relatório estoque | reporting-management | tabelas ERP | vertical-api-gaps.test.js | Relatórios | react-migration.test.js | filtros/exportação não cobertos | PARCIAL |
| Exportação CSV/XLSX/impressão/recibo | reporting/finance IO | arquivos | reporting API | exposto conforme rota | não evidenciado por ação real | erros de IO não evidenciados | ABERTO |

## Regra de merge

- **COBERTO**: há evidência nas camadas aplicáveis e pelo menos um fluxo E2E real quando a funcionalidade é exposta na UI, incluindo negativos relevantes.
- **PARCIAL**: há implementação/testes, mas falta pelo menos uma camada ou cenário importante.
- **ABERTO**: falta cobertura vertical de uso real.
- Novas funcionalidades expostas ao usuário não podem ser declaradas concluídas apenas por testes unitários/API.
- O gate automatizado atual de `scripts/check-vertical-coverage.js` é somente um detector auxiliar de presença e não prova cobertura vertical.

## Próximas lacunas prioritárias

1. Completar E2E de ciclo ativo/edição para fornecedor, categoria, produto e conta financeira.
2. Expor/testar pela UI estorno de estoque e reserva/liberação/consumo quando forem ações de usuário.
3. Separar E2E de compras por funcionalidade e adicionar rejeição/estados inválidos.
4. Cobrir edição de orçamento e faturamento total/erros de estoque na UI de vendas.
5. Cobrir transferência entre contas, alertas, DRE e fluxo de caixa por ação real.
6. Cobrir filtros e exportações CSV/XLSX/impressão/recibos a partir da interface.
