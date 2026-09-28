'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{launchErpElectron}=require('./fixtures/erp-electron');

const ALL_VIEWS=['dashboard','cadastros','estoque','compras','vendas','operacao','servicos','producao','financeiro','relatorios','rastreabilidade','inteligencia','gestao-avancada','administracao','configuracoes'];
async function login(erp){await erp.page.getByTestId('login-username').fill('admin');await erp.page.getByTestId('login-password').fill('admin123');await erp.page.getByTestId('login-submit').click();await erp.page.getByTestId('view-dashboard').waitFor({state:'visible'});}
async function openView(p,view){const button=p.locator(`button[data-view="${view}"]`);if(!(await button.isVisible())){const group=['administracao','configuracoes'].includes(view)?'sistema':['producao','rastreabilidade','inteligencia','gestao-avancada'].includes(view)?'controle':null;if(group){const toggle=p.locator(`[data-nav-group="${group}"] .nav-group-toggle`);if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();}}await button.click();}

test('React shell navigates every ERP module after login',async()=>{const erp=await launchErpElectron();try{await login(erp);for(const view of ALL_VIEWS){await openView(erp.page,view);await assert.doesNotReject(()=>erp.page.locator('main .content').waitFor({state:'visible'}));}}finally{await erp.close();}});

test('reports load sales purchases and inventory without visible error',async()=>{const erp=await launchErpElectron();try{await login(erp);await openView(erp.page,'relatorios');for(const title of ['Vendas','Compras','Estoque'])await erp.page.getByText(title,{exact:true}).last().waitFor({state:'visible'});assert.equal(await erp.page.locator('.report-grid .error').count(),0);assert.equal(await erp.page.locator('.report-grid pre').count(),3);}finally{await erp.close();}});

test('settings exposes local-first runtime and healthy local server',async()=>{const erp=await launchErpElectron();try{await login(erp);await openView(erp.page,'configuracoes');await erp.page.getByText('Local-first',{exact:true}).waitFor({state:'visible'});await erp.page.getByText('Online',{exact:true}).waitFor({state:'visible'});assert.match(await erp.page.locator('main .content').innerText(),/ArtiSys ERP/);}finally{await erp.close();}});

test('logout returns to login and user can authenticate again',async()=>{const erp=await launchErpElectron();try{await login(erp);await erp.page.getByRole('button',{name:'Sair'}).click();await erp.page.getByTestId('login-submit').waitFor({state:'visible'});await login(erp);}finally{await erp.close();}});

test('navigation does not trigger browser dialogs',async()=>{const erp=await launchErpElectron();const dialogs=[];erp.page.on('dialog',d=>{dialogs.push(d.type());d.dismiss().catch(()=>{});});try{await login(erp);for(const view of ALL_VIEWS){await openView(erp.page,view);await erp.page.waitForTimeout(100);}assert.deepEqual(dialogs,[]);}finally{await erp.close();}});

test('financial reports and CSV XLSX print exports are reachable from UI',async()=>{const erp=await launchErpElectron();try{await login(erp);const p=erp.page;await openView(p,'relatorios');await p.getByTestId('report-financial-load').click();await p.getByTestId('report-financial-result').waitFor();for(const id of ['report-financial-csv','report-financial-xlsx','report-financial-print']){await p.getByTestId(id).click();await p.getByTestId('report-export-result').waitFor();assert.ok((await p.getByTestId('report-export-result').innerText()).length>4);}}finally{await erp.close();}});

test('dashboard and report filters are usable from UI',async()=>{const erp=await launchErpElectron();try{await login(erp);const p=erp.page;await p.getByTestId('dashboard-from').fill('2026-09-01');await p.getByTestId('dashboard-to').fill('2026-09-30');await p.getByTestId('dashboard-apply').click();await openView(p,'relatorios');await p.getByTestId('reports-from').fill('2026-09-01');await p.getByTestId('reports-to').fill('2026-09-30');await p.getByTestId('reports-basis').selectOption('cash');await p.getByTestId('reports-apply').click();assert.equal(await p.locator('.report-grid pre').count(),3);}finally{await erp.close();}});
