'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {launchErpElectron}=require('./fixtures/erp-electron');

async function seed(page){
 await page.evaluate(async()=>{
  const base=await window.erpDesktop.getBaseUrl(),token=sessionStorage.getItem('erp-token');
  const req=async(path,method='POST',body)=>{const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);return r.json();};
  await req('/api/v1/accounting/accounts','POST',{id:'AW-CASH',code:'1.10',name:'Caixa Advanced',type:'ASSET',normalBalance:'DEBIT'});
  await req('/api/v1/accounting/accounts','POST',{id:'AW-REV',code:'4.10',name:'Receita Advanced',type:'REVENUE',normalBalance:'CREDIT'});
  await req('/api/v1/accounting/journals','POST',{id:'AW-J1',date:'2026-09-27',description:'Venda Advanced',lines:[{accountId:'AW-CASH',debitCents:2500},{accountId:'AW-REV',creditCents:2500}]});
  await req('/api/v1/ops/projects','POST',{id:'AW-PROJ',code:'AW-PROJ',name:'Projeto Advanced'});
  await req('/api/v1/projects/AW-PROJ/budget','POST',{budgetCents:10000});
  await req('/api/v1/projects/AW-PROJ/time','POST',{hours:1,hourlyCostCents:1000,billableRateCents:2000,workedAt:'2026-09-27'});
  await req('/api/v1/projects/AW-PROJ/revenue','POST',{description:'Entrega',amountCents:5000,occurredAt:'2026-09-27'});
  await req('/api/v1/inventory/locations','POST',{id:'AW-BIN',name:'Posição Advanced',type:'POSITION'});
  await req('/api/v1/products','POST',{id:'AW-PROD',sku:'AW-PROD',name:'Produto Advanced',costCents:1000,salePriceCents:1500,trackStock:true});
  await req('/api/v1/stock-logistics/putaway-rules','POST',{id:'AW-PUT',productId:'AW-PROD',targetLocationId:'AW-BIN',priority:1});
  for(const a of [{id:'AW-FA',code:'1.20',name:'Imobilizado Advanced',type:'ASSET',normalBalance:'DEBIT'},{id:'AW-AD',code:'1.21',name:'Dep Acum Advanced',type:'ASSET',normalBalance:'CREDIT'},{id:'AW-DE',code:'5.10',name:'Desp Dep Advanced',type:'EXPENSE',normalBalance:'DEBIT'}])await req('/api/v1/accounting/accounts','POST',a);
  await req('/api/v1/ops/assets','POST',{id:'AW-ASSET',code:'AW-ASSET',name:'Ativo Advanced'});
  await req('/api/v1/asset-accounting/capitalize','POST',{assetId:'AW-ASSET',acquisitionDate:'2026-09-01',acquisitionCostCents:120000,residualValueCents:0,usefulLifeMonths:12,assetAccountId:'AW-FA',accumulatedDepreciationAccountId:'AW-AD',depreciationExpenseAccountId:'AW-DE',counterpartAccountId:'AW-CASH'});
 });
}

test('advanced management exposes six operational workspaces without raw-id primary flows',async()=>{
 const erp=await launchErpElectron();
 try{
  await erp.page.getByTestId('login-username').fill('admin');
  await erp.page.getByTestId('login-password').fill('admin123');
  await erp.page.getByTestId('login-submit').click();
  await seed(erp.page);
  await erp.page.getByTestId('nav-gestao-avancada').click();
  await erp.page.getByTestId('view-depth').waitFor({state:'visible'});
  for(const id of ['accounting','projects','crm','shop-floor','stock-logistics','assets'])await erp.page.getByTestId(`advanced-nav-${id}`).waitFor({state:'visible'});

  await erp.page.getByTestId('advanced-nav-accounting').click();
  await erp.page.getByTestId('accounting-accounts-table').getByText('Caixa Advanced').waitFor();
  await erp.page.getByTestId('accounting-new-account').click();
  await erp.page.getByTestId('accounting-account-code').fill('1.30');
  await erp.page.getByTestId('accounting-account-name').fill('Banco Advanced');
  await erp.page.getByTestId('accounting-account-type').selectOption('ASSET');
  await erp.page.getByTestId('accounting-account-normal').selectOption('DEBIT');
  await erp.page.getByTestId('accounting-account-submit').click();
  await erp.page.getByTestId('accounting-accounts-table').getByText('Banco Advanced').waitFor();

  await erp.page.getByTestId('advanced-nav-projects').click();
  await erp.page.getByTestId('projects-table').getByText('Projeto Advanced').click();
  await erp.page.getByTestId('projects-profit').getByText(/R\$\s*40,00/).waitFor();
  assert.equal(await erp.page.getByPlaceholder('ID do projeto').count(),0);

  await erp.page.getByTestId('advanced-nav-crm').click();
  await erp.page.getByTestId('crm-new-lead').click();
  await erp.page.getByTestId('crm-lead-name').fill('Lead Advanced');
  await erp.page.getByTestId('crm-lead-submit').click();
  await erp.page.getByRole('button',{name:'Leads',exact:true}).click();
  await erp.page.getByTestId('crm-leads-table').getByText('Lead Advanced').waitFor();

  await erp.page.getByTestId('advanced-nav-shop-floor').click();
  await erp.page.getByTestId('shop-new-operation').click();
  await erp.page.getByTestId('shop-operation-name').fill('Operação Advanced');
  await erp.page.getByTestId('shop-operation-minutes').fill('30');
  await erp.page.getByTestId('shop-operation-submit').click();
  await erp.page.getByTestId('shop-operations-table').getByText('Operação Advanced').waitFor();

  await erp.page.getByTestId('advanced-nav-stock-logistics').click();
  await erp.page.getByTestId('stock-product-select').selectOption('AW-PROD');
  await erp.page.getByTestId('stock-putaway-suggest').click();
  await erp.page.getByTestId('stock-putaway-result').getByText(/Posição Advanced/).waitFor();
  assert.equal(await erp.page.getByPlaceholder('ID do produto').count(),0);

  await erp.page.getByTestId('advanced-nav-assets').click();
  await erp.page.getByTestId('assets-table').getByText('Ativo Advanced').click();
  await erp.page.getByTestId('asset-book-value').getByText(/R\$\s*1\.200,00/).waitFor();
  assert.equal(await erp.page.getByPlaceholder('ID do ativo').count(),0);
 }finally{await erp.close();}
});
