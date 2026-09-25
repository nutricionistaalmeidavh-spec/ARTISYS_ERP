# ArtiSys ERP Phase 2 — CRUD Operational Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar cadastros de clientes, fornecedores, categorias e produtos em fluxos operacionais completos na API e no desktop Electron.

**Architecture:** Serviços de domínio continuam responsáveis por validação, RBAC e auditoria; routers apenas traduzem HTTP. A remoção funcional será por inativação/reativação, nunca exclusão física de registros empresariais. O renderer deixa de concentrar tudo em `app.js`: utilidades de UI e a view de cadastros serão separadas em arquivos menores e testáveis.

**Tech Stack:** Node.js 22+, CommonJS, SQLite, HTTP local, Electron, DOM nativo, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-artisys-erp-operational-core-design.md`

## Global Constraints

- Executar depois da Phase 1.
- Não alterar `PDV-ARTISYS`.
- Sem framework frontend novo.
- Toda mutação exige validação no backend, RBAC e auditoria.
- Registros referenciáveis usam `active`; sem DELETE físico pela API.
- Renderer não pode usar `prompt`, `alert`, `confirm`, `require`, `process` ou APIs Node diretas.
- Cada fluxo novo recebe E2E Electron real.

## Review Focus

1. Alterar `kind` de contato ou categoria usada não pode corromper referências existentes — endpoints editam somente campos permitidos.
2. SKU duplicado ou nome obrigatório vazio deve retornar erro estável e não alterar registro existente.
3. Usuário sem `admin/manager` deve poder consultar, mas não criar/editar/inativar.
4. Registro inativo continua acessível por detalhe/histórico e só some da lista padrão.
5. Falha HTTP durante salvamento deve manter modal aberto e dados digitados, mostrando erro sem diálogo nativo/web.

---

### Task 1: Completar edição e estado de contatos

**Files:**
- Modify: `js/domains/contacts/contact-service.js`
- Test: `test/master-data-inventory.test.js`

**Interfaces:**
- Produces: `updateContact(id, input, actor)` and existing `setActive(id, active, actor)`.

- [ ] **Step 1: Write failing service tests**

```js
test('contact can be edited without changing its kind', () => {
  const customer = runtime.contacts.createCustomer({ name: 'Cliente A', email: 'a@x.test' }, manager);
  const updated = runtime.contacts.updateContact(customer.id, { name: 'Cliente B', phone: '16999999999' }, manager);
  assert.equal(updated.name, 'Cliente B');
  assert.equal(updated.phone, '16999999999');
  assert.equal(updated.kind, 'CUSTOMER');
});

