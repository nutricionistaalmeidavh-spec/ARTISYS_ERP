'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createErpRuntime}=require('../js/core/erp-runtime');

function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'artisys-ready-'));const dbPath=path.join(dir,'erp.sqlite');let n=0;const runtime=createErpRuntime({dbPath,now:()=> '2026-09-25T12:00:00.000Z',idFactory:p=>`${p}-${++n}`});const admin=runtime.auth.createUser({id:'admin',username:'admin',name:'Admin',role:'admin',password:'senha'});return{dir,runtime,admin,close(){runtime.close();fs.rmSync(dir,{recursive:true,force:true});}};}

test('product readiness migration creates default company and admin can manage company access',()=>{const fx=fixture();try{const admin={userId:fx.admin.id,role:'admin',companyId:'default'};assert.equal(fx.companies,undefined);assert.ok(fx.runtime.companies,'companies service missing');const defaults=fx.runtime.companies.listForUser(fx.admin.id);assert.equal(defaults[0].id,'default');const second=fx.runtime.companies.create({name:'Filial Centro',taxId:'123'},admin);assert.equal(second.name,'Filial Centro');fx.runtime.companies.grantUser(fx.admin.id,second.id,admin);assert.ok(fx.runtime.companies.listForUser(fx.admin.id).some(x=>x.id===second.id));assert.throws(()=>fx.runtime.companies.assertUserAccess('missing',second.id),/acesso|empresa/i);}finally{fx.close();}});

test('documents are company scoped and copied into controlled local storage',()=>{const fx=fixture();try{const actor={userId:fx.admin.id,role:'admin',companyId:'default'};const source=path.join(fx.dir,'origem.txt');fs.writeFileSync(source,'documento local');const doc=fx.runtime.documents.importFile({sourcePath:source,entityType:'customer',entityId:'C1',title:'Contrato'},actor);assert.equal(doc.companyId,'default');assert.ok(fs.existsSync(doc.storedPath));assert.equal(fx.runtime.documents.list({companyId:'default'}).length,1);assert.equal(fx.runtime.documents.list({companyId:'other'}).length,0);}finally{fx.close();}});

test('external integrations and bank connections stay optional and secrets are redacted',()=>{const fx=fixture();try{const actor={userId:fx.admin.id,role:'admin',companyId:'default'};const item=fx.runtime.integrations.create({kind:'BANK_API',name:'Banco teste',endpoint:'https://example.invalid',config:{token:'segredo',account:'123'}},actor);assert.equal(item.companyId,'default');assert.equal(item.config.token,'[REDACTED]');assert.equal(item.config.account,'123');const bank=fx.runtime.integrations.createBankConnection({name:'Conta principal',provider:'manual',accountId:'BANK'},actor);assert.equal(bank.provider,'manual');assert.equal(fx.runtime.integrations.listBankConnections({companyId:'default'}).length,1);}finally{fx.close();}});
