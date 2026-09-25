'use strict';
const {HttpError,readBody}=require('./http-utils');
const {resolveActor}=require('./auth-context');
function pathMatch(pathname,pattern){const p=pattern.split('/').filter(Boolean),a=pathname.split('/').filter(Boolean);if(p.length!==a.length)return null;const out={};for(let i=0;i<p.length;i++){if(p[i].startsWith(':'))out[p[i].slice(1)]=decodeURIComponent(a[i]);else if(p[i]!==a[i])return null;}return out;}
function requireActor(req,sessions,roles=null){const {actor}=resolveActor(req,sessions);if(roles&&!roles.includes(String(actor.role||'')))throw new HttpError(403,'Permissao insuficiente.');return actor;}
function queryBool(url,key){return url.searchParams.get(key)==='true';}
function pagination(url){const requested=url.searchParams.has('page')||url.searchParams.has('pageSize');const rawPage=Number.parseInt(url.searchParams.get('page')||'1',10),rawSize=Number.parseInt(url.searchParams.get('pageSize')||'50',10);return{requested,page:Number.isInteger(rawPage)&&rawPage>0?rawPage:1,pageSize:Math.min(200,Number.isInteger(rawSize)&&rawSize>0?rawSize:50)};}
function paginate(items,{requested,page,pageSize}){if(!requested)return items;const total=items.length,start=(page-1)*pageSize;return{items:items.slice(start,start+pageSize),page,pageSize,total};}
function dateRange(url){const today=new Date().toISOString().slice(0,10);return{from:url.searchParams.get('from')||`${today.slice(0,7)}-01`,to:url.searchParams.get('to')||today};}
async function body(req,limit){return readBody(req,limit);}
function asHttpError(error){if(error instanceof HttpError)return error;if(/UNIQUE constraint failed/i.test(String(error?.message||'')))return new HttpError(409,'Registro duplicado.');return new HttpError(400,error?.message||'Dados invalidos.');}
module.exports={pathMatch,requireActor,queryBool,pagination,paginate,dateRange,body,asHttpError};
