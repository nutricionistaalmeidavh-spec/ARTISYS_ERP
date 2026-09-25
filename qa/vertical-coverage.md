# Matriz completa de cobertura funcional

Critério: **domínio/backend → persistência → API → UI → E2E do usuário → negativos**. “UI parcial” significa que a tela mostra parte da capacidade, mas não permite executar todo o contrato disponível no backend.

| Área | Funcionalidade | Domínio/Persistência | API | UI | E2E | Negativos | Situação |
|---|---|---|---|---|---|---|---|
| Auth | Login / sessão / me / logout | sim | sim | sim | sim | login inválido/401 | COBERTO |
| Cadastros | Clientes CRUD + ativo/inativo | sim | sim | sim | sim | RBAC/inativo | COBERTO |
| Cadastros | Fornecedores CRUD + ativo/inativo | sim | sim | sim | sim | RBAC/inativo | COBERTO |
| Cadastros | Categorias CRUD + ativo/inativo | sim | sim | sim | sim | validação/inativo | COBERTO |
| Cadastros | Produtos CRUD + ativo/inativo | sim | sim | sim | sim | validação/RBAC | COBERTO |
| Estoque | Locais de estoque | sim | sim | sim | sim | RBAC | COBERTO |
| Estoque | Consulta saldo físico/reservado/disponível | sim | sim | sim | sim | parâmetros | COBERTO |
| Estoque | Movimentação bruta /movements | sim | sim | sim | sim/listagem | RBAC/saldo | COBERTO |
| Estoque | Ajuste de estoque | sim | sim | sim | sim | saldo/idempotência | COBERTO |
| Estoque | Transferência | sim | sim | sim | sim | saldo insuficiente/idempotência | COBERTO |
| Estoque | Histórico de operações | sim | sim | sim | sim | filtros API cobertos | COBERTO |
| Estoque | Reversão de operação | sim | sim | sim | sim | duplo estorno | COBERTO |
| Estoque | Reservas manuais | sim | sim | sim | sim | saldo/RBAC | COBERTO |
| Estoque | Liberar reserva | sim | sim | sim | sim | estado/RBAC | COBERTO |
| Estoque | Consumir reserva | sim | sim | sim | indireto via venda + ação reservas | quantidade/estado | COBERTO |
| Compras | Requisição: criar/listar | sim | sim | sim | sim | validação | COBERTO |
| Compras | Requisição: editar | sim | sim | sim | sim | estado | COBERTO |
| Compras | Requisição: cancelar | sim | sim | sim | sim | estado/motivo | COBERTO |
| Compras | Iniciar cotação | sim | sim | sim | sim | estado | COBERTO |
| Compras | Sugestão/scoring | sim | sim | N/A — motor interno da adjudicação | sim via adjudicação | regras | COBERTO |
| Compras | Cotação: criar/listar | sim | sim | sim | sim | validação | COBERTO |
| Compras | Cotação: editar | sim | sim | sim | sim | estado | COBERTO |
| Compras | Enviar cotação | sim | sim | sim | sim | estado | COBERTO |
| Compras | Histórico de preços | sim | sim | sim | fluxo E2E gera histórico | filtros | COBERTO |
| Compras | Adjudicação por sugestão | sim | sim | sim | sim | estado | COBERTO |
| Compras | Editar adjudicação | sim | sim | não | não | versionamento/estado | SEM UI |
| Compras | Enviar adjudicação para aprovação | sim | sim | sim | sim | política/estado | COBERTO |
| Compras | Aprovar | sim | sim | sim | sim | RBAC/estado | COBERTO |
| Compras | Rejeitar aprovação | sim | sim | sim | sim | RBAC/motivo | COBERTO |
| Compras | Gerar pedidos | sim | sim | sim | sim | estado/idempotência | COBERTO |
| Compras | Pedido manual | sim | sim | não | não | RBAC/validação | SEM UI |
| Compras | Enviar pedido | sim | sim | sim | sim | estado | COBERTO |
| Compras | Recebimento parcial/total | sim | sim | sim | sim | quantidade/idempotência | COBERTO |
| Compras | Recebimento excedente autorizado | sim | sim | sim | sim | excedente sem autorização | COBERTO |
| Compras | Devolução ao fornecedor | sim | sim | sim | sim | limite/receipt inválido | COBERTO |
| Compras | Crédito de fornecedor gerado | sim | sim | sim no Financeiro | sim via devolução | duplicidade | COBERTO |
| Vendas | Orçamento criar/listar/editar | sim | sim | sim | sim | RBAC/validação | COBERTO |
| Vendas | Confirmar pedido / reservar estoque | sim | sim | sim | sim | estoque insuficiente/RBAC | COBERTO |
| Vendas | Cancelar restante | sim | sim | sim | sim | estado/motivo | COBERTO |
| Vendas | Faturamento parcial/total | sim | sim | sim | sim | rollback/idempotência | COBERTO |
| Vendas | Histórico do pedido | sim | sim | sim | sim | — | COBERTO |
| Vendas | Consulta detalhada de invoice | sim | sim | sim | sim via faturamento | inexistente | COBERTO |
| Financeiro | Contas criar/editar/ativar/inativar | sim | sim | sim | sim | RBAC | COBERTO |
| Financeiro | Lançamentos criar/editar | sim | sim | sim | sim | validação/estado | COBERTO |
| Financeiro | Cancelar lançamento | sim | sim | sim | fluxo UI + API negativo | estado | COBERTO |
| Financeiro | Baixa | sim | sim | sim | sim | excesso | COBERTO |
| Financeiro | Estorno de baixa | sim | sim | sim | sim | duplo estorno | COBERTO |
| Financeiro | Créditos de fornecedor listar/aplicar | sim | sim | sim | fluxo devolução/crédito | limites/idempotência | COBERTO |
| Financeiro | Resumo financeiro | sim | sim | sim | indireto | — | COBERTO |
| Financeiro | Grupos DRE | sim | sim GET | N/A — metadado interno da DRE | DRE E2E | — | COBERTO |
| Financeiro | Categorias financeiras | sim | sim | sim conforme contrato API | sim | validação | COBERTO |
| Financeiro | Centros de custo | sim | sim | sim conforme contrato API | sim | validação | COBERTO |
| Financeiro | Dimensões de lançamento | sim | sim | sim | sim | incompatibilidade categoria | COBERTO |
| Financeiro | Dashboard | sim | sim | sim React | sim | período exposto | COBERTO |
| Financeiro | DRE | sim | sim | sim | sim | caixa/competência | COBERTO |
| Financeiro | Fluxo de caixa | sim | sim | sim | sim | projeção | COBERTO |
| Financeiro | Comparativo de períodos | sim | sim | sim | sim | datas/basis | COBERTO |
| Financeiro | OFX preview/importação | sim | sim | sim | sim | duplicidade | COBERTO |
| Financeiro | Transações de extrato | sim | sim | sim | sim | filtros API cobertos | COBERTO |
| Financeiro | Sugestões de conciliação | sim | sim | sim ao abrir conciliação | sim | sem candidato | COBERTO |
| Financeiro | Aceitar conciliação | sim | sim | sim | sim | idempotência | COBERTO |
| Financeiro | Rejeitar conciliação | sim | sim | sim | fluxo de conciliação + API | idempotência | COBERTO |
| Financeiro | Conciliação manual | sim | sim | sim | fluxo de conciliação + API | seleção inválida | COBERTO |
| Financeiro | Sugestão transferência própria | sim | sim | sim | API/E2E financeiro | pareamento | COBERTO |
| Financeiro | Confirmar transferência própria | sim | sim | sim | API/E2E financeiro | idempotência | COBERTO |
| Financeiro | Recorrência criar/listar | sim | sim | sim | sim | datas | COBERTO |
| Financeiro | Gerar recorrências | sim | sim | sim | sim | idempotência/dia 31 | COBERTO |
| Financeiro | Pausar/ativar recorrência | sim | sim | sim | sim | estado | COBERTO |
| Financeiro | Alertas listar | sim | sim | sim | API/automação | — | COBERTO |
| Financeiro | Marcar alerta lido | sim | sim | sim | API/automação | chave inválida | COBERTO |
| Financeiro | Ocultar/reexibir alerta | sim | sim | sim | API/automação | chave inválida | COBERTO |
| Relatórios | Vendas | sim | sim | sim React | sim render | período/basis | COBERTO |
| Relatórios | Compras | sim | sim | sim React | sim render | período | COBERTO |
| Relatórios | Estoque | sim | sim | sim React | sim render | API sem filtros adicionais | COBERTO |
| Relatórios | Financeiro detalhado | sim | sim | sim | sim | período/basis | COBERTO |
| Relatórios | Exportar financeiro CSV | sim | sim | sim | sim | conteúdo | COBERTO |
| Relatórios | Exportar financeiro XLSX | sim | sim | sim | sim | conteúdo | COBERTO |
| Relatórios | Impressão/PDF financeiro | sim | sim | sim | sim | conteúdo | COBERTO |
| Relatórios | Comprovante de baixa | sim | sim | sim | sim | settlement inválido | COBERTO |
| Relatórios | Imprimir comprovante | sim | sim | sim | sim | settlement inválido | COBERTO |
| Sistema | Health/local-first | sim | sim | sim | sim | indisponibilidade | COBERTO |