test('viewer cannot edit contact', () => {
  assert.throws(() => runtime.contacts.updateContact(customer.id, { name: 'X' }, viewer), /Permissao/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/master-data-inventory.test.js`
Expected: FAIL because `updateContact` is missing.

- [ ] **Step 3: Implement minimal update**

Add a whitelist update that never changes `id`, `kind`, `created_at`:

```js
function updateContact(id, input = {}, actor = null) {
  assertRole(actor, ['admin','manager']);
  const current = getContact(id);
  if (!current) throw new Error('Contato nao encontrado.');
  const name = input.name === undefined ? current.name : String(input.name).trim();
  if (!name) throw new Error('Nome do contato obrigatorio.');
  const taxId = input.taxId === undefined ? current.taxId : (String(input.taxId || '').trim() || null);
  const email = input.email === undefined ? current.email : (String(input.email || '').trim() || null);
  const phone = input.phone === undefined ? current.phone : (String(input.phone || '').trim() || null);
  db.prepare('UPDATE contacts SET name=?,tax_id=?,email=?,phone=?,updated_at=? WHERE id=?')
    .run(name, taxId, email, phone, String(now()), current.id);
  writeAudit(db, { action: 'contacts.update', entity: 'contact', entityId: current.id, actor, context: { before: current, after: { name, taxId, email, phone } } }, now);
  return getContact(current.id);
}
```

Export it from the service.

- [ ] **Step 4: Add inactive behavior test**

Assert `list({ kind:'CUSTOMER' })` excludes inactive record, `list({ includeInactive:true })` includes it, and `getContact(id)` still returns it.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test test/master-data-inventory.test.js`
Expected: PASS.

```bash
git add js/domains/contacts/contact-service.js test/master-data-inventory.test.js
git commit -m "feat: complete contact editing lifecycle"
```

### Task 2: Completar edição de categorias e produtos

**Files:**
- Modify: `js/domains/catalog/catalog-service.js`
- Test: `test/master-data-inventory.test.js`

**Interfaces:**
- Produces: `updateCategory(id,input,actor)`, `setCategoryActive(id,active,actor)`, `updateProduct(id,input,actor)`.

- [ ] **Step 1: Write failing category/product tests**

Cover: rename category, deactivate/reactivate category, edit SKU/name/category/sale price/trackStock, reject negative money and inactive target category.

```js
const updated = runtime.catalog.updateProduct(product.id, {
  name: 'Produto B', sku: 'B-001', salePriceCents: 2590, categoryId: category.id
}, manager);
assert.equal(updated.salePriceCents, 2590);
```

- [ ] **Step 2: Run RED**

Run: `node --test test/master-data-inventory.test.js`
Expected: FAIL on missing methods.

- [ ] **Step 3: Implement whitelisted updates**

Use `assertCents` for `costCents/salePriceCents`, keep `updateCost` as the explicit internal cost path, and do not let normal product editing bypass purchase cost rules unless `costCents` was intentionally supplied by an admin/manager.

```js
function setCategoryActive(id, active, actor) {
  assertRole(actor, ['admin','manager']);
  const result = db.prepare('UPDATE product_categories SET active=?,updated_at=? WHERE id=?')
    .run(active ? 1 : 0, String(now()), String(id));
  if (!result.changes) throw new Error('Categoria de produto nao encontrada.');
  writeAudit(db,{ action:'catalog.category.active',entity:'product-category',entityId:String(id),actor,context:{active:Boolean(active)}},now);
  return getCategory(id);
}
```

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test test/master-data-inventory.test.js`
Expected: PASS.

```bash
git add js/domains/catalog/catalog-service.js test/master-data-inventory.test.js
git commit -m "feat: complete catalog editing lifecycle"
```

### Task 3: Completar contratos REST de cadastros

**Files:**
- Modify: `server/routers/master-data-router.js`
- Modify: `server/router-utils.js`
- Test: `test/api-contract.test.js`

**Interfaces:**
- Produces endpoints:
  - `GET /api/v1/customers/:id`
  - `PATCH /api/v1/customers/:id`
  - `POST /api/v1/customers/:id/deactivate`
  - `POST /api/v1/customers/:id/reactivate`
  - same shape for suppliers, product-categories, products.
- Lists accept `query`, `includeInactive`, `page`, `pageSize` where meaningful.

- [ ] **Step 1: Write failing API contract tests**

Use the existing local-server test harness to authenticate as manager, create a customer, PATCH it, deactivate it, verify it disappears from default list, reactivate it, and verify a viewer receives `403` for PATCH.

- [ ] **Step 2: Run RED**

Run: `node --test test/api-contract.test.js`
Expected: FAIL because item routes are not recognized.

- [ ] **Step 3: Add path matching and consistent 404 behavior**

Use existing `pathMatch()` rather than string splitting:

```js
const customerItem = pathMatch(p, '/api/v1/customers/:id');
if (customerItem) {
  const actor = requireActor(req, sessions);
  if (req.method === 'GET') {
    const record = runtime.contacts.getContact(customerItem.id);
    if (!record || !['CUSTOMER','BOTH'].includes(record.kind)) throw new HttpError(404,'Cliente nao encontrado.');
    json(res,200,record); return true;
  }
  if (req.method === 'PATCH') {
    requireActor(req,sessions,['admin','manager']);
    json(res,200,runtime.contacts.updateContact(customerItem.id,await body(req,bodyLimitBytes),actor)); return true;
  }
}
```

Add equivalent action paths `/:id/deactivate` and `/:id/reactivate`.

- [ ] **Step 4: Add bounded pagination helper**

Add `pagination(url)` returning default `page=1`, `pageSize=50`, max `pageSize=200`. Preserve existing response arrays for current callers in this phase; pagination can be activated with explicit query params and return `{items,page,pageSize,total}` only when `page` or `pageSize` is supplied, to avoid breaking existing UI/tests.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test test/api-contract.test.js test/master-data-inventory.test.js`
Expected: PASS.

```bash
git add server/routers/master-data-router.js server/router-utils.js test/api-contract.test.js
git commit -m "feat: expose complete master data API"
```

### Task 4: Extrair primitivas reutilizáveis da UI desktop

**Files:**
- Create: `desktop/renderer/ui.js`
- Create: `desktop/renderer/forms.js`
- Modify: `desktop/renderer/index.html`
- Modify: `desktop/renderer/styles.css`
- Modify: `desktop/renderer/app.js`
- Test: `test/desktop-identity.test.js`
- Test: `test/desktop-electron-compat.test.js`

**Interfaces:**
- Produces globals `window.ErpUi` and `window.ErpForms` with modal, confirm modal, toast, field rendering, loading/error/empty states.

- [ ] **Step 1: Write source contract tests**

Assert `index.html` loads `ui.js` and `forms.js` before `app.js`, and source contains stable containers `modal-root` and `toast-root`.

- [ ] **Step 2: Run RED**

Run: `node --test test/desktop-identity.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement modal/toast primitives without browser dialogs**

Required interface:

```js
window.ErpUi = {
  openModal({ title, content, actions = [] }),
  closeModal(),
  confirm({ title, message, confirmLabel = 'Confirmar', danger = false }),
  toast(message, { type = 'success' } = {}),
  setBusy(element, busy)
};
```

`confirm()` must return a Promise resolved by custom modal buttons; it must never call `window.confirm`.

`ErpForms.values(form)` must read named controls, trim strings, convert `[data-type="cents"]` to integer cents and `[data-type="number"]` to Number.

- [ ] **Step 4: Run compatibility gate**

Run: `npm run electron:compat && node --test test/desktop-identity.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/renderer test/desktop-identity.test.js
git commit -m "feat: add reusable desktop form primitives"
```

### Task 5: Implementar view operacional de cadastros

**Files:**
- Create: `desktop/renderer/views/cadastros.js`
- Modify: `desktop/renderer/index.html`
- Modify: `desktop/renderer/app.js`
- Modify: `desktop/renderer/styles.css`
- Test: `qa/e2e/master-data.spec.js`

**Interfaces:**
- Produces `window.ErpViews.cadastros({ api, root })`.
- Uses REST contracts from Task 3 and modal/forms from Task 4.

- [ ] **Step 1: Write failing E2E**

Flow must:
1. launch Electron;
2. login;
3. open Cadastros;
4. create customer;
5. edit name/phone;
6. deactivate and verify inactive badge/filter;
7. reactivate;
8. create category;
9. create product assigned to category;
10. edit product price;
11. verify persistence after navigating away/back;
12. assert no `dialog` events.

- [ ] **Step 2: Run RED**

Run: `npx playwright test qa/e2e/master-data.spec.js --reporter=line`
Expected: FAIL because operational controls do not exist.

- [ ] **Step 3: Build cadastros tabs and forms**

Use stable test ids:

```text
cadastros-tab-customers
customer-new
customer-row-<id>
customer-edit-<id>
customer-deactivate-<id>
customer-form-name
customer-form-save
product-new
product-form-sku
product-form-name
product-form-category
product-form-price
product-form-save
```

Failures from API render inline inside the modal and preserve field values.

- [ ] **Step 4: Make `app.js` dispatch to the new view**

Replace only the `cadastros` read-only branch with `ErpViews.cadastros`; keep other views unchanged until their phases.

- [ ] **Step 5: Run GREEN**

Run: `npm run electron:compat && npx playwright test qa/e2e/master-data.spec.js --reporter=line && npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add desktop/renderer qa/e2e/master-data.spec.js
git commit -m "feat: make master data operational in desktop"
```

### Task 6: Phase 2 verification

- [ ] **Step 1:** Run `npm run verify` — Expected PASS.
- [ ] **Step 2:** Run `npm run e2e:smoke` — Expected PASS.
- [ ] **Step 3:** Run `npx playwright test qa/e2e/master-data.spec.js --reporter=line` — Expected PASS.
- [ ] **Step 4:** Run `npm run release:check` — Expected PASS.
- [ ] **Step 5:** Commit only concrete verification fixes; do not create empty commit.
