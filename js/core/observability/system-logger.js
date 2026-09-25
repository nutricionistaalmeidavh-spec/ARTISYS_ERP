'use strict';
const fs=require('node:fs');
const path=require('node:path');
const SECRET_KEYS=/password|passphrase|token|authorization|bearer|secret|hash|ofx|raw/i;
function sanitize(value,seen=new WeakSet()){
  if(value==null||typeof value==='number'||typeof value==='boolean')return value;
  if(typeof value==='string')return value.length>4000?`${value.slice(0,4000)}…`:value;
  if(typeof value!=='object')return String(value);
  if(seen.has(value))return'[circular]';seen.add(value);
  if(Array.isArray(value))return value.slice(0,100).map(v=>sanitize(v,seen));
  const out={};for(const [key,val] of Object.entries(value))out[key]=SECRET_KEYS.test(key)?'[redacted]':sanitize(val,seen);return out;
}
function createSystemLogger({filePath,now=()=>new Date().toISOString(),maxRecent=100}={}){
  const recent=[];const resolved=filePath?path.resolve(filePath):null;
  function log(level,event,context={}){const row={ts:now(),level:String(level||'info'),event:String(event||'event'),context:sanitize(context)};recent.push(row);if(recent.length>maxRecent)recent.shift();if(resolved){fs.mkdirSync(path.dirname(resolved),{recursive:true});fs.appendFileSync(resolved,`${JSON.stringify(row)}\n`,'utf8');}return row;}
  return{log,info:(e,c)=>log('info',e,c),warn:(e,c)=>log('warn',e,c),error:(e,c)=>log('error',e,c),recent:()=>recent.map(r=>sanitize(r)),filePath:resolved,sanitize};
}
module.exports={createSystemLogger,sanitize};
