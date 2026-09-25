# Referências obsoletas do repositório

> **Fonte oficial atual:** `main`
>
> Não iniciar desenvolvimento, correções, releases ou merges a partir das referências listadas abaixo. Elas são mantidas apenas para histórico/auditoria. Em caso de dúvida, comparar sempre com `main` e considerar `main` a versão canônica.

## Branches obsoletas

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
- `feat/finance-imports-receipts-exports` — implementação financeira antiga e divergente; **substituída** pela compatibilização feita sobre a `main` e integrada pelo PR #5. Não fazer merge/cherry-pick dessa branch.
- `feat/finance-io-main-compat` — branch de compatibilização dos itens financeiros 1–3; integrada à `main` pelo PR #5.
- `fix/eventbus-license-gate` — correção já integrada à `main` pelo PR #4.

## Pull requests obsoletos/substituídos

- PR #1 — `feat: importar extratos e gerar documentos financeiros`: implementação original baseada na antiga `feat/erp-standalone`; substituída pelo PR #5, que foi compatibilizado diretamente com a `main`, passou `ERP Verify` e `ERP Windows Build` e foi integrado.

## Regra para trabalho futuro

1. A `main` é a única base canônica.
2. Nova branch deve nascer da `main` atual.
3. Não reutilizar branch marcada como obsoleta como base de implementação.
4. Código de branch obsoleta só deve ser consultado para histórico; qualquer reaproveitamento precisa ser revalidado contra a `main` atual.
