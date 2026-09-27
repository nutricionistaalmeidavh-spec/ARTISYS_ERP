'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {launchErpElectron}=require('./fixtures/erp-electron');

test('user operates the six ERP depth workspaces from the Electron UI',async()=>{
 const erp=await launchErpElectron();
 try{
  await erp.page.getByTestId('login-username').fill('admin');
  await erp.page.getByTestId('login-password').fill('admin123');
  await erp.page.getByTestId('login-submit').click();
  await erp.page.getByTestId('nav-gestao-avancada').click();
  await erp.page.getByTestId('view-depth').waitFor({state:'visible'});
  for(const title of ['Accounting Core','Projects 2.0','CRM','Manufacturing Shop Floor','Stock Logistics','Asset Accounting'])await erp.page.getByText(title,{exact:true}).waitFor({state:'visible'});

  await erp.page.evaluate(async()=>{
   const base=await window.erpDesktop.getBaseUrl();const token=sessionStorage.getItem('erp-token');
   const req=async(path,method='POST',body)=>{const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);return r.json();};
   await req('/api/v1/accounting/accounts','POST',{id:'UI-CASH',code:'1.10',name:'Caixa UI',type:'ASSET',normalBalance:'DEBIT'});
   await req('/api/v1/accounting/accounts','POST',{id:'UI-REV',code:'4.10',name:'Receita UI',type:'REVENUE',normalBalance:'CREDIT'});
   await req('/api/v1/accounting/journals','POST',{id:'UI-J1',date:'2026-09-27',description:'Venda UI',lines:[{accountId:'UI-CASH',debitCents:2500},{accountId:'UI-REV',creditCents:2500}]});
   await req('/api/v1/ops/projects','POST',{id:'UI-PROJ',code:'UI-PROJ',name:'Projeto UI'});
   await req('/api/v1/projects/UI-PROJ/budget','POST',{budgetCents:10000});
   await req('/api/v1/projects/UI-PROJ/time','POST',{hours:1,hourlyCostCents:1000,billableRateCents:2000,workedAt:'2026-09-27'});
   await req('/api/v1/projects/UI-PROJ/revenue','POST',{description:'Entrega UI',amountCents:5000,occurredAt:'2026-09-27'});
   await req('/api/v1/inventory/locations','POST',{id:'UI-BIN',name:'Posição UI',type:'POSITION'});
   await req('/api/v1/products','POST',{id:'UI-PROD',sku:'UI-PROD',name:'Produto UI',costCents:1000,salePriceCents:1500,trackStock:true});
   await req('/api/v1/stock-logistics/putaway-rules','POST',{id:'UI-PUT',productId:'UI-PROD',targetLocationId:'UI-BIN',priority:1});
   for(const a of [{id:'UI-FA',code:'1.20',name:'Imobilizado UI',type:'ASSET',normalBalance:'DEBIT'},{id:'UI-AD',code:'1.21',name:'Dep Acum UI',type:'ASSET',normalBalance:'CREDIT'},{id:'UI-DE',code:'5.10',name:'Desp Dep UI',type:'EXPENSE',normalBalance:'DEBIT'}])await req('/api/v1/accounting/accounts','POST',a);
   await req('/api/v1/ops/assets','POST',{id:'UI-ASSET',code:'UI-ASSET',name:'Ativo UI'});
   await req('/api/v1/asset-accounting/capitalize','POST',{assetId:'UI-ASSET',acquisitionDate:'2026-09-01',acquisitionCostCents:120000,residualValueCents:0,usefulLifeMonths:12,assetAccountId:'UI-FA',accumulatedDepreciationAccountId:'UI-AD',depreciationExpenseAccountId:'UI-DE',counterpartAccountId:'UI-CASH'});
  });

  await erp.page.getByTestId('depth-accounting-refresh').click();
  await erp.page.getByTestId('depth-accounting-result').getByText(/Balanceado/).waitFor();

  await erp.page.getByTestId('depth-project-id').fill('UI-PROJ');
  await erp.page.getByTestId('depth-project-load').click();
  await erp.page.getByTestId('depth-project-result').getByText(/R\$\s*40,00/).waitFor();

  await erp.page.getByTestId('depth-crm-lead-name').fill('Lead E2E');
  await erp.page.getByTestId('depth-crm-create').click();
  await erp.page.getByTestId('depth-crm-result').getByText(/Lead criado/).waitFor();

  await erp.page.getByTestId('depth-shop-operation-name').fill('Operação E2E');
  await erp.page.getByTestId('depth-shop-operation-create').click();
  await erp.page.getByTestId('depth-shop-result').getByText(/Operação criada/).waitFor();

  await erp.page.getByTestId('depth-stock-product').fill('UI-PROD');
  await erp.page.getByTestId('depth-stock-suggest').click();
  await erp.page.getByTestId('depth-stock-result').getByText(/UI-BIN/).waitFor();

  await erp.page.getByTestId('depth-asset-id').fill('UI-ASSET');
  await erp.page.getByTestId('depth-asset-load').click();
  await erp.page.getByTestId('depth-asset-result').getByText(/R\$\s*1\.200,00/).waitFor();
  assert.equal(await erp.page.getByTestId('view-depth').isVisible(),true);
 }finally{await erp.close();}
});
