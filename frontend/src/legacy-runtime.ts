// Transitional domain-renderer boundary. These modules are bundled by Vite so the
// application has one frontend entrypoint while the six mature imperative domain
// renderers are migrated to React without losing operational parity.
// @ts-ignore existing renderer module has no TypeScript declarations
import '../../desktop/renderer/ui.js';
// @ts-ignore existing renderer module has no TypeScript declarations
import '../../desktop/renderer/forms.js';
// @ts-ignore existing renderer module has no TypeScript declarations
import '../../desktop/renderer/finance-io.js';
// @ts-ignore existing renderer module has no TypeScript declarations
import '../../desktop/renderer/views/fiscal-context.js';
// @ts-ignore existing renderer module has no TypeScript declarations
import '../../desktop/renderer/views/cadastros.js';
// @ts-ignore existing renderer module has no TypeScript declarations
import '../../desktop/renderer/views/estoque.js';
// @ts-ignore existing renderer module has no TypeScript declarations
import '../../desktop/renderer/views/compras.js';
// @ts-ignore existing renderer module has no TypeScript declarations
import '../../desktop/renderer/views/vendas.js';
// @ts-ignore existing renderer module has no TypeScript declarations
import '../../desktop/renderer/views/financeiro.js';
// @ts-ignore existing renderer module has no TypeScript declarations
import '../../desktop/renderer/views/administracao.js';

export type DomainId='cadastros'|'estoque'|'compras'|'vendas'|'financeiro'|'administracao';
export type DomainRenderer=(input:{api:unknown;root:HTMLElement})=>Promise<void>;

export function getDomainRenderer(domain:DomainId):DomainRenderer|undefined{
  return window.ErpViews?.[domain];
}
