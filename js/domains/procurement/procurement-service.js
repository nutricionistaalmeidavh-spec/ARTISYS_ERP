'use strict';
const {randomUUID}=require('node:crypto');
const {withTransaction}=require('../../core/database/sqlite-database');
const {writeAudit}=require('../../core/audit/audit-log');
const {assertRole}=require('../../core/auth/rbac');
const {assertCents}=require('../shared/money');
const {positiveQuantity}=require('../inventory/inventory-rules');

function createProcurementService({db,contacts,catalog,inventory,finance,settings=null,events=null,now=()=>new Date().toISOString(),idFactory=p=>`${p}-${randomUUID()}`}={}){
  if(!db||!contacts||!catalog||!inventory||!finance)throw new TypeError('procurement dependencies are required.');
  const manager=actor=>assertRole(actor,['admin','manager']);
  const mapItem=row=>row&&({
    id:row.id,purchaseOrderId:row.order_id,productId:row.product_id,
    quantity:Number(row.quantity),receivedQuantity:Number(row.received_quantity),
    pendingQuantity:Math.max(Number(row.quantity)-Number(row.received_quantity),0),
    unitCostCents:Number(row.unit_cost_cents),
    totalCents:Math.round(Number(row.quantity)*Number(row.unit_cost_cents)),
    createdAt:row.created_at,updatedAt:row.updated_at
  });

  function varianceFor(receiptId,orderItemId){
    return db.prepare('SELECT * FROM purchase_receipt_variances WHERE receipt_id=? AND order_item_id=?').get(String(receiptId),String(orderItemId));
  }

  function mapReceipt(row){
    if(!row)return null;
    const receiptRows=db.prepare('SELECT * FROM purchase_receipt_items WHERE receipt_id=? ORDER BY created_at,id').all(row.id);
    const items=receiptRows.map(item=>{
      const poItem=db.prepare('SELECT * FROM purchase_order_items WHERE id=?').get(item.order_item_id);
      const variance=varianceFor(row.id,item.order_item_id);
      const orderedQuantity=Number(variance?.ordered_quantity??poItem?.quantity??item.quantity);
      const receivedThisTime=Number(variance?.received_this_time??item.quantity);
      const receivedTotal=Number(variance?.projected_total??poItem?.received_quantity??item.quantity);
      const missingQuantity=Math.max(Number(variance?.missing_quantity??orderedQuantity-receivedTotal),0);
      const excessQuantity=Math.max(Number(variance?.excess_quantity??receivedTotal-orderedQuantity),0);
      const variancePercent=Number(variance?.variance_percent??(orderedQuantity>0?(excessQuantity/orderedQuantity)*100:0));
      const status=excessQuantity>0?'EXCESS':missingQuantity>0?'PARTIAL':'COMPLETE';
      return {
        id:item.id,purchaseReceiptId:item.receipt_id,purchaseOrderItemId:item.order_item_id,
        productId:item.product_id,quantity:Number(item.quantity),receivedThisTime,
        orderedQuantity,receivedTotal,missingQuantity,excessQuantity,variancePercent,status,
        unitCostCents:Number(item.unit_cost_cents),totalCents:Number(item.total_cents),createdAt:item.created_at
      };
    });
    return {
      id:row.id,purchaseOrderId:row.order_id,status:'RECEIVED',receivedAt:row.received_at,
      totalCents:Number(row.total_cents),payableEntryId:row.payable_entry_id,
      idempotencyKey:row.idempotency_key,createdBy:row.created_by,createdAt:row.created_at,items
    };
  }

  function mapOrder(row){
    if(!row)return null;
    const supplier=contacts.getContact(row.supplier_id);
    const items=db.prepare('SELECT * FROM purchase_order_items WHERE order_id=? ORDER BY created_at,id').all(row.id).map(mapItem);
    return {id:row.id,supplierId:row.supplier_id,supplierName:supplier?.name||null,locationId:row.location_id,status:row.status,expectedAt:row.expected_at,notes:row.notes,createdBy:row.created_by,orderedAt:row.ordered_at,cancelledAt:row.cancelled_at,createdAt:row.created_at,updatedAt:row.updated_at,totalCents:items.reduce((sum,item)=>sum+item.totalCents,0),items};
  }

  function getPurchaseOrder(id){return mapOrder(db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(String(id)));}
  function requireOrder(id){const row=db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(String(id));if(!row)throw new Error('Pedido de compra nao encontrado.');return row;}
  function getReceiptByMutation(key){return mapReceipt(db.prepare('SELECT * FROM purchase_receipts WHERE idempotency_key=?').get(String(key)));}

  function createPurchaseOrder(input={},actor=null){
    manager(actor);
    const supplier=contacts.requireSupplier(input.supplierId),location=inventory.requireLocation(input.locationId||'MAIN');
    if(!Array.isArray(input.items)||!input.items.length)throw new Error('Pedido de compra deve possuir ao menos um item.');
    const seen=new Set();
    const normalized=input.items.map(item=>{
      const product=catalog.requireActiveProduct(item.productId);
      if(seen.has(product.id))throw new Error('Produto duplicado no pedido de compra.');
      seen.add(product.id);
      const quantity=positiveQuantity(item.quantity,'Quantidade'),unitCostCents=assertCents(item.unitCostCents,'unitCostCents');
      if(unitCostCents<0)throw new Error('Custo unitario invalido.');
      return{productId:product.id,quantity,unitCostCents};
    });
    const id=String(input.id||idFactory('po')),ts=String(now());
    return withTransaction(db,()=>{
      db.prepare("INSERT INTO purchase_orders(id,supplier_id,location_id,status,expected_at,notes,created_by,created_at,updated_at) VALUES(?,?,?,'DRAFT',?,?,?,?,?)").run(id,supplier.id,location.id,input.expectedAt||null,input.notes||null,actor?.userId||null,ts,ts);
      const insert=db.prepare('INSERT INTO purchase_order_items(id,order_id,product_id,quantity,unit_cost_cents,received_quantity,created_at,updated_at) VALUES(?,?,?,?,?,0,?,?)');
      for(const item of normalized)insert.run(idFactory('poi'),id,item.productId,item.quantity,item.unitCostCents,ts,ts);
      writeAudit(db,{action:'procurement.order.create',entity:'purchase-order',entityId:id,actor,context:{supplierId:supplier.id,locationId:location.id,itemCount:normalized.length}},now);
      return getPurchaseOrder(id);
    });
  }

  function submitPurchaseOrder(id,actor=null){
    manager(actor);const order=requireOrder(id);
    if(['ORDERED','PARTIALLY_RECEIVED','RECEIVED'].includes(order.status))return getPurchaseOrder(id);
    if(order.status!=='DRAFT')throw new Error(`Pedido de compra nao pode ser enviado no status ${order.status}.`);
    const ts=String(now());
    db.prepare("UPDATE purchase_orders SET status='ORDERED',ordered_at=?,updated_at=? WHERE id=?").run(ts,ts,order.id);
    writeAudit(db,{action:'procurement.order.submit',entity:'purchase-order',entityId:order.id,actor,context:{}},now);
    return getPurchaseOrder(order.id);
  }

  function receivePurchaseOrder(id,input={},actor=null){
    manager(actor);
    const mutationKey=String(input.idempotencyKey||'').trim();
    if(!mutationKey)throw new Error('Chave de idempotencia obrigatoria no recebimento.');
    const previous=getReceiptByMutation(mutationKey);if(previous)return previous;
    return withTransaction(db,()=>{
      const again=getReceiptByMutation(mutationKey);if(again)return again;
      const order=requireOrder(id);
      if(!['ORDERED','PARTIALLY_RECEIVED'].includes(order.status))throw new Error(`Pedido de compra nao pode ser recebido no status ${order.status}.`);
      if(!Array.isArray(input.items)||!input.items.length)throw new Error('Recebimento deve possuir ao menos um item.');
      const toleranceRaw=settings?.get?.('procurement.receiptExcessTolerancePercent',{defaultValue:0})??0;
      const tolerance=Math.max(Number(toleranceRaw)||0,0);
      const rows=db.prepare('SELECT * FROM purchase_order_items WHERE order_id=? ORDER BY created_at,id').all(order.id),byProduct=new Map(rows.map(row=>[row.product_id,row])),seen=new Set(),normalized=[];
      let totalCents=0,hasExcess=false,authorizedExcess=false;
      for(const item of input.items){
        const productId=String(item.productId||'');
        if(seen.has(productId))throw new Error('Produto duplicado no recebimento.');seen.add(productId);
        const poItem=byProduct.get(productId);if(!poItem)throw new Error('Produto nao pertence ao pedido de compra.');
        const quantity=positiveQuantity(item.quantity,'Quantidade recebida');
        const ordered=Number(poItem.quantity),previousReceived=Number(poItem.received_quantity),projected=previousReceived+quantity;
        const missing=Math.max(ordered-projected,0),excess=Math.max(projected-ordered,0),variancePercent=ordered>0?(excess/ordered)*100:0;
        if(excess>0)hasExcess=true;
        if(variancePercent>tolerance){
          const reason=String(input.excessAuthorization?.reason||'').trim();
          if(!reason)throw new Error(`Excedente de ${excess} requer autorizacao explicita.`);
          authorizedExcess=true;
        }
        const line=Math.round(quantity*Number(poItem.unit_cost_cents));
        normalized.push({poItem,productId,quantity,totalCents:line,ordered,previousReceived,projected,missing,excess,variancePercent});
        totalCents+=line;
      }
      const receiptId=String(input.id||idFactory('receipt')),ts=String(now());
      db.prepare('INSERT INTO purchase_receipts(id,order_id,idempotency_key,received_at,total_cents,payable_entry_id,created_by,created_at) VALUES(?,?,?,?,?,NULL,?,?)').run(receiptId,order.id,mutationKey,ts,totalCents,actor?.userId||null,ts);
      const insertItem=db.prepare('INSERT INTO purchase_receipt_items(id,receipt_id,order_item_id,product_id,quantity,unit_cost_cents,total_cents,created_at) VALUES(?,?,?,?,?,?,?,?)');
      const insertVariance=db.prepare('INSERT INTO purchase_receipt_variances(id,receipt_id,order_item_id,ordered_quantity,previous_received,received_this_time,projected_total,missing_quantity,excess_quantity,variance_percent,tolerance_percent,authorized_by,authorization_reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      for(const item of normalized){
        const product=catalog.requireActiveProduct(item.productId),before=inventory.getTotalBalance(item.productId),oldCost=Number(product.costCents);
        inventory.move({productId:item.productId,locationId:order.location_id,delta:item.quantity,unitCostCents:Number(item.poItem.unit_cost_cents),sourceType:'purchase-receipt',sourceId:receiptId},actor);
        const denominator=before+item.quantity;
        const weighted=denominator>0?Math.round(((before*oldCost)+(item.quantity*Number(item.poItem.unit_cost_cents)))/denominator):Number(item.poItem.unit_cost_cents);
        catalog.updateCost(item.productId,weighted,{userId:actor?.userId||'system',role:actor?.role||'system'});
        db.prepare('UPDATE purchase_order_items SET received_quantity=received_quantity+?,updated_at=? WHERE id=?').run(item.quantity,ts,item.poItem.id);
        insertItem.run(idFactory('pri'),receiptId,item.poItem.id,item.productId,item.quantity,item.poItem.unit_cost_cents,item.totalCents,ts);
        insertVariance.run(idFactory('variance'),receiptId,item.poItem.id,item.ordered,item.previousReceived,item.quantity,item.projected,item.missing,item.excess,item.variancePercent,tolerance,item.excess>0&&input.excessAuthorization?.reason?actor?.userId||null:null,item.excess>0?input.excessAuthorization?.reason||null:null,ts);
      }
      let payableId=null;
      if(totalCents>0){
        const dueAt=input.dueAt||order.expected_at||ts;
        const payable=finance.createEntry({kind:'PAYABLE',description:`Recebimento ${receiptId}`,categoryId:'PURCHASES',amountCents:totalCents,dueAt,sourceType:'purchase-receipt',sourceId:receiptId,notes:`Fornecedor ${order.supplier_id}`},actor);
        payableId=payable.id;db.prepare('UPDATE purchase_receipts SET payable_entry_id=? WHERE id=?').run(payable.id,receiptId);
      }
      const remaining=Number(db.prepare('SELECT COUNT(*) n FROM purchase_order_items WHERE order_id=? AND received_quantity < quantity').get(order.id)?.n||0),status=remaining?'PARTIALLY_RECEIVED':'RECEIVED';
      db.prepare('UPDATE purchase_orders SET status=?,updated_at=? WHERE id=?').run(status,ts,order.id);
      writeAudit(db,{action:'procurement.receipt.create',entity:'purchase-receipt',entityId:receiptId,actor,context:{purchaseOrderId:order.id,totalCents,status,hasExcess,tolerance}},now);
      if(events){
        const eventType=authorizedExcess?'procurement.receipt.excess_authorized':status==='RECEIVED'?'procurement.receipt.completed':'procurement.receipt.partial';
        events.outbox.insert(events.create(eventType,'purchase-receipt',receiptId,{purchaseOrderId:order.id,totalCents,payableEntryId:payableId},actor,mutationKey));
      }
      return mapReceipt(db.prepare('SELECT * FROM purchase_receipts WHERE id=?').get(receiptId));
    });
  }

  function listPurchaseOrders({status=null,supplierId=null,locationId=null}={}){const clauses=[],params=[];if(status){clauses.push('status=?');params.push(String(status).toUpperCase());}if(supplierId){clauses.push('supplier_id=?');params.push(String(supplierId));}if(locationId){clauses.push('location_id=?');params.push(String(locationId));}return db.prepare(`SELECT * FROM purchase_orders${clauses.length?` WHERE ${clauses.join(' AND ')}`:''} ORDER BY created_at DESC,id DESC`).all(...params).map(mapOrder);}
  function listReceipts({purchaseOrderId=null}={}){const rows=purchaseOrderId?db.prepare('SELECT * FROM purchase_receipts WHERE order_id=? ORDER BY received_at,id').all(String(purchaseOrderId)):db.prepare('SELECT * FROM purchase_receipts ORDER BY received_at,id').all();return rows.map(mapReceipt);}
  return{createPurchaseOrder,submitPurchaseOrder,receivePurchaseOrder,getPurchaseOrder,listPurchaseOrders,listReceipts};
}
module.exports={createProcurementService};
