'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');
const {createLocalServer}=require('../server/local-server');

const actor=(companyId='default')=>({companyId,userId:`admin-${companyId}`,role:'admin'});
async function fixture(){
 let seq=0;
 const runtime=createErpRuntime({dbPath:':memory:',now:()=> '2026-09-27T12:00:00.000Z',idFactory:p=>`${p}-${++seq}`});
 runtime.auth.createUser({id:'admin',username:'admin',name:'Admin',role:'admin',password:'senha-admin'});
 const server=createLocalServer({runtime,host:'127.0.0.1',port:0});
 const address=await server.start();const base=`http://${address.host}:${address.port}`;
 const login=async()=>{const r=await fetch(`${base}/api/v1/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'senha-admin'})});assert.equal(r.status,200);return (await r.json()).token;};
 const api=(token,path,{method='GET',body}={})=>fetch(`${base}${path}`,{method,headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 return{runtime,server,login,api,async close(){await server.stop();runtime.close();}};
}
async function ok(r){const x=await r.json();assert.ok(r.ok,`${r.status}: ${JSON.stringify(x)}`);return x;}

test('accounting read endpoints list periods and date-filtered journals without leaking companies',async()=>{
 const ctx=await fixture();try{const token=await ctx.login(),a=actor(),other=actor('other');
  for(const x of [[a,'CASH','1.1','Caixa','ASSET','DEBIT'],[a,'REV','4.1','Receita','REVENUE','CREDIT'],[other,'O-CASH','1.1','Caixa outro','ASSET','DEBIT'],[other,'O-REV','4.1','Receita outro','REVENUE','CREDIT']])ctx.runtime.accounting.createAccount({id:x[1],code:x[2],name:x[3],type:x[4],normalBalance:x[5]},x[0]);
  ctx.runtime.accounting.createPeriod({id:'P-SEP',name:'Setembro',startDate:'2026-09-01',endDate:'2026-09-30'},a);
  ctx.runtime.accounting.createPeriod({id:'P-OCT',name:'Outubro',startDate:'2026-10-01',endDate:'2026-10-31'},a);
  ctx.runtime.accounting.createPeriod({id:'P-OTHER',name:'Outro',startDate:'2026-09-01',endDate:'2026-09-30'},other);
  ctx.runtime.accounting.postJournal({id:'J-SEP',date:'2026-09-15',description:'Venda setembro',lines:[{accountId:'CASH',debitCents:1000},{accountId:'REV',creditCents:1000}]},a);
  ctx.runtime.accounting.postJournal({id:'J-OCT',date:'2026-10-15',description:'Venda outubro',lines:[{accountId:'CASH',debitCents:2000},{accountId:'REV',creditCents:2000}]},a);
  ctx.runtime.accounting.postJournal({id:'J-OTHER',date:'2026-09-20',description:'Outro',lines:[{accountId:'O-CASH',debitCents:3000},{accountId:'O-REV',creditCents:3000}]},other);
  const periods=await ok(await ctx.api(token,'/api/v1/accounting/periods'));assert.deepEqual(periods.map(x=>x.id),['P-OCT','P-SEP'].sort());
  const journals=await ok(await ctx.api(token,'/api/v1/accounting/journals?from=2026-09-01&to=2026-09-30'));assert.deepEqual(journals.map(x=>x.id),['J-SEP']);assert.equal(journals[0].lines.length,2);
 }finally{await ctx.close();}
});

test('CRM read endpoints list stages, leads and opportunities with filters and company isolation',async()=>{
 const ctx=await fixture();try{const token=await ctx.login(),a=actor(),other=actor('other');
  ctx.runtime.crm.createLead({id:'L-1',name:'Lead principal',ownerId:'u-main'},a);
  ctx.runtime.crm.createLead({id:'L-OTHER',name:'Lead outro',ownerId:'u-other'},other);
  ctx.runtime.crm.createOpportunity({id:'O-1',name:'Oportunidade principal',expectedRevenueCents:5000,ownerId:'u-main'},a);
  ctx.runtime.crm.createOpportunity({id:'O-OTHER',name:'Oportunidade outro',expectedRevenueCents:7000,ownerId:'u-other'},other);
  const stages=await ok(await ctx.api(token,'/api/v1/crm/stages'));assert.equal(stages.some(x=>x.id==='new'),true);assert.equal(stages.some(x=>x.statusKind==='WON'),true);
  const leads=await ok(await ctx.api(token,'/api/v1/crm/leads?status=OPEN&ownerId=u-main'));assert.deepEqual(leads.map(x=>x.id),['L-1']);
  const opps=await ok(await ctx.api(token,'/api/v1/crm/opportunities?stageId=new&ownerId=u-main'));assert.deepEqual(opps.map(x=>x.id),['O-1']);
 }finally{await ctx.close();}
});

test('shop-floor read endpoints expose scoped operations, workstations, routings and filtered job cards',async()=>{
 const ctx=await fixture();try{const token=await ctx.login(),a=actor();
  ctx.runtime.catalog.createProduct({id:'FG',sku:'FG',name:'Produto acabado',costCents:0,salePriceCents:1000,trackStock:true},a);
  ctx.runtime.shopFloor.createOperation({id:'OP-1',name:'Corte',defaultMinutes:20},a);
  ctx.runtime.shopFloor.createWorkstation({id:'WS-1',name:'Serra',capacity:2,costPerHourCents:6000},a);
  ctx.runtime.shopFloor.createRouting({id:'R-1',name:'Roteiro 1',productId:'FG',steps:[{operationId:'OP-1',workstationId:'WS-1',sequence:1}]},a);
  ctx.runtime.db.prepare("INSERT INTO manufacturing_job_cards(id,company_id,manufacturing_order_id,routing_id,operation_id,workstation_id,sequence,status,planned_minutes,actual_minutes,completed_quantity,actual_cost_cents,created_at,updated_at) VALUES('JC-1','default','MO-1','R-1','OP-1','WS-1',1,'OPEN',20,0,0,0,'2026-09-27','2026-09-27')").run();
  ctx.runtime.db.prepare("INSERT INTO manufacturing_operations(company_id,id,name,default_minutes,active,created_at,updated_at) VALUES('other','OP-X','Oculta',10,1,'2026-09-27','2026-09-27')").run();
  ctx.runtime.db.prepare("INSERT INTO manufacturing_job_cards(id,company_id,manufacturing_order_id,routing_id,operation_id,workstation_id,sequence,status,planned_minutes,actual_minutes,completed_quantity,actual_cost_cents,created_at,updated_at) VALUES('JC-X','other','MO-X','R-X','OP-X','WS-X',1,'OPEN',10,0,0,0,'2026-09-27','2026-09-27')").run();
  const operations=await ok(await ctx.api(token,'/api/v1/shop-floor/operations'));assert.deepEqual(operations.map(x=>x.id),['OP-1']);
  const workstations=await ok(await ctx.api(token,'/api/v1/shop-floor/workstations'));assert.deepEqual(workstations.map(x=>x.id),['WS-1']);
  const routings=await ok(await ctx.api(token,'/api/v1/shop-floor/routings'));assert.equal(routings[0].steps[0].operationId,'OP-1');
  const cards=await ok(await ctx.api(token,'/api/v1/shop-floor/job-cards?orderId=MO-1&status=OPEN'));assert.deepEqual(cards.map(x=>x.id),['JC-1']);
 }finally{await ctx.close();}
});

test('stock-logistics read endpoints expose scoped putaway rules, picks and packages',async()=>{
 const ctx=await fixture();try{const token=await ctx.login(),a=actor();
  ctx.runtime.inventory.createLocation({id:'MAIN',name:'Principal'},a);
  ctx.runtime.catalog.createProduct({id:'P-1',sku:'P-1',name:'Produto',costCents:1000,salePriceCents:1500,trackStock:true},a);
  ctx.runtime.inventory.move({productId:'P-1',locationId:'MAIN',delta:5,unitCostCents:1000},a);
  ctx.runtime.stockLogistics.createPutawayRule({id:'PUT-1',productId:'P-1',targetLocationId:'MAIN',priority:1},a);
  const pick=ctx.runtime.stockLogistics.createPick({id:'PICK-1',sourceType:'MANUAL',sourceId:'SRC-1',locationId:'MAIN',items:[{productId:'P-1',quantity:1}]},a);
  ctx.runtime.stockLogistics.completePick(pick.id,a);ctx.runtime.stockLogistics.createPackage({id:'PACK-1',pickId:pick.id,carrier:'Transportadora'},a);
  ctx.runtime.db.prepare("INSERT INTO stock_putaway_rules(company_id,id,product_id,target_location_id,priority,active,created_at,updated_at) VALUES('other','PUT-X',NULL,'MAIN',1,1,'2026-09-27','2026-09-27')").run();
  ctx.runtime.db.prepare("INSERT INTO stock_picks(id,company_id,source_type,source_id,location_id,status,created_at) VALUES('PICK-X','other','MANUAL','X','MAIN','OPEN','2026-09-27')").run();
  ctx.runtime.db.prepare("INSERT INTO stock_packages(id,company_id,pick_id,carrier,status,created_at) VALUES('PACK-X','other','PICK-X','X','PACKED','2026-09-27')").run();
  const rules=await ok(await ctx.api(token,'/api/v1/stock-logistics/putaway-rules'));assert.deepEqual(rules.map(x=>x.id),['PUT-1']);
  const picks=await ok(await ctx.api(token,'/api/v1/stock-logistics/picks?status=PICKED'));assert.deepEqual(picks.map(x=>x.id),['PICK-1']);
  const packages=await ok(await ctx.api(token,'/api/v1/stock-logistics/packages?status=PACKED'));assert.deepEqual(packages.map(x=>x.id),['PACK-1']);
 }finally{await ctx.close();}
});

test('asset-accounting read endpoints list books and depreciation history without leaking companies',async()=>{
 const ctx=await fixture();try{const token=await ctx.login(),a=actor(),other=actor('other');
  for(const [who,prefix] of [[a,''],[other,'O-']])for(const x of [['CASH','1.1','Caixa','ASSET','DEBIT'],['FA','1.2','Imobilizado','ASSET','DEBIT'],['AD','1.2.1','Dep acumulada','ASSET','CREDIT'],['DE','5.1','Despesa dep','EXPENSE','DEBIT']])ctx.runtime.accounting.createAccount({id:`${prefix}${x[0]}`,code:x[1],name:`${x[2]} ${prefix}`,type:x[3],normalBalance:x[4]},who);
  ctx.runtime.operations.createAsset({id:'AS-1',code:'AS-1',name:'Máquina'},a);ctx.runtime.operations.createAsset({id:'AS-X',code:'AS-X',name:'Máquina X'},other);
  ctx.runtime.assetAccounting.capitalize({assetId:'AS-1',acquisitionDate:'2026-09-01',acquisitionCostCents:120000,residualValueCents:0,usefulLifeMonths:12,assetAccountId:'FA',accumulatedDepreciationAccountId:'AD',depreciationExpenseAccountId:'DE',counterpartAccountId:'CASH'},a);
  ctx.runtime.assetAccounting.postDepreciation('AS-1',{date:'2026-10-01'},a);
  ctx.runtime.assetAccounting.capitalize({assetId:'AS-X',acquisitionDate:'2026-09-01',acquisitionCostCents:240000,residualValueCents:0,usefulLifeMonths:24,assetAccountId:'O-FA',accumulatedDepreciationAccountId:'O-AD',depreciationExpenseAccountId:'O-DE',counterpartAccountId:'O-CASH'},other);
  const books=await ok(await ctx.api(token,'/api/v1/asset-accounting/assets'));assert.deepEqual(books.map(x=>x.assetId),['AS-1']);
  const deps=await ok(await ctx.api(token,'/api/v1/asset-accounting/assets/AS-1/depreciation'));assert.equal(deps.length,1);assert.equal(deps[0].amountCents,10000);
 }finally{await ctx.close();}
});
