'use strict';
const path=require('node:path');
const {json,HttpError}=require('../http-utils');
const {pathMatch,requireActor,body,asHttpError}=require('../router-utils');
function createAdminRouter({runtime,sessions,bodyLimitBytes=1024*1024}={}){return async function adminRouter(req,res,url){
 try{
  if(url.pathname==='/api/v1/admin/companies'&&req.method==='GET'){requireActor(req,sessions,['admin']);json(res,200,runtime.companies.list({includeInactive:true}));return true;}
  if(url.pathname==='/api/v1/admin/companies'&&req.method==='POST'){const actor=requireActor(req,sessions,['admin']);json(res,201,runtime.companies.create(await body(req,bodyLimitBytes),actor));return true;}
  const companyAccess=pathMatch(url.pathname,'/api/v1/admin/companies/:id/users/:userId');
  if(companyAccess&&req.method==='POST'){const actor=requireActor(req,sessions,['admin']);runtime.companies.grantUser(companyAccess.userId,companyAccess.id,actor);json(res,200,{ok:true});return true;}
  if(companyAccess&&req.method==='DELETE'){const actor=requireActor(req,sessions,['admin']);runtime.companies.revokeUser(companyAccess.userId,companyAccess.id,actor);json(res,200,{ok:true});return true;}
  if(url.pathname==='/api/v1/admin/users'&&req.method==='GET'){requireActor(req,sessions,['admin']);const users=runtime.auth.listUsers().map(user=>({...user,companies:runtime.companies.listForUser(user.id)}));json(res,200,users);return true;}
  if(url.pathname==='/api/v1/admin/users'&&req.method==='POST'){const actor=requireActor(req,sessions,['admin']);const payload=await body(req,bodyLimitBytes);const user=runtime.auth.createUser(payload,actor);const companyIds=Array.isArray(payload.companyIds)&&payload.companyIds.length?payload.companyIds:[actor.companyId||'default'];for(const companyId of companyIds)runtime.companies.grantUser(user.id,companyId,actor);json(res,201,{...user,companies:runtime.companies.listForUser(user.id)});return true;}
  const userActive=pathMatch(url.pathname,'/api/v1/admin/users/:id/active');
  if(userActive&&req.method==='POST'){const actor=requireActor(req,sessions,['admin']);const payload=await body(req,bodyLimitBytes);json(res,200,runtime.auth.setUserActive(userActive.id,Boolean(payload.active),actor));return true;}
  if(url.pathname==='/api/v1/admin/backups'&&req.method==='GET'){requireActor(req,sessions,['admin']);if(!runtime.backup)throw new HttpError(409,'Backup requer banco persistente.');json(res,200,runtime.backup.listBackups());return true;}
  if(url.pathname==='/api/v1/admin/backups'&&req.method==='POST'){requireActor(req,sessions,['admin']);if(!runtime.backup)throw new HttpError(409,'Backup requer banco persistente.');const payload=await body(req,bodyLimitBytes);json(res,201,runtime.backup.createBackup(payload.label||'manual'));return true;}
  if(url.pathname==='/api/v1/admin/backups/restore'&&req.method==='POST'){requireActor(req,sessions,['admin']);if(!runtime.backup)throw new HttpError(409,'Backup requer banco persistente.');const payload=await body(req,bodyLimitBytes);const chosen=runtime.backup.listBackups().find(x=>x.name===String(payload.name||''));if(!chosen)throw new HttpError(404,'Backup nao encontrado.');const target=path.join(path.dirname(runtime.backup.backupDir),'restore-pending.sqlite');runtime.backup.restoreBackup({backupPath:chosen.path,targetPath:target});json(res,200,{ok:true,pendingPath:target,requiresRestart:true});return true;}
  if(url.pathname==='/api/v1/admin/documents'&&req.method==='GET'){const actor=requireActor(req,sessions,['admin','manager','director']);json(res,200,runtime.documents?runtime.documents.list({companyId:actor.companyId,entityType:url.searchParams.get('entityType'),entityId:url.searchParams.get('entityId'),query:url.searchParams.get('query')}):[]);return true;}
  if(url.pathname==='/api/v1/admin/documents/import'&&req.method==='POST'){const actor=requireActor(req,sessions,['admin','manager','director']);if(!runtime.documents)throw new HttpError(409,'Documentos requerem banco persistente.');json(res,201,runtime.documents.importFile(await body(req,bodyLimitBytes),actor));return true;}
  const documentId=pathMatch(url.pathname,'/api/v1/admin/documents/:id');
  if(documentId&&req.method==='DELETE'){const actor=requireActor(req,sessions,['admin','manager']);if(!runtime.documents)throw new HttpError(409,'Documentos requerem banco persistente.');runtime.documents.remove(documentId.id,actor);json(res,200,{ok:true});return true;}
  if(url.pathname==='/api/v1/admin/integrations'&&req.method==='GET'){const actor=requireActor(req,sessions,['admin']);json(res,200,runtime.integrations.list({companyId:actor.companyId,includeInactive:true}));return true;}
  if(url.pathname==='/api/v1/admin/integrations'&&req.method==='POST'){const actor=requireActor(req,sessions,['admin']);json(res,201,runtime.integrations.create(await body(req,bodyLimitBytes),actor));return true;}
  if(url.pathname==='/api/v1/admin/bank-connections'&&req.method==='GET'){const actor=requireActor(req,sessions,['admin','manager']);json(res,200,runtime.integrations.listBankConnections({companyId:actor.companyId,includeInactive:true}));return true;}
  if(url.pathname==='/api/v1/admin/bank-connections'&&req.method==='POST'){const actor=requireActor(req,sessions,['admin','manager']);json(res,201,runtime.integrations.createBankConnection(await body(req,bodyLimitBytes),actor));return true;}
  return false;
 }catch(error){throw asHttpError(error);}
};}
module.exports={createAdminRouter};
