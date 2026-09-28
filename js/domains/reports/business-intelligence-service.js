'use strict';

function createBusinessIntelligenceService({db,reports,inventoryDepth,mrp=null,productPerformance=null,now=()=>new Date().toISOString()}={}){
 function manufacturingOverview(companyId){
  const rows=db.prepare("SELECT status,planned_quantity,completed_quantity,due_at FROM manufacturing_orders WHERE company_id=? AND status!='CANCELLED'").all(String(companyId));
  const open=rows.filter(x=>['PLANNED','RELEASED','IN_PROGRESS'].includes(x.status));
  const nowMs=Date.parse(String(now()));
  const overdueOrders=open.filter(x=>x.due_at&&Number.isFinite(Date.parse(x.due_at))&&Date.parse(x.due_at)<nowMs).length;
  let mrpNetRequirement=0;
  if(mrp){
   try{const result=mrp.calculate({}, {companyId:String(companyId),userId:'system',role:'system'});mrpNetRequirement=(result.items||[]).reduce((sum,x)=>sum+Number(x.netRequirement||0),0);}catch{}
  }
  return{
   openOrders:open.length,
   overdueOrders,
   plannedQuantity:open.reduce((sum,x)=>sum+Number(x.planned_quantity||0),0),
   completedQuantity:rows.reduce((sum,x)=>sum+Number(x.completed_quantity||0),0),
   mrpNetRequirement
  };
 }
 function overview({from='2000-01-01',to='2999-12-31',companyId='default'}={}){
  const sales=reports.buildSalesSummary({from,to,companyId}),purchases=reports.buildPurchaseSummary({from,to}),inventory=reports.buildInventorySummary(),finance=db.prepare("SELECT COALESCE(SUM(CASE WHEN kind='RECEIVABLE' THEN amount_cents ELSE -amount_cents END),0) net FROM financial_entries WHERE status!='CANCELLED' AND substr(created_at,1,10)>=? AND substr(created_at,1,10)<=?").get(from,to),top=productPerformance?productPerformance.topProducts({companyId,from,to,limit:10}):[];
  let stock={};try{stock=inventoryDepth.analytics();}catch{}
  return{from,to,sales,purchases,inventory,financeNetCents:Number(finance?.net||0),topProducts:top,stock,manufacturing:manufacturingOverview(companyId)};
 }
 return{overview};
}
module.exports={createBusinessIntelligenceService};
