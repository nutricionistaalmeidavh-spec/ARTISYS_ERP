'use strict';

function extendFiscalTransferInteroperability({db,fiscal,catalog,base}={}){
 if(!db||!fiscal||!catalog||!base)throw new TypeError('fiscal transfer interoperability dependencies are required.');
 const company=actor=>String(actor?.companyId||'default');
 const normalize=value=>String(value||'').trim().toUpperCase();
 const branch=id=>db.prepare('SELECT id,company_id,code,name,active FROM company_branches WHERE id=?').get(String(id||''));
 function transferContext(id,actor){
  const transfer=db.prepare('SELECT * FROM inventory_transfer_orders WHERE id=?').get(String(id));
  if(!transfer)return{error:'Transferencia nao encontrada.'};
  if(String(transfer.company_id)!==company(actor))return{error:'Transferencia pertence a outra empresa.'};
  return{transfer};
 }
 function fiscalItem(productId,quantity,actor){
  const product=catalog.requireActiveProduct(productId),tax=fiscal.productFiscal(product.id,actor);
  if(!tax)throw new Error(`Dados fiscais ausentes para produto ${product.id}.`);
  const qty=Number(quantity),unitPriceCents=Number(product.costCents||0);
  return{productId:product.id,sku:product.sku||null,description:product.name,quantity:qty,unitPriceCents,totalCents:Math.round(qty*unitPriceCents),fiscal:{profileId:tax.id,ncm:tax.ncm,cfop:tax.cfop,origin:tax.origin,csosn:tax.csosn||null,icmsCst:tax.icmsCst||null,pisCst:tax.pisCst,cofinsCst:tax.cofinsCst,unit:tax.unit,gtin:tax.gtin||null,ibsCbsCst:tax.ibsCbsCst||null,cClassTrib:tax.cClassTrib||null,overrides:tax.overrides||{}}};
 }
 function resolution(id,actor){
  const ctx=transferContext(id,actor);if(ctx.error)return{ready:false,pendingReasons:[ctx.error],documents:[],intents:[]};
  const t=ctx.transfer,documents=fiscal.documentsForSource('INVENTORY_TRANSFER',t.id,actor);
  if(!Boolean(t.fiscal_required))return{ready:false,pendingReasons:['NOT_FISCAL_REQUIRED'],documents,intents:[]};
  const reasons=[];
  if(!['REQUESTED','IN_TRANSIT'].includes(String(t.status)))reasons.push('Transferencia fiscal deve ser preparada antes ou durante a expedicao.');
  const from=branch(t.from_branch_id),to=branch(t.to_branch_id);
  if(!from||!from.active||String(from.company_id)!==company(actor))reasons.push('Filial fiscal de origem invalida.');
  if(!to||!to.active||String(to.company_id)!==company(actor))reasons.push('Filial fiscal de destino invalida.');
  if(!fiscal.settings(actor))reasons.push('Configuracao fiscal ausente.');
  let item=null;try{item=fiscalItem(t.product_id,t.quantity,actor);}catch(error){reasons.push(error.message);}
  if(reasons.length)return{ready:false,pendingReasons:Array.from(new Set(reasons)),documents,intents:[]};
  const cfg=fiscal.settings(actor),snapshot={companyId:company(actor),issuer:{companyId:cfg.companyId,cnpj:cfg.cnpj,stateRegistration:cfg.stateRegistration,legalName:cfg.legalName,tradeName:cfg.tradeName||null,crt:cfg.crt,address:cfg.address||{}},source:{type:'INVENTORY_TRANSFER',id:t.id},documentType:'nfe',direction:'OUTBOUND',operationKind:'TRANSFER',transfer:{status:t.status,reason:t.reason,fromLocationId:t.from_location_id,toLocationId:t.to_location_id,fromBranch:{id:from.id,code:from.code,name:from.name},toBranch:{id:to.id,code:to.code,name:to.name}},items:[item],totalCents:item.totalCents};
  return{ready:true,pendingReasons:[],documents,intents:[{sourceType:'INVENTORY_TRANSFER',sourceId:t.id,documentType:'nfe',direction:'OUTBOUND',operationKind:'TRANSFER',snapshot}]};
 }
 function inspectSource(sourceType,sourceId,actor=null){if(normalize(sourceType)!=='INVENTORY_TRANSFER')return base.inspectSource(sourceType,sourceId,actor);const r=resolution(sourceId,actor);return{sourceType:'INVENTORY_TRANSFER',sourceId:String(sourceId),ready:r.ready,pendingReasons:r.pendingReasons,documents:r.documents};}
 function prepareSource(input={},actor=null){if(normalize(input.sourceType)!=='INVENTORY_TRANSFER')return base.prepareSource(input,actor);const sourceId=String(input.sourceId||''),key=String(input.idempotencyKey||'').trim();if(!sourceId)throw new Error('Origem fiscal obrigatoria.');if(!key)throw new Error('Chave de idempotencia obrigatoria.');const r=resolution(sourceId,actor);if(!r.ready)throw new Error(`Origem fiscal nao esta pronta: ${r.pendingReasons.join(' ')}`);return{sourceType:'INVENTORY_TRANSFER',sourceId,ready:true,pendingReasons:[],documents:r.intents.map(intent=>fiscal.createPreparedDocument({...intent,idempotencyKey:key},actor))};}
 return{...base,inspectSource,prepareSource};
}
module.exports={extendFiscalTransferInteroperability};
