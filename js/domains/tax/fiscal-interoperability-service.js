'use strict';

function createFiscalInteroperabilityService({db,fiscal,retail,salesAdmin,serviceOrders,catalog,contacts}={}){
 if(!db||!fiscal||!retail||!salesAdmin||!serviceOrders||!catalog||!contacts)throw new TypeError('fiscal interoperability dependencies are required.');
 const company=actor=>String(actor?.companyId||'default');
 const normalizeType=value=>String(value||'').trim().toUpperCase();
 const contactSnapshot=id=>{if(!id)return null;const c=contacts.getContact(id);return c?{id:c.id,name:c.name,taxId:c.taxId||null,stateRegistration:c.stateRegistration||null,address:c.address||{},email:c.email||null,phone:c.phone||null}:null;};
 const issuerSnapshot=actor=>{const s=fiscal.settings(actor);if(!s)return null;return{companyId:s.companyId,cnpj:s.cnpj,stateRegistration:s.stateRegistration,legalName:s.legalName,tradeName:s.tradeName||null,crt:s.crt,address:s.address||{}};};
 function fiscalItem(productId,description,quantity,unitPriceCents,actor){
  const product=catalog.requireActiveProduct(productId),tax=fiscal.productFiscal(product.id,actor);
  if(!tax)throw new Error(`Dados fiscais ausentes para produto ${product.id}.`);
  const qty=Number(quantity),unit=Number(unitPriceCents),total=Math.round(qty*unit);
  return{productId:product.id,sku:product.sku||null,description:String(description||product.name),quantity:qty,unitPriceCents:unit,totalCents:total,fiscal:{profileId:tax.id,ncm:tax.ncm,cfop:tax.cfop,origin:tax.origin,csosn:tax.csosn||null,icmsCst:tax.icmsCst||null,pisCst:tax.pisCst,cofinsCst:tax.cofinsCst,unit:tax.unit,gtin:tax.gtin||null,serviceCode:tax.serviceCode||null,serviceDescription:tax.serviceDescription||null,ibsCbsCst:tax.ibsCbsCst||null,cClassTrib:tax.cClassTrib||null,overrides:tax.overrides||{}}};
 }
 function baseSnapshot({sourceType,sourceId,documentType,operationKind='ISSUE',counterpartyId=null,items,totalCents},actor){
  return{companyId:company(actor),issuer:issuerSnapshot(actor),counterparty:contactSnapshot(counterpartyId),source:{type:sourceType,id:String(sourceId)},documentType,direction:'OUTBOUND',operationKind,items,totalCents:Number(totalCents)};
 }
 function posResolution(id,actor){
  const row=db.prepare('SELECT * FROM pos_sales WHERE id=?').get(String(id));
  if(!row)return{ready:false,pendingReasons:['Venda PDV nao encontrada.'],documents:[]};
  if(String(row.company_id)!==company(actor))return{ready:false,pendingReasons:['Venda PDV pertence a outra empresa.'],documents:[]};
  const itemRows=db.prepare('SELECT * FROM pos_sale_items WHERE sale_id=? ORDER BY created_at,id').all(row.id);
  const reasons=[];const items=[];
  for(const x of itemRows){try{items.push(fiscalItem(x.product_id,null,x.quantity,x.unit_price_cents,actor));}catch(error){reasons.push(error.message);}}
  if(!fiscal.settings(actor))reasons.push('Configuracao fiscal ausente.');
  const snapshot=reasons.length?null:baseSnapshot({sourceType:'POS_SALE',sourceId:row.id,documentType:'nfce',counterpartyId:row.customer_id,items,totalCents:row.total_cents},actor);
  return{ready:reasons.length===0,pendingReasons:reasons,documents:fiscal.documentsForSource('POS_SALE',row.id,actor),intents:snapshot?[{sourceType:'POS_SALE',sourceId:row.id,documentType:'nfce',direction:'OUTBOUND',operationKind:'ISSUE',snapshot}]:[]};
 }
 function adminResolution(id,actor){
  const invoice=salesAdmin.getInvoice(id,actor);
  if(!invoice)return{ready:false,pendingReasons:['Fatura administrativa nao encontrada na empresa.'],documents:[]};
  const order=salesAdmin.getOrder(invoice.orderId,actor);if(!order)return{ready:false,pendingReasons:['Pedido administrativo da fatura nao encontrado.'],documents:[]};
  const reasons=[];const items=[];
  for(const x of invoice.items||[]){try{items.push(fiscalItem(x.productId,null,x.quantity,x.unitPriceCents,actor));}catch(error){reasons.push(error.message);}}
  if(!fiscal.settings(actor))reasons.push('Configuracao fiscal ausente.');
  const snapshot=reasons.length?null:baseSnapshot({sourceType:'ADMIN_INVOICE',sourceId:invoice.id,documentType:'nfe',counterpartyId:order.customerId,items,totalCents:invoice.totalCents},actor);
  return{ready:reasons.length===0,pendingReasons:reasons,documents:fiscal.documentsForSource('ADMIN_INVOICE',invoice.id,actor),intents:snapshot?[{sourceType:'ADMIN_INVOICE',sourceId:invoice.id,documentType:'nfe',direction:'OUTBOUND',operationKind:'ISSUE',snapshot}]:[]};
 }
 function serviceOrderResolution(id,actor){
  const order=serviceOrders.get(id,actor);if(!order)return{ready:false,pendingReasons:['OS nao encontrada na empresa.'],documents:[]};
  const documents=[...fiscal.documentsForSource('SERVICE_ORDER_SERVICE',order.id,actor),...fiscal.documentsForSource('SERVICE_ORDER_PARTS',order.id,actor)];
  const reasons=[];if(order.status!=='COMPLETED')reasons.push('OS precisa estar concluida para preparacao fiscal.');if(!fiscal.settings(actor))reasons.push('Configuracao fiscal ausente.');
  const serviceItems=[],partItems=[];
  if(order.status==='COMPLETED'){
   for(const line of order.lines||[]){
    if(line.lineType==='SERVICE'){
     try{const item=fiscalItem(line.productId,line.description,line.quantity,line.unitPriceCents,actor);if(!item.fiscal.serviceCode)reasons.push(`Codigo de servico fiscal ausente para produto ${line.productId}.`);serviceItems.push(item);}catch(error){reasons.push(error.message);}
    }else if(line.lineType==='PART'&&Number(line.consumedQuantity)>0){try{partItems.push(fiscalItem(line.productId,line.description,line.consumedQuantity,line.unitPriceCents,actor));}catch(error){reasons.push(error.message);}}
   }
  }
  const serviceTotal=serviceItems.reduce((sum,x)=>sum+x.totalCents,0),partsTotal=partItems.reduce((sum,x)=>sum+x.totalCents,0);
  if(order.status==='COMPLETED'&&(serviceTotal!==Number(order.serviceTotalCents)||partsTotal!==Number(order.partsTotalCents)||serviceTotal+partsTotal!==Number(order.totalCents)))reasons.push('Totais fiscais da OS nao reconciliam com a conclusao operacional.');
  const intents=[];
  if(!reasons.length&&serviceTotal>0){const snapshot=baseSnapshot({sourceType:'SERVICE_ORDER_SERVICE',sourceId:order.id,documentType:'nfse',counterpartyId:order.customerId,items:serviceItems,totalCents:serviceTotal},actor);snapshot.serviceOrder={number:order.number,title:order.title,completedAt:order.completedAt};intents.push({sourceType:'SERVICE_ORDER_SERVICE',sourceId:order.id,documentType:'nfse',direction:'OUTBOUND',operationKind:'ISSUE',snapshot,suffix:'service'});}
  if(!reasons.length&&partsTotal>0){const snapshot=baseSnapshot({sourceType:'SERVICE_ORDER_PARTS',sourceId:order.id,documentType:'nfe',counterpartyId:order.customerId,items:partItems,totalCents:partsTotal},actor);snapshot.serviceOrder={number:order.number,title:order.title,completedAt:order.completedAt};intents.push({sourceType:'SERVICE_ORDER_PARTS',sourceId:order.id,documentType:'nfe',direction:'OUTBOUND',operationKind:'ISSUE',snapshot,suffix:'parts'});}
  return{ready:reasons.length===0&&intents.length>0,pendingReasons:reasons.length?Array.from(new Set(reasons)):intents.length?[]:['OS concluida sem parcela fiscal faturavel.'],documents,intents};
 }
 function resolve(sourceType,sourceId,actor){const type=normalizeType(sourceType);if(type==='POS_SALE')return posResolution(sourceId,actor);if(type==='ADMIN_INVOICE')return adminResolution(sourceId,actor);if(type==='SERVICE_ORDER')return serviceOrderResolution(sourceId,actor);throw new Error('Origem fiscal de interoperabilidade nao suportada.');}
 function inspectSource(sourceType,sourceId,actor=null){const type=normalizeType(sourceType),r=resolve(type,sourceId,actor);return{sourceType:type,sourceId:String(sourceId),ready:r.ready,pendingReasons:r.pendingReasons||[],documents:r.documents||[]};}
 function prepareSource(input={},actor=null){const sourceType=normalizeType(input.sourceType),sourceId=String(input.sourceId||''),baseKey=String(input.idempotencyKey||'').trim();if(!sourceId)throw new Error('Origem fiscal obrigatoria.');if(!baseKey)throw new Error('Chave de idempotencia obrigatoria.');const r=resolve(sourceType,sourceId,actor);if(!r.ready)throw new Error(`Origem fiscal nao esta pronta: ${(r.pendingReasons||[]).join(' ')}`);const documents=(r.intents||[]).map(intent=>fiscal.createPreparedDocument({...intent,idempotencyKey:intent.suffix?`${baseKey}:${intent.suffix}`:baseKey},actor));return{sourceType,sourceId,ready:true,pendingReasons:[],documents};}
 return{inspectSource,prepareSource};
}
module.exports={createFiscalInteroperabilityService};
