'use strict';
const {HttpError,readBody}=require('./http-utils');
const {resolveActor}=require('./auth-context');
function pathMatch(pathname,pattern){const p=pattern.split('/').filter(Boolean),a=pathname.split('/').filter(Boolean);if(p.length!==a.length)return null;const out={};for(let i=0;i<p.length;i++){if(p[i].startsWith(':'))out[p[i].slice(1)]=decodeURIComponent(a[i]);else if(p[i]!==a[i])return null;}return out;}
function requireActor(req,sessions,roles=null){const {actor}=resolveActor(req,sessions);if(roles&&!roles.includes(String(actor.role||'')))throw new HttpError(403,'Permissao insuficiente.');return actor;}
function queryBool(url,key){return url.searchParams.get(key)==='true';}
function dateRange(url){const today=new Date().toISOString().slice(0,10);return{from:url.searchParams.get('from')||`${today.slice(0,7)}-01`,to:url.searchParams.get('to')||today};}
async function body(req,limit){return readBody(req,limit);}
function asHttpError(error){if(error instanceof HttpError)return error;if(/UNIQUE constraint failed/i.test(String(error?.message||'')))return new HttpError(409,'Registro duplicado.');return new HttpError(400,error?.message||'Dados invalidos.');}
module.exports={pathMatch,requireActor,queryBool,dateRange,body,asHttpError};
