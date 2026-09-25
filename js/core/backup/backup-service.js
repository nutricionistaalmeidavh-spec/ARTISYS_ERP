'use strict';
const fs=require('node:fs');
const path=require('node:path');
function safeName(value){return String(value||'backup').replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'')||'backup';}
function sqlString(value){return `'${String(value).replace(/'/g,"''")}'`;}
function createBackupService({db,dbPath,backupDir,now=()=>new Date().toISOString()}={}){
  if(!db||!dbPath||dbPath===':memory:')throw new TypeError('Persistent db and dbPath are required.');
  const dir=path.resolve(backupDir||path.join(path.dirname(path.resolve(dbPath)),'backups'));
  function createBackup(label='manual'){fs.mkdirSync(dir,{recursive:true});const stamp=now().replace(/[:.]/g,'-');const file=path.join(dir,`${safeName(label)}-${stamp}.sqlite`);if(fs.existsSync(file))fs.rmSync(file,{force:true});db.exec(`VACUUM INTO ${sqlString(file)}`);const stat=fs.statSync(file);return{path:file,size:stat.size,createdAt:now()};}
  function listBackups(){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir).filter(n=>n.endsWith('.sqlite')).map(name=>{const file=path.join(dir,name),s=fs.statSync(file);return{name,path:file,size:s.size,modifiedAt:s.mtime.toISOString()};}).sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));}
  function restoreBackup({backupPath,targetPath}={}){const source=path.resolve(String(backupPath||''));const target=path.resolve(String(targetPath||''));if(!fs.existsSync(source)||!fs.statSync(source).isFile())throw new Error('Backup file not found.');if(path.extname(source).toLowerCase()!=='.sqlite')throw new Error('Invalid backup file.');fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);return target;}
  return{createBackup,listBackups,restoreBackup,backupDir:dir};
}
module.exports={createBackupService};
