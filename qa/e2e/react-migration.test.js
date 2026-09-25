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
