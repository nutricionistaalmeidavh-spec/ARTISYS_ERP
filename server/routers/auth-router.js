'use strict';
const {HttpError,json,readBody}=require('../http-utils');const {resolveActor}=require('../auth-context');
function createAuthRouter({runtime,sessions,bodyLimitBytes=1024*1024}={}){return async function authRouter(req,res,url){
 if(url.pathname==='/api/v1/auth/login'&&req.method==='POST'){const body=await readBody(req,bodyLimitBytes);let user;try{user=runtime.auth.authenticate(body.username,body.password);}catch(error){throw new HttpError(401,error.message);}const companies=runtime.companies.listForUser(user.id);const activeCompany=companies[0]||runtime.companies.get('default');const token=sessions.create({userId:user.id,role:user.role,companyId:activeCompany?.id||'default'});json(res,200,{token,user,companies,activeCompany});return true;}
 if(url.pathname==='/api/v1/auth/logout'&&req.method==='POST'){const {token}=resolveActor(req,sessions);sessions.revoke(token);json(res,200,{ok:true});return true;}
 if(url.pathname==='/api/v1/auth/me'&&req.method==='GET'){const {actor}=resolveActor(req,sessions);const user=runtime.auth.getUser(actor.userId);if(!user||!user.active)throw new HttpError(401,'Usuario invalido.');const companies=runtime.companies.listForUser(user.id);const activeCompany=runtime.companies.get(actor.companyId)||companies[0]||null;json(res,200,{user,companies,activeCompany});return true;}
 if(url.pathname==='/api/v1/auth/company'&&req.method==='POST'){const {actor,token}=resolveActor(req,sessions);const body=await readBody(req,bodyLimitBytes);let activeCompany;try{activeCompany=runtime.companies.assertUserAccess(actor.userId,body.companyId);}catch(error){throw new HttpError(403,error.message);}sessions.setCompany(token,activeCompany.id);json(res,200,{activeCompany});return true;}
 return false;};}
module.exports={createAuthRouter};
