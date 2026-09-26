'use strict';
const {json}=require('../http-utils');
const {pathMatch,requireActor,body,asHttpError}=require('../router-utils');

function createManufacturingRouter({runtime,sessions,bodyLimitBytes=1024*1024}={}){
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/v1/manufacturing/'))return false;
  try{
   const actor=requireActor(req,sessions),read=()=>body(req,bodyLimitBytes),p=url.pathname;let m;
   if(p==='/api/v1/manufacturing/orders'){
    if(req.method==='GET'){json(res,200,runtime.manufacturing.listOrders({status:url.searchParams.get('status'),productId:url.searchParams.get('productId'),locationId:url.searchParams.get('locationId'),limit:url.searchParams.get('limit'),offset:url.searchParams.get('offset')},actor));return true;}
    if(req.method==='POST'){json(res,201,runtime.manufacturing.createOrder(await read(),actor));return true;}
   }
   if(p==='/api/v1/manufacturing/mrp'&&req.method==='GET'){json(res,200,runtime.mrp.calculate({locationId:url.searchParams.get('locationId')||null},actor));return true;}
   if(p==='/api/v1/manufacturing/mrp/requisition'&&req.method==='POST'){json(res,200,runtime.mrp.generateMrpRequisition(await read(),actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/components/:componentId/consume'))&&req.method==='POST'){json(res,200,runtime.manufacturing.consumeComponent(m.id,m.componentId,await read(),actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/refresh-bom'))&&req.method==='POST'){json(res,200,runtime.manufacturing.refreshBom(m.id,actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/release'))&&req.method==='POST'){json(res,200,runtime.manufacturing.release(m.id,actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/start'))&&req.method==='POST'){json(res,200,runtime.manufacturing.start(m.id,actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/losses'))&&req.method==='POST'){json(res,200,runtime.manufacturing.reportLoss(m.id,await read(),actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/outputs'))&&req.method==='POST'){json(res,200,runtime.manufacturing.reportOutput(m.id,await read(),actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/costs'))&&req.method==='POST'){json(res,200,runtime.manufacturing.addCost(m.id,await read(),actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/complete'))&&req.method==='POST'){json(res,200,runtime.manufacturing.complete(m.id,actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/cancel'))&&req.method==='POST'){json(res,200,runtime.manufacturing.cancel(m.id,await read(),actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/shortages'))&&req.method==='GET'){json(res,200,{orderId:m.id,shortages:runtime.manufacturing.shortages(m.id,actor)});return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id/generate-shortage-requisition'))&&req.method==='POST'){json(res,200,runtime.mrp.generateShortageRequisition(m.id,actor));return true;}
   if((m=pathMatch(p,'/api/v1/manufacturing/orders/:id'))){
    if(req.method==='GET'){const result=runtime.manufacturing.getOrder(m.id,actor);if(!result)throw Object.assign(new Error('Ordem de producao nao encontrada.'),{statusCode:404});json(res,200,result);return true;}
    if(req.method==='PATCH'){json(res,200,runtime.manufacturing.updatePlanned(m.id,await read(),actor));return true;}
   }
   return false;
  }catch(error){throw asHttpError(error);}
 };
}
module.exports={createManufacturingRouter};
