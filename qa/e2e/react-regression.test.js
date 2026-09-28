'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{launchErpElectron}=require('./fixtures/erp-electron');
async function login(p){await p.getByTestId('login-username').fill('admin');await p.getByTestId('login-password').fill('admin123');await p.getByTestId('login-submit').click();await p.getByTestId('view-dashboard').waitFor({state:'visible'});}
async function withErp(fn){const erp=await launchErpElectron();try{await fn(erp.page,erp);}finally{await erp.close();}}
async function openView(p,view){const button=p.locator(`button[data-view="${view}"]`);if(!(await button.isVisible())){const group=['administracao','configuracoes'].includes(view)?'sistema':['producao','rastreabilidade','inteligencia','gestao-avancada'].includes(view)?'controle':null;if(group){const toggle=p.locator(`[data-nav-group="${group}"] .nav-group-toggle`);if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();}}await button.click();return button;}

test('login rejects invalid credentials and keeps login visible',()=>withErp(async p=>{await p.getByTestId('login-username').fill('admin');await p.getByTestId('login-password').fill('senha-invalida');await p.getByTestId('login-submit').click();await p.getByRole('alert').waitFor();assert.ok((await p.getByRole('alert').innerText()).trim().length>0);await p.getByTestId('login-submit').waitFor({state:'visible'});}));
test('dashboard exposes four financial metrics',()=>withErp(async p=>{await login(p);for(const x of ['A receber','A pagar','Caixa realizado','Resultado'])await p.getByText(x,{exact:true}).waitFor();}));
test('sidebar marks dashboard active after login',()=>withErp(async p=>{await login(p);assert.match(await p.locator('button[data-view="dashboard"]').getAttribute('class')||'',/active/);}));
test('cadastros route mounts master-data root',()=>withErp(async p=>{await login(p);await openView(p,'cadastros');await p.getByTestId('cadastros-root').waitFor();}));
test('estoque route mounts inventory root',()=>withErp(async p=>{await login(p);await openView(p,'estoque');await p.getByTestId('inventory-root').waitFor();}));
test('compras route mounts procurement root',()=>withErp(async p=>{await login(p);await openView(p,'compras');await p.getByTestId('procurement-root').waitFor();}));
test('vendas route mounts sales root',()=>withErp(async p=>{await login(p);await openView(p,'vendas');await p.getByTestId('sales-root').waitFor();}));
test('financeiro route mounts finance root',()=>withErp(async p=>{await login(p);await openView(p,'financeiro');await p.getByTestId('finance-root').waitFor();}));
test('reports remain available after navigating away and back',()=>withErp(async p=>{await login(p);await openView(p,'relatorios');await p.locator('.report-grid').waitFor();await openView(p,'dashboard');await openView(p,'relatorios');await p.locator('.report-grid').waitFor();assert.equal(await p.locator('.report-grid pre').count(),3);}));
test('settings remains available after navigating away and back',()=>withErp(async p=>{await login(p);await openView(p,'configuracoes');await p.getByText('Local-first',{exact:true}).waitFor();await openView(p,'dashboard');await openView(p,'configuracoes');await p.getByText('Local-first',{exact:true}).waitFor();}));
test('sidebar active state follows selected module',()=>withErp(async p=>{await login(p);for(const v of ['cadastros','estoque','compras','vendas','financeiro','relatorios','configuracoes']){const b=await openView(p,v);assert.match(await b.getAttribute('class')||'',/active/);}}));
test('topbar title follows selected module',()=>withErp(async p=>{await login(p);for(const [v,title] of [['cadastros','Cadastros'],['estoque','Estoque'],['compras','Compras'],['vendas','Vendas'],['financeiro','Financeiro'],['relatorios','Relatórios'],['configuracoes','Configurações']]){await openView(p,v);await p.locator('.topbar h2').getByText(title,{exact:true}).waitFor();}}));
test('logged user identity is displayed in shell',()=>withErp(async p=>{await login(p);assert.match(await p.locator('.topbar').innerText(),/admin/i);}));
test('logout clears authenticated shell',()=>withErp(async p=>{await login(p);await p.getByRole('button',{name:'Sair'}).click();await p.getByTestId('login-submit').waitFor();assert.equal(await p.locator('.app-shell').count(),0);}));
test('relogin restores dashboard after logout',()=>withErp(async p=>{await login(p);await p.getByRole('button',{name:'Sair'}).click();await p.getByTestId('login-submit').waitFor();await login(p);await p.getByTestId('view-dashboard').waitFor();}));
