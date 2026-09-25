'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {dialog}=require('electron');
const MAX_IMPORT_BYTES=10*1024*1024;
function trustedSender(event){
  const senderUrl=String(event?.senderFrame?.url||'');
  try{const parsed=new URL(senderUrl);return parsed.protocol==='file:';}catch{return false;}
}
function registerImportBridge({ipcMain,app}={}){
  if(!ipcMain||!app)throw new TypeError('ipcMain and app are required.');
  ipcMain.handle('erp:select-import-file',async event=>{
    if(!trustedSender(event))throw new Error('Untrusted sender.');
    const result=await dialog.showOpenDialog({title:'Selecionar arquivo OFX',properties:['openFile'],filters:[{name:'Open Financial Exchange',extensions:['ofx']}]});
    if(result.canceled||!result.filePaths?.[0])return null;
    const filePath=path.resolve(result.filePaths[0]);
    if(path.extname(filePath).toLowerCase()!=='.ofx')throw new Error('Only .ofx files are accepted.');
    const stat=fs.statSync(filePath);
    if(!stat.isFile()||stat.size>MAX_IMPORT_BYTES)throw new Error('Import exceeds max allowed size.');
    const text=fs.readFileSync(filePath,'utf8').replace(/^\uFEFF/,'');
    return{name:path.basename(filePath),size:stat.size,encoding:'utf-8',text};
  });
}
module.exports={MAX_IMPORT_BYTES,trustedSender,registerImportBridge};
