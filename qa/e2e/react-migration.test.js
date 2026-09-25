'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{launchErpElectron}=require('./fixtures/erp-electron');

async function login(erp){await erp.page.getByTestId('login-username').fill('admin');await erp.page.getByTestId('login-password').fill('admin123');await erp.page.getByTestId('login-submit').click();await erp.page.getByTestId('view-dashboard').waitFor({state:'visible'});}

test('React shell navigates every ERP module after login',async()=>{const erp=await launchErpElectron();try{await login(erp);for(const view of ['cadastros','estoque','compras','vendas','financeiro','relatorios','configuracoes','dashboard']){await erp.page.locator(`button[data-view="${view}"]`).click();await assert.doesNotReject(()=>erp.page.locator('main .content').waitFor({state:'visible'}));}}finally{await erp.close();}});

test('reports load sales purchases and inventory without visible error',async()=>{const erp=await launchErpElectron();try{await login(erp);await erp.page.locator('button[data-view="relatorios"]').click();for(const title of ['Vendas','Compras','Estoque'])await erp.page.getByText(title,{exact:true}).last().waitFor({state:'visible'});assert.equal(await erp.page.locator('.report-grid .error').count(),0);assert.equal(await erp.page.locator('.report-grid pre').count(),3);}finally{await erp.close();}});

test('settings exposes local-first runtime and healthy local server',async()=>{const erp=await launchErpElectron();try{await login(erp);await erp.page.locator('button[data-view="configuracoes"]').click();await erp.page.getByText('Local-first',{exact:true}).waitFor({state:'visible'});await erp.page.getByText('Online',{exact:true}).waitFor({state:'visible'});assert.match(await erp.page.locator('main .content').innerText(),/ArtiSys ERP/);}finally{await erp.close();}});

test('logout returns to login and user can authenticate again',async()=>{const erp=await launchErpElectron();try{await login(erp);await erp.page.getByRole('button',{name:'Sair'}).click();await erp.page.getByTestId('login-submit').waitFor({state:'visible'});await login(erp);}finally{await erp.close();}});

test('navigation does not trigger browser dialogs',async()=>{const erp=await launchErpElectron();const dialogs=[];erp.page.on('dialog',d=>{dialogs.push(d.type());d.dismiss().catch(()=>{});});try{await login(erp);for(const view of ['cadastros','estoque','compras','vendas','financeiro','relatorios','configuracoes']){await erp.page.locator(`button[data-view="${view}"]`).click();await erp.page.waitForTimeout(100);}assert.deepEqual(dialogs,[]);}finally{await erp.close();}});


test('financial reports and CSV XLSX print exports are reachable from UI',async()=>{const erp=await launchErpElectron();try{await login(erp);const p=erp.page;await p.locator('button[data-view="relatorios"]').click();await p.getByTestId('report-financial-load').click();await p.getByTestId('report-financial-result').waitFor();for(const id of ['report-financial-csv','report-financial-xlsx','report-financial-print']){await p.getByTestId(id).click();await p.getByTestId('report-export-result').waitFor();assert.ok((await p.getByTestId('report-export-result').innerText()).length>4);}}finally{await erp.close();}});


test('dashboard and report filters are usable from UI',async()=>{const erp=await launchErpElectron();try{await login(erp);const p=erp.page;await p.getByTestId('dashboard-from').fill('2026-09-01');await p.getByTestId('dashboard-to').fill('2026-09-30');await p.getByTestId('dashboard-apply').click();await p.locator('button[data-view="relatorios"]').click();await p.getByTestId('reports-from').fill('2026-09-01');await p.getByTestId('reports-to').fill('2026-09-30');await p.getByTestId('reports-basis').selectOption('cash');await p.getByTestId('reports-apply').click();assert.equal(await p.locator('.report-grid pre').count(),3);}finally{await erp.close();}});
