'use strict';
const http=require('node:http');
const {createSessionService}=require('../js/core/auth/session-service');
const {json,HttpError}=require('./http-utils');
const {createAuthRouter}=require('./routers/auth-router');
const {createAdminRouter}=require('./routers/admin-router');
const {createPagedQueryRouter}=require('./routers/paged-query-router');
const {createMasterDataRouter}=require('./routers/master-data-router');
const {createInventoryRouter}=require('./routers/inventory-router');
const {createProcurementRouter}=require('./routers/procurement-router');
const {createSalesAdminRouter}=require('./routers/sales-admin-router');
const {createRetailRouter}=require('./routers/retail-router');
const {createFiscalRouter}=require('./routers/fiscal-router');
const {createFinanceRouter}=require('./routers/finance-router');
const {createReportingRouter}=require('./routers/reporting-router');const {createLanAccessService}=require('./lan-access-service');const {createLanRouter}=require('./routers/lan-router');
function createLocalServer({runtime,host='127.0.0.1',port=4174,bodyLimitBytes=1024*1024}={}){
 if(!runtime)throw new TypeError('runtime is required.');const sessions=createSessionService();const lan=createLanAccessService();
 const routers=[createAuthRouter({runtime,sessions,bodyLimitBytes}),createAdminRouter({runtime,sessions,bodyLimitBytes}),createPagedQueryRouter({runtime,sessions}),createMasterDataRouter({runtime,sessions,bodyLimitBytes}),createInventoryRouter({runtime,sessions,bodyLimitBytes}),createProcurementRouter({runtime,sessions,bodyLimitBytes}),createSalesAdminRouter({runtime,sessions,bodyLimitBytes}),createRetailRouter({runtime,sessions,bodyLimitBytes}),createFiscalRouter({runtime,sessions,bodyLimitBytes}),createFinanceRouter({runtime,sessions,bodyLimitBytes}),createReportingRouter({runtime,sessions,bodyLimitBytes}),createLanRouter({lan,sessions,bodyLimitBytes})];
 let server=null;
 async function route(req,res){const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(url.pathname==='/api/v1/health'&&req.method==='GET'){json(res,200,{ok:true,product:'artisys-erp'});return;}for(const router of routers)if(await router(req,res,url))return;throw new HttpError(404,'Rota nao encontrada.');}
 async function start(){if(server)throw new Error('Servidor ja iniciado.');server=http.createServer((req,res)=>Promise.resolve(route(req,res)).catch(error=>{if(res.headersSent){res.end();return;}const status=Number(error.statusCode)||500;json(res,status,{error:status>=500?'Erro interno.':error.message});}));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});const address=server.address();return{host:typeof address==='object'&&address?address.address:host,port:typeof address==='object'&&address?address.port:port};}
 async function stop(){if(!server)return;const current=server;server=null;await new Promise((resolve,reject)=>current.close(error=>error?reject(error):resolve()));}
 return{start,stop,sessions,lan,get running(){return Boolean(server);}};
}
module.exports={createLocalServer};
