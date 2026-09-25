'use strict';
const fs=require('node:fs');
const path=require('node:path');
function createSystemHealth({db,dbPath,now=()=>new Date().toISOString()}={}){
  if(!db)throw new TypeError('db is required.');
  function snapshot(){let ok=true,integrity='unknown';try{integrity=String(db.prepare('PRAGMA quick_check').get()?.quick_check||'ok');ok=integrity==='ok';}catch(error){ok=false;integrity=error.message;}let size=null;try{if(dbPath&&dbPath!==':memory:'&&fs.existsSync(dbPath))size=fs.statSync(dbPath).size;}catch{}return{product:'artisys-erp',checkedAt:now(),database:{ok,integrity,path:dbPath&&dbPath!==':memory:'?path.basename(dbPath):':memory:',sizeBytes:size},runtime:{node:process.version,platform:process.platform,arch:process.arch}};}
  return{snapshot};
}
module.exports={createSystemHealth};
