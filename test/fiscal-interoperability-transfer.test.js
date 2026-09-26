'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');

function fixture(){
 let n=0;
 const rt=createErpRuntime({idFactory:p=>`${p}-${++n}`,now:()=> '2026-09-26T12:00:00.000Z'});
 const actor={userId:'admin',role:'admin',companyId:'default'};
 rt.auth.createUser({id:'admin',username:'admin',name:'Admin',role:'admin',password:'x'});
 rt.inventory.createLocation({id:'MAIN',name:'Origem'},actor);
 rt.inventory.createLocation({id:'L2',name:'Destino'},actor);
 const cat=rt.catalog.createCategory({name:'Geral'},actor);
 rt.catalog.createProduct({id:'P1',name:'Produto',sku:'SKU1',categoryId:cat.id,costCents:600,salePriceCents:1000},actor);
 rt.inventory.move({productId:'P1',locationId:'MAIN',delta:20,sourceType:'seed',sourceId:'seed'},actor);
 rt.fiscal.saveSettings({cnpj:'12345678000199',stateRegistration:'123',legalName:'Empresa A',crt:'1',environment:'homologation',nfceSeries:1,nfeSeries:1},actor);
 rt.fiscal.saveProfile({id:'PF1',name:'Padrao',ncm:'12345678',cfop:'5102',origin:'0',csosn:'102',pisCst:'49',cofinsCst:'49',unit:'UN'},actor);
 rt.fiscal.assignProduct('P1',{profileId:'PF1'},actor);
 const ts='2026-09-26T12:00:00.000Z';
 rt.db.prepare("INSERT INTO company_branches(id,company_id,code,name,active,created_at,updated_at) VALUES('B1','default','B1','Matriz',1,?,?),('B2','default','B2','Filial',1,?,?),('BX','other','BX','Outra',1,?,?)").run(ts,ts,ts,ts,ts,ts);
 return{rt,actor,close:()=>rt.close()};
}

test('transfer defaults to non fiscal and exposes explicit NOT_FISCAL_REQUIRED state',()=>{
 const x=fixture();try{
  const t=x.rt.retail.requestTransfer({productId:'P1',fromLocationId:'MAIN',toLocationId:'L2',quantity:2,reason:'Reposicao',idempotencyKey:'tr-no-fiscal'},x.actor);
  assert.equal(t.fiscalRequired,false);
  const state=x.rt.fiscalInteroperability.inspectSource('INVENTORY_TRANSFER',t.id,x.actor);
  assert.equal(state.ready,false);
  assert.ok(state.pendingReasons.includes('NOT_FISCAL_REQUIRED'));
  assert.equal(state.documents.length,0);
 }finally{x.close();}
});

test('fiscal transfer validates branches and prepares one outbound NF-e without extra stock movement',()=>{
 const x=fixture();try{
  assert.throws(()=>x.rt.retail.requestTransfer({productId:'P1',fromLocationId:'MAIN',toLocationId:'L2',quantity:1,reason:'x',idempotencyKey:'bad-branch',fiscalRequired:true,fromBranchId:'B1',toBranchId:'BX'},x.actor),/filial|empresa/i);
  const t=x.rt.retail.requestTransfer({productId:'P1',fromLocationId:'MAIN',toLocationId:'L2',quantity:3,reason:'Reposicao',idempotencyKey:'tr-fiscal',fiscalRequired:true,fromBranchId:'B1',toBranchId:'B2'},x.actor);
  assert.equal(t.fiscalRequired,true);
  assert.equal(t.fromBranchId,'B1');
  assert.equal(t.toBranchId,'B2');
  const before=Number(x.rt.db.prepare('SELECT COUNT(*) n FROM inventory_movements').get().n);
  const prepared=x.rt.fiscalInteroperability.prepareSource({sourceType:'INVENTORY_TRANSFER',sourceId:t.id,idempotencyKey:'fiscal-transfer-1'},x.actor);
  assert.equal(prepared.documents.length,1);
  assert.equal(prepared.documents[0].documentType,'nfe');
  assert.equal(prepared.documents[0].direction,'OUTBOUND');
  assert.equal(prepared.documents[0].operationKind,'TRANSFER');
  assert.equal(Number(x.rt.db.prepare('SELECT COUNT(*) n FROM inventory_movements').get().n),before);
  x.rt.retail.transitionTransfer(t.id,'SHIP',x.actor);
  const retry=x.rt.fiscalInteroperability.prepareSource({sourceType:'INVENTORY_TRANSFER',sourceId:t.id,idempotencyKey:'fiscal-transfer-1'},x.actor);
  assert.equal(retry.documents[0].id,prepared.documents[0].id);
  x.rt.retail.transitionTransfer(t.id,'RECEIVE',x.actor);
  assert.equal(x.rt.fiscal.documentsForSource('INVENTORY_TRANSFER',t.id,x.actor).length,1);
 }finally{x.close();}
});
