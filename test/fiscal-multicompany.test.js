'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createErpRuntime}=require('../js/core/erp-runtime');

const a={role:'admin',companyId:'company-a'};
const b={role:'admin',companyId:'company-b'};
const settings=(cnpj,name)=>({provider:'acbr-local',environment:'homologation',cnpj,stateRegistration:'123',legalName:name,crt:'1',seriesNfce:'1',seriesNfe:'2',seriesNfse:'3',operationNature:'VENDA',address:{city:'Teste'}});
const profile=name=>({id:'SHARED',name,ncm:'61091000',cfop:'5102',origin:'0',csosn:'102',pisCst:'49',cofinsCst:'49',unit:'UN',ibsCbsCst:'000',cClassTrib:'000001'});

test('fiscal core isolates settings profiles products documents and sequences by company',()=>{
 let n=0;
 const r=createErpRuntime({idFactory:p=>`${p}-${++n}`});
 try{
  r.catalog.createProduct({id:'P-SVC',name:'Servico compartilhado',sku:'P-SVC',salePriceCents:1000,trackStock:false},a);
  r.retail.setProductRetail('P-SVC',{productType:'SERVICE'},a);
  r.fiscal.saveSettings(settings('11111111000111','Empresa A'),a);
  r.fiscal.saveSettings(settings('22222222000122','Empresa B'),b);
  assert.equal(r.fiscal.settings(a).cnpj,'11111111000111');
  assert.equal(r.fiscal.settings(b).cnpj,'22222222000122');

  r.fiscal.saveProfile(profile('Perfil A'),a);
  r.fiscal.saveProfile(profile('Perfil B'),b);
  assert.equal(r.fiscal.listProfiles(a)[0].name,'Perfil A');
  assert.equal(r.fiscal.listProfiles(b)[0].name,'Perfil B');
  r.fiscal.assignProduct('P-SVC',{profileId:'SHARED',serviceCode:'01.01',serviceDescription:'Servico A'},a);
  r.fiscal.assignProduct('P-SVC',{profileId:'SHARED',serviceCode:'02.02',serviceDescription:'Servico B'},b);
  assert.equal(r.fiscal.productFiscal('P-SVC',a).serviceCode,'01.01');
  assert.equal(r.fiscal.productFiscal('P-SVC',b).serviceCode,'02.02');

  const intent={sourceType:'SERVICE_ORDER_SERVICE',sourceId:'OS-X',documentType:'nfse',direction:'OUTBOUND',operationKind:'ISSUE',snapshot:{totalCents:1000},idempotencyKey:'same-key'};
  const da=r.fiscal.createPreparedDocument(intent,a);
  const db=r.fiscal.createPreparedDocument(intent,b);
  assert.equal(da.number,1);
  assert.equal(db.number,1);
  assert.notEqual(da.id,db.id);
  assert.equal(r.fiscal.getDocument(da.id,a).companyId,'company-a');
  assert.equal(r.fiscal.getDocument(da.id,b),null);
  assert.equal(r.fiscal.documentsForSource('SERVICE_ORDER_SERVICE','OS-X',a).length,1);
  assert.equal(r.fiscal.documentsForSource('SERVICE_ORDER_SERVICE','OS-X',b).length,1);
 }finally{r.close();}
});
