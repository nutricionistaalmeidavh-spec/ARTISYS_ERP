# P0/P1 — hardening operacional

## Escopo automatizado

### P0

- E2E Electron da Operação/PDV: abertura/fechamento de caixa, venda, devolução, transferência e importação.
- Navegação E2E pelas 15 áreas atuais do ERP.
- Gate estático `npm run ui:controls` para impedir botão HTML sem `onClick` e sem `form onSubmit` associado.
- Rastreabilidade aceita ID, SKU ou código resolvido pelo catálogo e possui E2E de consulta/erro.

### P1

- Inteligência com UI operacional para pricing, simulação de preço, workflows, transições e aprovações.
- LAN com E2E de pareamento, resgate, atualização, revogação e troca/remoção de servidor LAN.
- Single-flight no cliente para colapsar requisições concorrentes idênticas; E2E cobre duplo clique de venda.
- Testes de domínio cobrem idempotência de venda/devolução, transições repetidas e falhas atômicas de estoque/pagamento.
- `npm run security:audit:prod` bloqueia vulnerabilidade alta em dependências de produção; CI registra também o audit completo para triagem.
- Smoke real de homologação ACBr/SEFAZ disponível por `npm run fiscal:homologation`.

## Triagem de dependências

A auditoria completa atual encontra 4 ocorrências: 2 moderadas e 2 altas. As 2 altas estão em `extract-zip`, transitivo do Electron usado no toolchain de desenvolvimento/build. O audit limitado às dependências de produção não encontra severidade alta; nele permanecem 2 moderadas em `uuid`, transitivo de `exceljs`. O gate de release bloqueia severidade alta no conjunto de produção sem aplicar downgrade/upgrade breaking automaticamente.

## Homologação fiscal real — ACBr local

O core fiscal permanece local/self-hosted. O provider principal é `acbr-local`; provider pago continua apenas opcional.

O smoke real requer credenciais fiscais do contribuinte. Em Windows, use uma das formas para o A1:

- `ERP_FISCAL_A1_BASE64`: conteúdo Base64 do certificado, indicado para secret de CI; ou
- `ERP_FISCAL_A1_PATH`: caminho local do certificado `.pfx`/`.p12`.

Também são necessários:

- `ERP_FISCAL_A1_PASSWORD`: senha do A1 (pode ser vazia se o certificado permitir);
- `ERP_FISCAL_CSC`: CSC de homologação;
- `ERP_FISCAL_CSC_ID`: ID do CSC;
- `ERP_FISCAL_UF`: UF do emissor;
- `ERP_ACBR_BUNDLE_ROOT`: opcional; por padrão usa `fiscal-runtime/acbr`.

Então rode:

```powershell
npm run fiscal:homologation
```

O comando inicia o ACBrMonitor embutido apenas em loopback, materializa o certificado em diretório temporário, configura ambiente `homologation`, consulta `NFe.StatusServico()` e exige serviço operacional. O material temporário é removido no final.

No workflow Windows, a etapa externa é executada automaticamente somente quando `ERP_FISCAL_A1_BASE64`, `ERP_FISCAL_CSC`, `ERP_FISCAL_CSC_ID` e `ERP_FISCAL_UF` estiverem configurados como secrets. Na ausência deles, a etapa é explicitamente ignorada e nenhuma dependência externa é imposta ao core.

## Gates de release

`npm run verify` inclui roadmap, typecheck, build, boundaries, compatibilidade Electron, contrato de controles de UI, lint, testes e cobertura vertical.

`npm run release:check` exige roadmap completo e acrescenta cobertura global, auditoria de dependências de produção, licenças, capacidades e QA de release.
