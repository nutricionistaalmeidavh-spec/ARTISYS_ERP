'use strict';
const {withTransaction:defaultWithTransaction}=require('../../core/database/sqlite-database');

function extendManufacturingWithTraceability({db,manufacturing,costLedger,withTransaction=defaultWithTransaction,operationLookup=null,adjustActualCost=null}={}){
 if(!manufacturing)return manufacturing;
 const findOperation=operationLookup||((operationKey,companyId)=>{if(!operationKey||!db?.prepare)return null;const rows=db.prepare('SELECT id,total_cost_cents FROM inventory_cost_allocations WHERE company_id=? AND operation_key=? ORDER BY allocated_at,id').all(String(companyId||'default'),String(operationKey));return rows.length?{operationKey,allocations:rows,totalCostCents:rows.reduce((s,x)=>s+Number(x.total_cost_cents),0)}:null;});
 const adjust=adjustActualCost||(({orderId,componentId,differenceCents,companyId})=>{if(!differenceCents)return;db.prepare('UPDATE manufacturing_order_components SET actual_cost_cents=actual_cost_cents+? WHERE id=? AND manufacturing_order_id=?').run(differenceCents,String(componentId),String(orderId));db.prepare('UPDATE manufacturing_orders SET actual_material_cost_cents=actual_material_cost_cents+? WHERE id=? AND company_id=?').run(differenceCents,String(orderId),String(companyId));});
 function consumeComponent(id,componentId,input={},actor=null){
  const key=String(input.idempotencyKey||'').trim(),companyId=actor?.companyId||'default';
  if(key&&findOperation(key,companyId))return manufacturing.getOrder(id,actor);
  return withTransaction(db,()=>{
   const before=manufacturing.getOrder(id,actor),beforeComponent=before?.components?.find(x=>x.id===String(componentId));
   manufacturing.consumeComponent(id,componentId,input,actor);
   const afterBase=manufacturing.getOrder(id,actor),afterComponent=afterBase?.components?.find(x=>x.id===String(componentId));
   const operationKey=key||`legacy:manufacturing:${id}:${componentId}:${afterComponent?.consumedQuantity||0}`;
   const allocation=costLedger.allocateOutflow({productId:afterComponent.productId,locationId:afterBase.locationId,quantity:Number(input.quantity),destinationType:'MANUFACTURING_ORDER',destinationId:String(id),destinationItemId:String(componentId),idempotencyKey:operationKey},actor);
   const baseIncrease=Number(afterComponent?.actualCostCents||0)-Number(beforeComponent?.actualCostCents||0),differenceCents=Number(allocation.totalCostCents||0)-baseIncrease;
   adjust({orderId:String(id),componentId:String(componentId),differenceCents,companyId});
   return manufacturing.getOrder(id,actor);
  });
 }
 function reportOutput(id,input={},actor=null){return manufacturing.reportOutput(id,input,actor);}
 function complete(id,actor=null){
  return withTransaction(db,()=>{
   manufacturing.complete(id,actor);
   const order=manufacturing.getOrder(id,actor);
   if(order?.status==='COMPLETED'&&Number(order.completedQuantity)>0&&costLedger){const total=Number(order.actualTotalCostCents||order.actualMaterialCostCents+order.additionalCostCents),unit=Math.round(total/Number(order.completedQuantity));costLedger.createLayer({productId:order.productId,locationId:order.outputLocationId,quantity:Number(order.completedQuantity),unitCostCents:unit,sourceType:'manufacturing-output',sourceId:order.id,manufacturingOrderId:order.id,receivedAt:order.completedAt||undefined,idempotencyKey:`manufacturing-complete:${order.id}`},actor);}
   return order;
  });
 }
 return{...manufacturing,consumeComponent,reportOutput,complete};
}
module.exports={extendManufacturingWithTraceability};
