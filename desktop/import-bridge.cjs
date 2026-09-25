'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {dialog}=require('electron');
const MAX_IMPORT_BYTES=10*1024*1024;
function trustedSender(event){
  const senderUrl=String(event?.senderFrame?.url||'');
  try{const parsed=new URL(senderUrl);return parsed.protocol==='file:';}catch{return false;}
}
function readOfx(filePath){const resolved=path.resolve(filePath);if(path.extname(resolved).toLowerCase()!=='.ofx')throw new Error('Only .ofx files are accepted.');const stat=fs.statSync(resolved);if(!stat.isFile()||stat.size>MAX_IMPORT_BYTES)throw new Error('Import exceeds max allowed size.');const text=fs.readFileSync(resolved,'utf8').replace(/^\uFEFF/,'');return{name:path.basename(resolved),size:stat.size,encoding:'utf-8',text};}
function registerImportBridge({ipcMain,app}={}){
  if(!ipcMain||!app)throw new TypeError('ipcMain and app are required.');
  ipcMain.handle('erp:select-import-file',async event=>{
    if(!trustedSender(event))throw new Error('Untrusted sender.');
    if(process.env.ERP_E2E==='1'&&process.env.ERP_E2E_IMPORT_FILE)return readOfx(process.env.ERP_E2E_IMPORT_FILE);
    const result=await dialog.showOpenDialog({title:'Selecionar arquivo OFX',properties:['openFile'],filters:[{name:'Open Financial Exchange',extensions:['ofx']}]});
    if(result.canceled||!result.filePaths?.[0])return null;
    return readOfx(result.filePaths[0]);
  });
}
module.exports={MAX_IMPORT_BYTES,trustedSender,registerImportBridge,readOfx};