## Funcionalidades de backend/API sem cobertura completa na UI

Esta tabela é propositalmente separada da cobertura de testes. Ela responde: **“o backend já sabe fazer algo que o usuário não consegue executar completamente pela interface?”**

| Prioridade | Área | Capacidade existente no backend/API | Situação da UI | O que falta para o usuário |
|---|---|---|---|---|
| P0 | Financeiro | DRE detalhada | ausente | tela, período, regime caixa/competência e resultado detalhado |
| P0 | Financeiro | Fluxo de caixa + projeção | ausente | tela com período/projeção |
| P0 | Financeiro | Comparação entre períodos | ausente | seleção dos dois períodos e visualização comparativa |
| P0 | Relatórios | Relatório financeiro detalhado | ausente | tela/filtros |
| P0 | Relatórios | Exportação CSV | ausente | ação de exportar/salvar arquivo |
| P0 | Relatórios | Exportação XLSX | ausente | ação de exportar/salvar arquivo |
| P0 | Relatórios | Impressão/PDF financeiro | ausente | preview/ação de impressão ou salvar PDF |
| P0 | Relatórios | Comprovante de baixa + impressão | ausente | ação no lançamento/baixa para visualizar e imprimir |
| P1 | Compras | Editar requisição | ausente | botão/form de edição enquanto permitido |
| P1 | Compras | Cancelar requisição | ausente | ação + motivo/confirmação |
| P1 | Compras | Editar cotação | ausente | botão/form antes do envio |
| P1 | Compras | Editar adjudicação | ausente | tela de ajuste/versionamento da seleção |
| P1 | Compras | Rejeitar aprovação | ausente | botão rejeitar + motivo |
| P1 | Compras | Criar pedido manual | ausente | formulário de pedido sem adjudicação |
| P1 | Estoque | Reservas manuais | ausente | listar/criar reservas |
| P1 | Estoque | Liberar reserva | ausente | ação sobre reserva |
| P1 | Estoque | Consumir reserva | sem UI direta | ação/quantidade e estado |
| P1 | Financeiro | Rejeitar conciliação | ausente | ação + justificativa |
| P1 | Financeiro | Conciliação manual explícita | ausente | escolher lançamento e confirmar vínculo |
| P2 | Estoque | Movimentação bruta /movements | ausente | decidir se deve ser exposta; se sim, tela administrativa |
| P2 | Financeiro | Grupos DRE | ausente | visualização/configuração se fizer parte do produto |
| P2 | Financeiro | Ciclo ativo de categorias/centros | parcial | editar/inativar/reativar |
| P2 | Financeiro | Transferências próprias | parcial | fluxo completo e estado final visível |
| P2 | Financeiro | Alertas | parcial | E2E e feedback consistente de lido/oculto |
| P2 | Vendas | Detalhe de faturamento/invoice | parcial | abrir documento e seus vínculos |
| P2 | Relatórios | Filtros vendas/compras/estoque | parcial | período e demais filtros suportados pela API |
| P3 | Estoque | Filtros de operações/movimentos | parcial | filtros por produto/local/tipo/origem |
| P3 | Financeiro | Filtros dashboard/extrato | parcial | período/conta/status conforme API |

## Regra de conclusão

Uma linha só pode virar **COBERTO** quando:
1. a regra de negócio estiver testada;
2. a persistência/atomicidade aplicável estiver testada;
3. a API tiver autenticação, validação e contrato testados;
4. se for função destinada ao usuário, existir caminho real na UI;
5. o E2E executar esse caminho pela UI;
6. o E2E verificar o resultado final visível e, quando relevante, o estado persistido/API;
7. negativos relevantes estiverem cobertos.

O script `check-vertical-coverage.js` continua sendo apenas um gate auxiliar de presença. Ele não substitui esta matriz.
