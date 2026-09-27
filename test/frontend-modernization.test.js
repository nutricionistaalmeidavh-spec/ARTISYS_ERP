'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('React entrypoint no longer loads legacy renderer scripts directly',()=>{
  const html=read('frontend/index.html');
  for(const legacy of ['ui.js','forms.js','finance-io.js','views/cadastros.js','views/estoque.js','views/compras.js','views/vendas.js','views/financeiro.js','views/administracao.js','views/fiscal-context.js']){
    assert.equal(html.includes(legacy),false,`frontend/index.html still loads ${legacy}`);
  }
  assert.match(html,/type="module"\s+src="\/src\/main\.tsx"/);
});

test('React domain pages do not depend on window.ErpViews compatibility globals',()=>{
  const domain=read('frontend/src/pages/DomainPage.tsx');
  assert.equal(domain.includes('window.ErpViews'),false,'DomainPage still depends on window.ErpViews');
});

test('navigation is grouped into progressive ERP areas',()=>{
  const navigation=read('frontend/src/app/navigation.ts');
  const shell=read('frontend/src/app/Shell.tsx');
  assert.match(navigation,/NAV_GROUPS/);
  for(const group of ['inicio','operacao','gestao','controle','sistema'])assert.match(navigation,new RegExp(`id:['\"]${group}['\"]`));
  assert.match(shell,/data-nav-group/);
  assert.match(shell,/nav-group-toggle/);
});
