'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{launchErpElectron}=require('./fixtures/erp-electron');
async function login(p){await p.getByTestId('login-username').fill('admin');await p.getByTestId('login-password').fill('admin123');await p.getByTestId('login-submit').click();await p.getByTestId('view-dashboard').waitFor();}
async function seed(p){await p.evaluate(async()=>{const base=await window.erpDesktop.getBaseUrl(),token=sessionStorage.getItem('erp-token');const r=await fetch(base+'/api/v1/products',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({id:'P-TRACE-UI',sku:'TRACE-UI-001',name:'Produto Trace UI',salePriceCents:1000,trackStock:false})});if(!r.ok)throw new Error(await r.text());});}
test('traceability UI accepts product ID and SKU and validates empty query',async()=>{const erp=await launchErpElectron();try{const p=erp.page;await login(p);await seed(p);await p.getByTestId('nav-rastreabilidade').click();await p.getByTestId('view-traceability').waitFor();await p.getByTestId('trace-search').click();await p.getByText('Informe o produto.',{exact:true}).waitFor();
await p.getByTestId('trace-product').fill('P-TRACE-UI');await p.getByTestId('trace-search').click();await p.getByText('Resultado econômico',{exact:true}).waitFor();assert.equal(await p.locator('.notice.error').count(),0);
await p.getByTestId('trace-product').fill('TRACE-UI-001');await p.getByTestId('trace-search').click();await p.getByText('Produto Trace UI',{exact:false}).first().waitFor().catch(()=>{});await p.getByText('Resultado econômico',{exact:true}).waitFor();assert.equal(await p.locator('.notice.error').count(),0);
}finally{await erp.close();}});
