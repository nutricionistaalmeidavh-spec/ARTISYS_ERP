'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {sanitize}=require('./system-logger');
function createDiagnosticPackage({health,logger,now=()=>new Date().toISOString()}={}){
  if(!health||!logger)throw new TypeError('health and logger are required.');
  function build(extra={}){return sanitize({product:'artisys-erp',generatedAt:now(),health:health.snapshot(),recentLogs:logger.recent(),extra});}
  function write(filePath,extra={}){const resolved=path.resolve(filePath);fs.mkdirSync(path.dirname(resolved),{recursive:true});fs.writeFileSync(resolved,JSON.stringify(build(extra),null,2),'utf8');return resolved;}
  return{build,write};
}
module.exports={createDiagnosticPackage};
