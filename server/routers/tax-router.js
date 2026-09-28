'use strict';
const {json}=require('../http-utils');
const {pathMatch,requireActor,body,asHttpError}=require('../router-utils');
function createFiscalRouter({runtime,sessions,bodyLimitBytes=1024*1024}={}){
 return async(req,res,url)=>{const p=url.pathname;if(!p.startsWith('/api/v1/tax/'))return false;try{const a=requireActor(req,sessions),data=()=>body(req,bodyLimitBytes);let m;
  if(p==='/api/v1/tax/settings'){if(req.method==='GET'){json(res,200,runtime.fiscal.settings(a));return true}if(req.method==='PUT'){json(res,200,runtime.fiscal.saveSettings(await data(),a));return true}}
  if(p==='/api/v1/tax/runtime/status'&&req.method==='GET'){json(res,200,await runtime.fiscalRuntime.providerStatus());return true}
  if(p==='/api/v1/tax/runtime/sefaz-status'&&req.method==='GET'){json(res,200,await runtime.fiscalRuntime.sefazStatus());return true}
  if(p==='/api/v1/tax/profiles'){if(req.method==='GET'){json(res,200,runtime.fiscal.listProfiles(a));return true}if(req.method==='POST'){json(res,201,runtime.fiscal.saveProfile(await data(),a));return true}}
  if((m=pathMatch(p,'/api/v1/tax/products/:id'))){if(req.method==='GET'){json(res,200,runtime.fiscal.productFiscal(m.id,a));return true}if(req.method==='PUT'){json(res,200,runtime.fiscal.assignProduct(m.id,await data(),a));return true}}
  if((m=pathMatch(p,'/api/v1/tax/sources/:sourceType/:sourceId/prepare'))&&req.method==='POST'){const input=await data();json(res,201,runtime.fiscalInteroperability.prepareSource({...input,sourceType:m.sourceType,sourceId:m.sourceId},a));return true}
  if((m=pathMatch(p,'/api/v1/tax/sources/:sourceType/:sourceId'))&&req.method==='GET'){json(res,200,runtime.fiscalInteroperability.inspectSource(m.sourceType,m.sourceId,a));return true}
  if((m=pathMatch(p,'/api/v1/tax/inbound/purchase-receipts/:id'))&&req.method==='POST'){json(res,201,runtime.fiscalInteroperability.linkInboundPurchaseReceipt(m.id,await data(),a));return true}
  if(p==='/api/v1/tax/documents'){
   if(req.method==='GET'){
    const sourceType=url.searchParams.get('sourceType'),sourceId=url.searchParams.get('sourceId');
    if(Boolean(sourceType)!==Boolean(sourceId))throw new Error('sourceType e sourceId devem ser informados juntos.');
    const result=sourceType?runtime.fiscal.documentsForSource(sourceType,sourceId,a):runtime.fiscal.listDocuments({status:url.searchParams.get('status')||null,documentType:url.searchParams.get('documentType')||null},a);
    json(res,200,result);return true;
   }
   if(req.method==='POST'){
    const input=await data(),sourceType=String(input.sourceType||'').toUpperCase();
    if(['POS_SALE','ADMIN_INVOICE'].includes(sourceType)){const prepared=runtime.fiscalInteroperability.prepareSource(input,a);json(res,201,prepared.documents[0]||null);return true}
    json(res,201,runtime.fiscal.createDocument(input,a));return true;
   }
  }
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/issue'))&&req.method==='POST'){json(res,200,await runtime.fiscalRuntime.issueDocument(m.id,a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/query'))&&req.method==='POST'){json(res,200,await runtime.fiscalRuntime.queryDocument(m.id,a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/cancel'))&&req.method==='POST'){json(res,200,await runtime.fiscalRuntime.cancelDocument(m.id,await data(),a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/contingency/create'))&&req.method==='POST'){json(res,200,await runtime.fiscalRuntime.createContingency(m.id,await data(),a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/contingency/send'))&&req.method==='POST'){json(res,200,await runtime.fiscalRuntime.sendContingency(m.id,await data(),a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id'))&&req.method==='GET'){json(res,200,runtime.fiscal.getDocument(m.id,a));return true}
  if((m=pathMatch(p,'/api/v1/tax/documents/:id/transition'))&&req.method==='POST'){json(res,200,runtime.fiscal.transition(m.id,await data(),a));return true}
  return false;
 }catch(e){throw asHttpError(e)}};
}
module.exports={createFiscalRouter};
