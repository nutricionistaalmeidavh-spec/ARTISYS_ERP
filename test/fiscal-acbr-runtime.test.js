'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const {createAcbrLocalProvider,normalizeLoopbackBaseUrl}=require('../js/domains/tax/acbr-local-provider');

function fakeFetch(log){
  return async(url,options={})=>{
    log.push({url:String(url),method:options.method||'GET',body:options.body?JSON.parse(options.body):null,authorization:options.headers?.authorization||null});
    return {ok:true,status:200,async text(){return JSON.stringify({healthy:true,result:{ok:true,status:200,data:{accessKey:'351234'}}});}};
  };
}

test('ACBr local aceita somente endpoint HTTP em loopback',()=>{
  assert.equal(normalizeLoopbackBaseUrl('http://127.0.0.1:3210'),'http://127.0.0.1:3210');
  assert.equal(normalizeLoopbackBaseUrl('http://localhost:3210'),'http://localhost:3210');
  assert.throws(()=>normalizeLoopbackBaseUrl('https://127.0.0.1:3210'),/HTTP local/);
  assert.throws(()=>normalizeLoopbackBaseUrl('http://192.168.0.10:3210'),/loopback local/);
});

test('provider ACBr encaminha emissao, consulta, contingencia e cancelamento ao sidecar autenticado',async()=>{
  const calls=[];
  const provider=createAcbrLocalProvider({
    connection:{provider:'acbr-local',environment:'homologation',documentType:'nfce'},
    baseUrl:'http://127.0.0.1:3210',authToken:'token-seguro-123456',fetchImpl:fakeFetch(calls)
  });
  await provider.issue({documentType:'nfce',reference:'sale-1',payload:{total:10}});
  await provider.query('sale-1','nfce',{accessKey:'351'});
  await provider.createContingency('sale-1',{total:10},'nfce');
  await provider.sendContingency('sale-1',{xml:'<NFe/>',payload:{total:10}},'nfce');
  await provider.cancel('sale-1','Cancelamento solicitado pelo cliente','nfce',{accessKey:'351',issuerCnpj:'12345678000195'});
  assert.deepEqual(calls.map(x=>x.method),['POST','GET','POST','POST','POST']);
  assert.match(calls[0].url,/\/v1\/documents\/nfce\/sale-1$/);
  assert.match(calls[1].url,/accessKey=351/);
  assert.match(calls[2].url,/\/contingency\/create$/);
  assert.match(calls[3].url,/\/contingency\/send$/);
  assert.match(calls[4].url,/\/cancel$/);
  assert.ok(calls.every(x=>x.authorization==='Bearer token-seguro-123456'));
});

test('build desktop inclui dominio fiscal, sidecar e slot externo do ACBr',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8'));
  assert.ok(pkg.build.files.includes('js/domains/tax/**/*'));
  assert.ok(pkg.build.files.includes('server/fiscal-sidecar/**/*'));
  const resources=pkg.build.extraResources||[];
  assert.ok(resources.some(x=>x.from==='fiscal-runtime/acbr'&&x.to==='fiscal/acbr'));
});
