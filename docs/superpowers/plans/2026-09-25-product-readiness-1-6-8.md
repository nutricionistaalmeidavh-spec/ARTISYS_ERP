# Product Readiness 1–6 + 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** elevar o ArtiSys ERP atual a um nível comercial mais profundo em UX, administração, performance, qualidade e integrações sem incluir fiscal nem os módulos adiados do item 9.

**Architecture:** manter Electron + API local + SQLite. Adicionar serviços focados para tenancy, documentos e integrações; enriquecer reporting/UI sem desmontar os módulos atuais. Multiempresa usa `company_id` no mesmo banco e contexto ativo autenticado.

**Tech Stack:** Node 22, Electron, SQLite, Playwright, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-25-product-readiness-1-6-8-design.md`

## Global Constraints
- local-first; nenhum serviço pago obrigatório.
- `main` é a única base canônica.
- itens 7 e 9 ficam fora desta rodada.
- preservar dados legados por migração para empresa `default`.
- toda feature nova nasce com teste antes do código.

## Review Focus
- isolamento entre empresas e ausência de vazamento cruzado.
- upgrade de banco existente sem perda.
- listas grandes não podem carregar conjuntos ilimitados por padrão.
- arquivos maliciosos/grandes não podem virar anexos aceitos.
- integrações opcionais falhando não podem impedir uso do core.

---

### Task 1: CI, lint e cobertura
**Files:** `.github/workflows/*.yml`, `package.json`, `eslint.config.js`, `scripts/check-coverage.js`, testes de contrato de release.
- [ ] Escrever testes que exijam push na `main`, lint real e script de cobertura.
- [ ] Rodar no PR e observar RED.
- [ ] Implementar ESLint e cobertura com piso inicial.
- [ ] Rodar `npm run verify` e cobertura até GREEN.

### Task 2: Fundação multiempresa
**Files:** migration `100-product-readiness.js`, `js/core/companies/company-service.js`, auth/session, runtime, router administrativo e testes.
- [ ] Testar empresa default, criação de empresa, associação de usuário, troca de empresa e negação de empresa sem acesso.
- [ ] Testar migração preservando banco anterior.
- [ ] Implementar schema/serviço/contexto.
- [ ] Integrar empresa ativa aos endpoints novos e aos relatórios/cadastros principais.

### Task 3: Administração + backup/restore
**Files:** `server/routers/admin-router.js`, `desktop/renderer/views/administracao.js`, `app.js`, `index.html`, testes API/E2E.
- [ ] Testar gestão de usuários/empresa e criação/listagem/restauração segura de backup.
- [ ] Implementar endpoints admin-only.
- [ ] Implementar tela Administração com feedback e confirmações.

### Task 4: Documentos e integrações
**Files:** migration, `js/core/documents/document-service.js`, `js/core/integrations/integration-service.js`, router admin/documentos, UI, testes.
- [ ] Testar upload metadata/local storage, limites e escopo por empresa.
- [ ] Testar CRUD de integrações e conexão bancária configurável sem dependência externa.
- [ ] Implementar serviços e UI.

### Task 5: Paginação, filtros e performance
**Files:** `server/router-utils.js`, routers de cadastros/financeiro/relatórios, views correspondentes, testes.
- [ ] Testar `limit/offset/query/total` e teto de página.
- [ ] Implementar paginação server-side nos principais grids.
- [ ] Atualizar UI com próxima/anterior, busca e filtros sem recarregar datasets irrelevantes.

### Task 6: Dashboard, relatórios e UX
**Files:** reporting service/router, `app.js`, nova view `relatorios.js`, `ui.js`, CSS, testes.
- [ ] Testar dashboard comercial agregado e traduções de estados.
- [ ] Implementar tabelas e cards, remover JSON cru.
- [ ] Traduzir enums/status visíveis e padronizar loading/empty/error.

### Task 7: E2E e upgrade/release
**Files:** `qa/e2e/admin.test.js`, `qa/e2e/reports.test.js`, `qa/e2e/finance-io.test.js`, `test/database-upgrade.test.js`, workflow Windows.
- [ ] Criar E2E reais pela UI para administração, relatórios e import/export financeiro.
- [ ] Criar fixture de banco pré-migração e provar upgrade.
- [ ] Validar artefato do instalador no workflow.
- [ ] Rodar `npm run verify`, `npm run e2e`, `npm run release:check` e build Windows no head final.

### Task 8: Revisão final
- [ ] Comparar branch com `main` e revisar vazamentos de escopo 7/9.
- [ ] Corrigir apenas achados críticos/importantes via RED→GREEN.
- [ ] Só então preparar PR para `main`.