# Referências obsoletas do repositório

> **Fonte oficial atual:** `main`
>
> Não iniciar desenvolvimento, correções, releases ou merges a partir das referências listadas abaixo. Elas são mantidas apenas para histórico/auditoria. Em caso de dúvida, comparar sempre com `main` e considerar `main` a versão canônica.

## Branches obsoletas

### Base histórica e temporárias

- `docs/erp-standalone-architecture` — documentação/arquitetura histórica anterior à implementação operacional atual.
- `feat/erp-operational-1-6` — fases 1–6 já incorporadas ao fluxo consolidado e posteriormente à `main`.
- `feat/erp-standalone` — antiga branch principal de desenvolvimento; conteúdo consolidado na `main`.
- `feat/erp-standalone-t1-check` — branch temporária de validação, sem função ativa.
- `feat/erp-standalone-tmp` — temporária, sem função ativa.
- `feat/erp-standalone-tmp2` — temporária, sem função ativa.
- `feat/erp-standalone-tmp3` — temporária, sem função ativa.
- `feat/erp-standalone-tmp4` — temporária, sem função ativa.
- `feat/erp-standalone-tmp5` — temporária, sem função ativa.
- `feat/erp-standalone-tmp6` — temporária, sem função ativa.

### Funcionalidades já absorvidas ou substituídas

- `feat/almoxarifado-inventory-depth` — WMS/almoxarifado auditado; lotes, séries, posições, FIFO/FEFO, inventário cíclico, perdas, reposição e analytics já existem na `main` em versões atuais.
- `feat/end-to-end-product-traceability` — rastreabilidade ponta a ponta integralmente absorvida pela `main`.
- `feat/end-to-end-product-traceability-v2` — segunda evolução de rastreabilidade integralmente absorvida pela `main`.
- `feat/erp-p0-p1-retail-logistics` — varejo/logística incorporados à `main`.
- `feat/erp-p0-p2-utilities` — utilidades/operations suite incorporadas à `main`; componentes centrais auditados contra a implementação atual.
- `feat/finance-imports-receipts-exports` — implementação financeira antiga e divergente; **substituída** pela compatibilização feita sobre a `main` e integrada pelo PR #5. Não fazer merge/cherry-pick dessa branch.
- `feat/finance-io-main-compat` — branch de compatibilização dos itens financeiros 1–3; integrada à `main` pelo PR #5.
- `feat/fiscal-acbr-runtime-port` — runtime ACBr incorporado à pilha fiscal atual da `main`.
- `feat/fiscal-core-pdv-integration` — Fiscal Core inicial substituído pela implementação atual da `main`, que amplia escopo multiempresa, documentos e interoperabilidade.
- `feat/fiscal-interoperability-p0-p1` — interoperabilidade fiscal integralmente absorvida pela `main`.
- `feat/fiscal-ready-after-install` — empacotamento/runtime fiscal pronto após instalação integralmente absorvido pela `main`.
- `feat/product-readiness-1-6-8` — trabalho de product readiness integralmente incorporado à `main`.
- `feat/react-vite-foundation` — fundação React/Vite já incorporada e ampliada na `main`.
- `feat/service-orders-manufacturing` — ordens de serviço/manufatura integralmente absorvidas pela `main`.
- `fix/eventbus-license-gate` — correção já integrada à `main` pelo PR #4.

### Integração e testes concluídos

- `integration/almoxarifado-main-2026-09-26` — branch temporária de integração; estava idêntica à `main` no momento da auditoria e não possui função ativa.
- `integration/open-prs-2026-09-26` — branch temporária usada na consolidação dos PRs; conteúdo integrado à `main` pelo PR #24.
- `test/vertical-feature-coverage` — etapa histórica de cobertura vertical/E2E; a `main` contém matriz, CI e fluxos posteriores mais completos.

## Pull requests obsoletos/substituídos

- PR #1 — `feat: importar extratos e gerar documentos financeiros`: implementação original baseada na antiga `feat/erp-standalone`; substituída pelo PR #5, que foi compatibilizado diretamente com a `main`, passou `ERP Verify` e `ERP Windows Build` e foi integrado.

## Regra para trabalho futuro

1. A `main` é a única base canônica.
2. Nova branch deve nascer da `main` atual.
3. Não reutilizar branch marcada como obsoleta como base de implementação.
4. Código de branch obsoleta só deve ser consultado para histórico; qualquer reaproveitamento precisa ser revalidado contra a `main` atual.
5. Toda branch remota fora da `main` listada neste documento deve ser tratada como histórica, mesmo quando ainda contiver commits exclusivos no grafo Git; esses commits podem representar implementação antiga já reabsorvida por outra linha de desenvolvimento.
