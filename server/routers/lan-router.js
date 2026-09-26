'use strict';const {json}=require('../http-utils');const {requireActor,body,pathMatch,asHttpError}=require('../router-utils');
function createLanRouter({lan,sessions,bodyLimitBytes=1024*1024}={}){return async(req,res,url)=>{if(!url.pathname.startsWith('/api/v1/lan/'))return false;try{let m;
 if(url.pathname==='/api/v1/lan/pair/redeem'&&req.method==='POST'){const input=await body(req,bodyLimitBytes),remote=req.socket?.remoteAddress||'';json(res,200,lan.redeem(input.code,{deviceName:input.deviceName,remoteAddress:remote}));return true;}
 const actor=requireActor(req,sessions,['admin','manager']);
 if(url.pathname==='/api/v1/lan/status'&&req.method==='GET'){json(res,200,{addresses:lan.addresses()});return true;}
 if(url.pathname==='/api/v1/lan/pair'&&req.method==='POST'){json(res,201,lan.createPairing(actor));return true;}
 if(url.pathname==='/api/v1/lan/devices'&&req.method==='GET'){json(res,200,lan.list(actor));return true;}
 if((m=pathMatch(url.pathname,'/api/v1/lan/devices/:id/revoke'))&&req.method==='POST'){json(res,200,lan.revoke(m.id,actor));return true;}
 return false;}catch(e){throw asHttpError(e);}}}module.exports={createLanRouter};