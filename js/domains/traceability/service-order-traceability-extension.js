'use strict';
const {withTransaction:defaultWithTransaction}=require('../../core/database/sqlite-database');

function extendServiceOrdersWithTraceability({db,serviceOrders,costLedger,commercialFacts,withTransaction=defaultWithTransaction,operationLookup=null}={}){
 if(!serviceOrders)return serviceOrders;
 const findOperation=operationLookup||((operationKey,companyId)=>{if(!operationKey||!db?.prepare)return null;const rows=db.prepare('SELECT id,total_cost_cents FROM inventory_cost_allocations WHERE company_id=? AND operation_key=? ORDER BY allocated_at,id').all(String(companyId||'default'),String(operationKey));return rows.length?{operationKey,allocations:rows,totalCostCents:rows.reduce((s,x)=>s+Number(x.total_cost_cents),0)}:null;});
 function consumePart(id,lineId,input={},actor=null){
  const key=String(input.idempotencyKey||'').trim(),companyId=actor?.companyId||'default';
  if(key&&findOperation(key,companyId))return serviceOrders.get(id,actor)?.lines?.find(x=>x.id===String(lineId))||serviceOrders.get(id,actor);
  return withTransaction(db,()=>{
   const result=serviceOrders.consumePart(id,lineId,input,actor),order=serviceOrders.get(id,actor),line=order?.lines?.find(x=>x.id===String(lineId));
   if(line&&costLedger){const operationKey=key||`legacy:service-order:${id}:${lineId}:${line.consumedQuantity}`;costLedger.allocateOutflow({productId:line.productId,locationId:order.locationId,quantity:Number(input.quantity),destinationType:'SERVICE_ORDER',destinationId:String(id),destinationItemId:String(lineId),idempotencyKey:operationKey},actor);}
   return result;
  });
 }
 function complete(id,input={},actor=null){
  return withTransaction(db,()=>{
   const result=serviceOrders.complete(id,input,actor),order=serviceOrders.get(id,actor)||result;
   if(commercialFacts&&order?.status==='COMPLETED')for(const line of order.lines||[]){const qty=line.lineType==='PART'?Number(line.consumedQuantity||0):Number(line.quantity||0);if(qty<=0)continue;const revenueCents=Math.round(qty*Number(line.unitPriceCents||0)),realizedCostCents=line.lineType==='PART'&&costLedger?costLedger.getRealizedCost({destinationType:'SERVICE_ORDER',destinationId:order.id,destinationItemId:line.id,companyId:order.companyId||actor?.companyId||'default'}):0;commercialFacts.recordSaleFact({sourceType:'SERVICE_ORDER',sourceId:order.id,sourceItemId:line.id,productId:line.productId,customerId:order.customerId||null,quantity:qty,revenueCents,realizedCostCents,financialEntryId:order.receivableEntryId||null,occurredAt:order.completedAt||undefined,idempotencyKey:`commercial:service-order:${order.id}:${line.id}`},actor);}
   return result;
  });
 }
 return{...serviceOrders,consumePart,complete};
}
module.exports={extendServiceOrdersWithTraceability};
