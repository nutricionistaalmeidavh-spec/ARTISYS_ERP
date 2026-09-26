# ArtiSys ERP

> **BRANCH OBSOLETA — NÃO USAR PARA NOVO DESENVOLVIMENTO**
>
> A branch `feat/almoxarifado-inventory-depth` foi preservada apenas como referência histórica. As funcionalidades de almoxarifado e inventário avançado desta linha já estão presentes na `main` atual, junto com evoluções posteriores de fiscal, rastreabilidade e demais módulos.
>
> **Fonte canônica:** `main`.
>
> Não fazer merge, rebase ou cherry-pick desta branch sobre a `main` sem uma nova auditoria funcional, pois o histórico desta branch divergiu e pode reintroduzir versões antigas de arquivos já evoluídos.

ERP desktop local-first da ArtiSys para pequenas e médias empresas. O produto possui runtime, banco SQLite, autenticação, API, desktop e empacotamento próprios e funciona sem serviço pago obrigatório.

## Módulos

Cadastros de clientes, fornecedores e produtos; estoque; compras; vendas administrativas; Financeiro P0–P3 com DRE, fluxo de caixa, OFX, conciliação, transferências, recorrências e alertas; relatórios; backup e diagnóstico.

## Desenvolvimento

Requer Node.js 22 ou superior.

```bash
npm install
npm run verify
npm run qa:full
npm run release:check
npm run dist:win
```

O instalador Windows é gerado como `ArtiSys-ERP-<versão>-x64-Setup.exe`.

Consulte `docs/operations.md` para operação e `docs/provenance.md` para proveniência e licenças.