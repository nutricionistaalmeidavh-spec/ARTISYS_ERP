# Rastreabilidade econômica ponta a ponta

Implementação integrada à base atual do ERP para preservar origem econômica, custo realizado e fatos comerciais em compras, estoque, vendas administrativas, PDV, ordens de serviço, produção, devoluções e transferências.

## Princípios
- Camadas de custo por produto/origem/local.
- Alocações imutáveis e reversíveis.
- Fatos comerciais como fonte única de receita/CMV/margem.
- Backfill legado conservador, sem inventar fornecedor.
- Health check de divergência entre estoque físico e ledger econômico.
- API e UI de consulta de rastreabilidade e performance.

## Compatibilidade
A migração `160-traceability-ledger` possui ID próprio e é executada após `160-fiscal-runtime` pelo índice explícito de migrações.
