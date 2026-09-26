'use strict';const {json}=require('../http-utils');const {pathMatch,requireActor,body,asHttpError}=require('../router-utils');
function createOperationsRouter({runtime,sessions,bodyLimitBytes=1024*1024}={}){return async(req,res,url)=>{if(!url.pathname.startsWith('/api/v1/ops/'))return false;try{const a=requireActor(req,sessions),d=()=>body(req,bodyLimitBytes);let m;const p=url.pathname;
if(p==='/api/v1/ops/bi'&&req.method==='GET'){json(res,200,runtime.businessIntelligence.overview({from:url.searchParams.get('from')||'2000-01-01',to:url.searchParams.get('to')||'2999-12-31'}));return true}
if(p==='/api/v1/ops/branches'){if(req.method==='GET'){json(res,200,runtime.operations.listBranches(a));return true}if(req.method==='POST'){json(res,201,runtime.operations.createBranch(await d(),a));return true}}
if(p==='/api/v1/ops/dashboards'){if(req.method==='GET'){json(res,200,runtime.operations.listDashboards(a));return true}if(req.method==='POST'){json(res,201,runtime.operations.saveDashboard(await d(),a));return true}}
if(p==='/api/v1/ops/alerts'){if(req.method==='GET'){json(res,200,runtime.operations.listAlerts(a));return true}if(req.method==='POST'){json(res,201,runtime.operations.createAlert(await d(),a));return true}}
if((m=pathMatch(p,'/api/v1/ops/alerts/:id/:action'))&&req.method==='POST'){json(res,200,runtime.operations.alertAction(m.id,m.action,await d(),a));return true}
if(p==='/api/v1/ops/notifications'){if(req.method==='GET'){json(res,200,runtime.operations.notifications(a));return true}if(req.method==='POST'){json(res,201,runtime.operations.notify(await d(),a));return true}}
if((m=pathMatch(p,'/api/v1/ops/notifications/:id/read'))&&req.method==='POST'){json(res,200,runtime.operations.markRead(m.id,a));return true}
if(p==='/api/v1/ops/pricing'&&req.method==='POST'){json(res,201,runtime.operations.createPriceTable(await d(),a));return true}
if((m=pathMatch(p,'/api/v1/ops/pricing/:id/quote'))&&req.method==='GET'){json(res,200,runtime.operations.quotePrice(m.id,url.searchParams.get('productId'),Number(url.searchParams.get('quantity')||1),a));return true}
if(p==='/api/v1/ops/workflows'&&req.method==='POST'){json(res,201,runtime.operations.createWorkflow(await d(),a));return true}
if(p==='/api/v1/ops/workflow-instances'&&req.method==='POST'){json(res,201,runtime.operations.startWorkflow(await d(),a));return true}
if((m=pathMatch(p,'/api/v1/ops/workflow-instances/:id/transition'))&&req.method==='POST'){const x=await d();json(res,200,runtime.operations.transition(m.id,x.to,a));return true}
if(p==='/api/v1/ops/approvals'&&req.method==='POST'){json(res,201,runtime.operations.requestApproval(await d(),a));return true}
if((m=pathMatch(p,'/api/v1/ops/approvals/:id/decide'))&&req.method==='POST'){const x=await d();json(res,200,runtime.operations.decideApproval(m.id,x.decision,a));return true}
if(p==='/api/v1/ops/assets'){if(req.method==='GET'){json(res,200,runtime.operations.listAssets(a));return true}if(req.method==='POST'){json(res,201,runtime.operations.createAsset(await d(),a));return true}}
if(p==='/api/v1/ops/service-orders'){if(req.method==='GET'){json(res,200,runtime.operations.listServiceOrders(a));return true}if(req.method==='POST'){json(res,201,runtime.operations.createServiceOrder(await d(),a));return true}}
if((m=pathMatch(p,'/api/v1/ops/service-orders/:id/status'))&&req.method==='POST'){const x=await d();json(res,200,runtime.operations.setServiceOrderStatus(m.id,x.status,a));return true}
if(p==='/api/v1/ops/maintenance'&&req.method==='POST'){json(res,201,runtime.operations.createMaintenancePlan(await d(),a));return true}
if(p==='/api/v1/ops/maintenance/due'&&req.method==='GET'){json(res,200,runtime.operations.dueMaintenance(a));return true}
if((m=pathMatch(p,'/api/v1/ops/maintenance/:id/complete'))&&req.method==='POST'){json(res,200,runtime.operations.completeMaintenance(m.id,await d(),a));return true}
if(p==='/api/v1/ops/projects'){if(req.method==='GET'){json(res,200,runtime.operations.listProjects(a));return true}if(req.method==='POST'){json(res,201,runtime.operations.createProject(await d(),a));return true}}
if((m=pathMatch(p,'/api/v1/ops/projects/:id'))&&req.method==='GET'){json(res,200,runtime.operations.project(m.id,a));return true}
if((m=pathMatch(p,'/api/v1/ops/projects/:id/tasks'))&&req.method==='POST'){json(res,201,runtime.operations.addTask(m.id,await d(),a));return true}
return false}catch(e){throw asHttpError(e)}}}module.exports={createOperationsRouter};