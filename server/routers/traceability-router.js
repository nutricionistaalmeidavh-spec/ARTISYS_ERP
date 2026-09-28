'use strict';
const {json}=require('../http-utils');
const {pathMatch,requireActor,body,asHttpError}=require('../router-utils');
function createTraceabilityRouter({runtime,sessions,bodyLimitBytes=1024*1024}={}){
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/v1/traceability'))return false;
  try{
   const actor=requireActor(req,sessions),p=url.pathname,read=()=>body(req,bodyLimitBytes);let m;
   const companyId=String(actor.companyId||'default'),from=url.searchParams.get('from')||'2000-01-01',to=url.searchParams.get('to')||'2999-12-31';
   if((m=pathMatch(p,'/api/v1/traceability/products/:id'))&&req.method==='GET'){json(res,200,runtime.traceability.traceProduct({productId:m.id,companyId}));return true;}
   if((m=pathMatch(p,'/api/v1/traceability/products/:id/performance'))&&req.method==='GET'){json(res,200,runtime.productPerformance.product(m.id,{companyId,from,to}));return true;}
   if((m=pathMatch(p,'/api/v1/traceability/suppliers/:id/performance'))&&req.method==='GET'){json(res,200,runtime.productPerformance.supplier(m.id,{companyId,from,to}));return true;}
   if((m=pathMatch(p,'/api/v1/traceability/sources/:type/:id'))&&req.method==='GET'){json(res,200,runtime.traceability.traceSource({type:m.type,id:m.id,companyId}));return true;}
   if(p==='/api/v1/traceability/top-products'&&req.method==='GET'){json(res,200,runtime.productPerformance.topProducts({companyId,from,to,limit:url.searchParams.get('limit')||10}));return true;}
   if(p==='/api/v1/traceability/health'&&req.method==='GET'){json(res,200,runtime.legacyBackfill.health(actor));return true;}
   if(p==='/api/v1/traceability/backfill/preview'&&req.method==='POST'){if(actor.role!=='admin')throw Object.assign(new Error('Autorizacao insuficiente.'),{statusCode:403});await read();json(res,200,runtime.legacyBackfill.preview(actor));return true;}
   if(p==='/api/v1/traceability/backfill/run'&&req.method==='POST'){if(actor.role!=='admin')throw Object.assign(new Error('Autorizacao insuficiente.'),{statusCode:403});await read();json(res,200,runtime.legacyBackfill.run(actor));return true;}
   if(p==='/api/v1/traceability/rebuild-commercial-facts'&&req.method==='POST'){if(actor.role!=='admin')throw Object.assign(new Error('Autorizacao insuficiente.'),{statusCode:403});await read();json(res,200,runtime.commercialFacts.rebuild({companyId},actor));return true;}
   return false;
  }catch(error){throw asHttpError(error);}
 };
}
module.exports={createTraceabilityRouter};
