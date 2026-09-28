'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createFiscalCredentialStore}=require('../desktop/fiscal-credential-store.cjs');

test('cofre fiscal protege A1/CSC e bloqueia certificado vencido',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'erp-fiscal-cred-'));
 const safeStorage={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value,'utf8'),decryptString:buffer=>Buffer.from(buffer).toString('utf8')};
 const store=createFiscalCredentialStore({app:{getPath:()=>dir},safeStorage,inspectPfx:()=>({fingerprint:'AA',subject:'CN=TESTE',serialNumber:'1',validFrom:'2026-01-01T00:00:00.000Z',validTo:'2027-01-01T00:00:00.000Z'}),now:()=>new Date('2026-09-26T12:00:00.000Z')});
 const status=store.save({pfxBase64:Buffer.from('PFX-TESTE').toString('base64'),password:'senha',csc:'csc-secreto',cscId:'1',certificateName:'teste.pfx'});
 assert.equal(status.configured,true);assert.equal(status.expired,false);assert.equal(status.cscId,'1');assert.equal(store.assertUsable().csc,'csc-secreto');
 store.remove();assert.equal(store.publicStatus().configured,false);fs.rmSync(dir,{recursive:true,force:true});
});
