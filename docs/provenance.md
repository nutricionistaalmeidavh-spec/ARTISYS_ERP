# Proveniência do ArtiSys ERP

O `ARTISYS_ERP` é o produto final e independente. O repositório `PDV-ARTISYS` foi usado somente como referência de leitura durante a extração e não é dependência de build ou runtime.

## Fontes e adaptações

- Fundação SQLite, padrões de persistência e conceitos de módulos empresariais: referência funcional da branch `PDV-ARTISYS/feat/erp-p0-p3`, adaptados para `createErpRuntime()` e migrations exclusivas do ERP.
- Financeiro P0–P3, dimensões, DRE/fluxo, OFX, conciliação, recorrências e alertas: preservação funcional e adaptação da mesma branch, removendo a extensão conceitual do PDV.
- Compras e vendas administrativas: implementações próprias do ERP por TDD, usando apenas conceitos empresariais reaproveitáveis; vendas não usam terminal, sessão de caixa ou pagamento de balcão.
- `@artisys/finance-domain`: módulo local vendorizado, licença MIT, upstream `nutricionistaalmeidavh-spec/utilidades`, commit `9bca8b29f3a5875433b42d01ceb84e743dabba82`.

Módulos exclusivos do PDV, restaurante, hardware de frente de loja e emissão fiscal não foram incorporados ao núcleo deste produto.
