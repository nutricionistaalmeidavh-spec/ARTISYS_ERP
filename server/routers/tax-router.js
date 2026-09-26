'use strict';
const {json}=require('../http-utils');
const {pathMatch,requireActor,body,asHttpError}=require('../router-utils');
function createFiscalRouter({runtime,sessions,bodyLimitBytes=1024*1024}={}){
 return async(req,res,url)=>{const p=url.pathname;if(!p.startsWith('/api/v1/tax/'))return false;try{const a=requireActor(req,sessions),data=()=>body(req,bodyLimitBytes);let m;
  if(p==='/api/v1/tax/settings'){if(req.method==='GET'){json(res,200,runtime.fiscal.settings());return true}if(req.method==='PUT'){json(res,200,runtime.fiscal.saveSettings(await data(),a));return true}}
  if(p==='/api/v1/tax/runtime/status'&&req.method==='GET'){json(res,200,await runtime.fiscalRuntime.providerStatus());return true}
  if(p==='/api/v1/tax/runtime/sefaz-status'&&req.method==='GET'){json(res,200,await runtime.fiscalRuntime.sefazStatus());return true}
  if(p==='/api/v1/tax/profiles'){if(req.method==='GET'){json(res,200,runtime.fiscal.listProfiles());return true}if(req.method==='POST'){json(res,201,runtime.fiscal.saveProfile(await data(),a));return true}}
  if((m=pathMatch(p,'/api/v1/tax/products/:id'))){if(req.method==='GET'){json(res,200,runtime.fiscal.productFiscal(m.id));return true}if(req.method==='PUT'){json(res,200,runtime.fiscal.assignProduct(m.id,await data(),a));return true}}
  if(p==='/api/v1/tax/documents'){if(req.method==='GET'){json(res,200,runtime.fiscal.listDocuments());return true}if(req.method==='POST'){json(res,201,runtime.fiscal.createDocument(await data(),a));return true}}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/issue'))&&req.method==='POST'){json(res,200,await runtime.fiscalRuntime.issueDocument(m.id,a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/query'))&&req.method==='POST'){json(res,200,await runtime.fiscalRuntime.queryDocument(m.id,a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/cancel'))&&req.method==='POST'){json(res,200,await runtime.fiscalRuntime.cancelDocument(m.id,await data(),a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/contingency/create'))&&req.method==='POST'){json(res,200,await runtime.fiscalRuntime.createContingency(m.id,await data(),a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/contingency/send'))&&req.method==='POST'){json(res,200,await runtime.fiscalRuntime.sendContingency(m.id,await data(),a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id'))&&req.method==='GET'){json(res,200,runtime.fiscal.getDocument(m.id));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/transition'))&&req.method==='POST'){json(res,200,runtime.fiscal.transition(m.id,await data(),a));return true}
  return false;
 }catch(e){throw asHttpError(e)}};
}
module.exports={createFiscalRouter};
