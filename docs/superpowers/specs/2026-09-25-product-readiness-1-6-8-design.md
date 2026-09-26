# ArtiSys ERP — Product Readiness 1–6 + 8

## Objetivo
Transformar o núcleo atual em um produto comercial utilizável por PME sem ampliar agora para fiscal, CRM, PDV, e-commerce ou projetos/obras.

## Escopo aprovado
1. Dashboard e relatórios comerciais de verdade.
2. Polimento de UX e tradução de estados internos.
3. Administração de usuários, empresa e backup/restore pela interface.
4. Paginação, filtros e performance em listas grandes.
5. E2E real de interface, upgrade de banco e validação do instalador.
6. CI na `main`, lint real e cobertura.
8. Integração bancária, anexos/documentos, multiempresa e integrações externas.

## Fora de escopo nesta rodada
- Fiscal/NF-e/NFC-e/NFS-e e demais itens do antigo item 7.
- CRM, PDV, e-commerce, projetos/obras e demais itens do antigo item 9.

## Decisões de arquitetura
- Continuar local-first, SQLite e sem serviço pago obrigatório.
- Multiempresa no mesmo SQLite, com `company_id` e empresa ativa na sessão. O bootstrap cria uma empresa `default` para preservar dados legados.
- Usuários recebem acesso explícito a empresas. Admin pode criar empresas e atribuir acesso.
- Novos registros de domínio devem carregar a empresa ativa; listagens e relatórios devem ser filtrados por ela. Dados legados migram para `default`.
- Anexos ficam em armazenamento local controlado pelo ERP; metadados no SQLite, arquivos em diretório próprio. Tamanho e extensão são validados.
- Integrações externas são registros/configurações + adaptadores opcionais. O core não depende de APIs pagas.
- Integração bancária suporta conexão configurável e importação existente (OFX/CSV/PDF/manual); adaptadores remotos ficam opcionais.
- Paginação usa `limit`, `offset`, `query`, `total`, com limites máximos no servidor.
- A UI não exibe enums internos em inglês quando houver equivalente em português.
- Relatórios não exibem JSON cru: devem ter tabelas, totais, filtros e exportações.

## UX
- Dashboard: cartões financeiros + vendas/compras/estoque + alertas e pendências.
- Relatórios: filtros por período, tabelas legíveis e exportação.
- Administração: abas Empresa, Usuários, Backups, Documentos e Integrações.
- Estados de carregamento, vazio, erro e confirmação devem ser visíveis e consistentes.

## Qualidade
- E2E Electron deve cobrir administração, relatórios e importação/exportação financeira além dos fluxos existentes.
- Deve existir teste de migração de banco antigo para o schema novo preservando dados.
- CI deve rodar em PR e push na `main`.
- ESLint será gate obrigatório; cobertura será gerada no CI e não poderá regredir abaixo de um piso inicial conservador definido no script.
- Build Windows continua gate de release.

## Critério de aceite
A branch só pode ser considerada pronta para merge quando `npm run verify`, E2E Electron, cobertura, `release:check` e build Windows estiverem verdes no head final.