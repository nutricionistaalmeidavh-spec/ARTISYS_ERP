'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');
const {createLocalServer}=require('../server/local-server');

async function fixture(){let seq=0;const runtime=createErpRuntime({dbPath:':memory:',now:()=> '2026-09-27T12:00:00.000Z',idFactory:p=>`${p}-${++seq}`});const bootstrap=runtime.auth.createUser({id:'admin',username:'admin',name:'Admin',role:'admin',password:'senha-admin'});const server=createLocalServer({runtime,host:'127.0.0.1',port:0});const address=await server.start();const base=`http://${address.host}:${address.port}`;const login=async()=>{const r=await fetch(`${base}/api/v1/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'senha-admin'})});assert.equal(r.status,200);return (await r.json()).token;};const api=(token,path,{method='GET',body}={})=>fetch(`${base}${path}`,{method,headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return{runtime,server,login,api,async close(){await server.stop();runtime.close();}};}
async function ok(r){const x=await r.json();assert.ok(r.ok,`${r.status}: ${JSON.stringify(x)}`);return x;}

test('depth API exposes accounting, projects, CRM, shop floor, stock logistics and asset accounting',async()=>{const ctx=await fixture();try{const token=await ctx.login();
 // Accounting
 await ok(await ctx.api(token,'/api/v1/accounting/accounts',{method:'POST',body:{id:'CASH',code:'1.1',name:'Caixa',type:'ASSET',normalBalance:'DEBIT'}}));
 await ok(await ctx.api(token,'/api/v1/accounting/accounts',{method:'POST',body:{id:'REV',code:'4.1',name:'Receita',type:'REVENUE',normalBalance:'CREDIT'}}));
 await ok(await ctx.api(token,'/api/v1/accounting/journals',{method:'POST',body:{id:'API-J1',date:'2026-09-27',description:'Venda API',lines:[{accountId:'CASH',debitCents:1000},{accountId:'REV',creditCents:1000}]}}));
 const trial=await ok(await ctx.api(token,'/api/v1/accounting/trial-balance?from=2026-09-01&to=2026-09-30'));assert.equal(trial.balanced,true);
 // Projects
 await ok(await ctx.api(token,'/api/v1/ops/projects',{method:'POST',body:{id:'PR1',code:'PR1',name:'Projeto API'}}));
 await ok(await ctx.api(token,'/api/v1/projects/PR1/budget',{method:'POST',body:{budgetCents:10000}}));
 await ok(await ctx.api(token,'/api/v1/projects/PR1/time',{method:'POST',body:{hours:1,hourlyCostCents:1000,billableRateCents:2000,workedAt:'2026-09-27'}}));
 await ok(await ctx.api(token,'/api/v1/projects/PR1/revenue',{method:'POST',body:{description:'Entrega',amountCents:5000,occurredAt:'2026-09-27'}}));
 const profitability=await ok(await ctx.api(token,'/api/v1/projects/PR1/profitability'));assert.equal(profitability.profitCents,4000);
 // CRM
 const lead=await ok(await ctx.api(token,'/api/v1/crm/leads',{method:'POST',body:{id:'L-API',name:'Lead API',email:'lead@api.test'}}));assert.equal(lead.status,'OPEN');
 const customer=await ok(await ctx.api(token,'/api/v1/crm/leads/L-API/convert',{method:'POST',body:{}}));
 await ok(await ctx.api(token,'/api/v1/crm/opportunities',{method:'POST',body:{id:'O-API',leadId:'L-API',customerId:customer.id,name:'Venda API',expectedRevenueCents:30000}}));
 await ok(await ctx.api(token,'/api/v1/crm/opportunities/O-API/stage',{method:'POST',body:{stageId:'proposal'}}));
 const pipeline=await ok(await ctx.api(token,'/api/v1/crm/pipeline'));assert.equal(pipeline.byStage.proposal.count,1);
 // Shared inventory/manufacturing seed
 await ok(await ctx.api(token,'/api/v1/inventory/locations',{method:'POST',body:{id:'MAIN',name:'Principal'}}));
 await ok(await ctx.api(token,'/api/v1/products',{method:'POST',body:{id:'COMP',sku:'COMP',name:'Componente',costCents:1000,salePriceCents:1500,trackStock:true}}));
 await ok(await ctx.api(token,'/api/v1/products',{method:'POST',body:{id:'FG',sku:'FG',name:'Acabado',costCents:0,salePriceCents:10000,trackStock:true}}));
 ctx.runtime.retail.setProductRetail('FG',{productType:'MANUFACTURED'},{userId:'admin',role:'admin',companyId:'default'});ctx.runtime.retail.createBom('FG',{items:[{productId:'COMP',quantity:1}]},{userId:'admin',role:'admin',companyId:'default'});ctx.runtime.inventory.move({productId:'COMP',locationId:'MAIN',delta:5,unitCostCents:1000},{userId:'admin',role:'admin',companyId:'default'});const mo=ctx.runtime.manufacturing.createOrder({id:'M-API',productId:'FG',plannedQuantity:1,locationId:'MAIN',outputLocationId:'MAIN'},{userId:'admin',role:'admin',companyId:'default'});
 // Shop floor
 await ok(await ctx.api(token,'/api/v1/shop-floor/operations',{method:'POST',body:{id:'OP-API',name:'Corte',defaultMinutes:30}}));
 await ok(await ctx.api(token,'/api/v1/shop-floor/workstations',{method:'POST',body:{id:'WS-API',name:'Serra',capacity:1,costPerHourCents:6000}}));
 await ok(await ctx.api(token,'/api/v1/shop-floor/routings',{method:'POST',body:{id:'ROUTE-API',name:'Roteiro',productId:'FG',steps:[{operationId:'OP-API',workstationId:'WS-API',sequence:1}]}}));
 const cards=await ok(await ctx.api(token,`/api/v1/shop-floor/orders/${mo.id}/job-cards`,{method:'POST',body:{routingId:'ROUTE-API'}}));assert.equal(cards.length,1);
 await ok(await ctx.api(token,`/api/v1/shop-floor/job-cards/${cards[0].id}/start`,{method:'POST',body:{}}));
 const card=await ok(await ctx.api(token,`/api/v1/shop-floor/job-cards/${cards[0].id}/complete`,{method:'POST',body:{minutes:30,quantity:1}}));assert.equal(card.actualCostCents,3000);
 // Stock logistics
 await ok(await ctx.api(token,'/api/v1/stock-logistics/putaway-rules',{method:'POST',body:{id:'PUT-API',productId:'COMP',targetLocationId:'MAIN',priority:1}}));
 const suggested=await ok(await ctx.api(token,'/api/v1/stock-logistics/putaway-suggestion?productId=COMP'));assert.equal(suggested.locationId,'MAIN');
 const pick=await ok(await ctx.api(token,'/api/v1/stock-logistics/picks',{method:'POST',body:{id:'PICK-API',sourceType:'MANUAL',sourceId:'API',locationId:'MAIN',items:[{productId:'COMP',quantity:1}]}}));
 await ok(await ctx.api(token,`/api/v1/stock-logistics/picks/${pick.id}/complete`,{method:'POST',body:{}}));
 const pack=await ok(await ctx.api(token,'/api/v1/stock-logistics/packages',{method:'POST',body:{id:'PACK-API',pickId:pick.id,carrier:'X'}}));
 const shipped=await ok(await ctx.api(token,`/api/v1/stock-logistics/packages/${pack.id}/ship`,{method:'POST',body:{trackingCode:'TRACK'}}));assert.equal(shipped.status,'SHIPPED');
 // Asset accounting (additional accounts)
 for(const a of [{id:'FA',code:'1.2',name:'Imobilizado',type:'ASSET',normalBalance:'DEBIT'},{id:'AD',code:'1.2.1',name:'Dep Acum',type:'ASSET',normalBalance:'CREDIT'},{id:'DE',code:'5.1',name:'Desp Dep',type:'EXPENSE',normalBalance:'DEBIT'}])await ok(await ctx.api(token,'/api/v1/accounting/accounts',{method:'POST',body:a}));
 await ok(await ctx.api(token,'/api/v1/ops/assets',{method:'POST',body:{id:'AS-API',code:'AS-API',name:'Maquina API'}}));
 const book=await ok(await ctx.api(token,'/api/v1/asset-accounting/capitalize',{method:'POST',body:{assetId:'AS-API',acquisitionDate:'2026-09-01',acquisitionCostCents:120000,residualValueCents:0,usefulLifeMonths:12,assetAccountId:'FA',accumulatedDepreciationAccountId:'AD',depreciationExpenseAccountId:'DE',counterpartAccountId:'CASH'}}));assert.equal(book.netBookValueCents,120000);
 const dep=await ok(await ctx.api(token,'/api/v1/asset-accounting/assets/AS-API/depreciate',{method:'POST',body:{date:'2026-10-01'}}));assert.equal(dep.amountCents,10000);
 }finally{await ctx.close();}});
