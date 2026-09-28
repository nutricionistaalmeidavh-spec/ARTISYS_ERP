'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {MAX_PFX_BYTES}=require('./fiscal-credential-store.cjs');
function registerFiscalCredentialIpc({ipcMain,dialog,credentialStore,getParentWindow=()=>null,onCredentialsSaved=null,onCredentialsRemoved=null}={}){
 if(!ipcMain||!dialog||!credentialStore)throw new TypeError('Dependencias do bridge fiscal ausentes.');
 ipcMain.handle('erp:fiscal-certificate-status',()=>credentialStore.publicStatus());
 ipcMain.handle('erp:fiscal-certificate-remove',async()=>{const status=credentialStore.remove();if(typeof onCredentialsRemoved==='function')await onCredentialsRemoved(status);return status;});
 ipcMain.handle('erp:fiscal-certificate-import',async(_event,input={})=>{const selection=await dialog.showOpenDialog(getParentWindow?.()||undefined,{title:'Selecionar certificado A1',properties:['openFile'],filters:[{name:'Certificado A1',extensions:['pfx','p12']}]});if(selection.canceled||!selection.filePaths?.[0])return{cancelled:true};const selected=selection.filePaths[0],stat=fs.statSync(selected);if(!stat.isFile()||stat.size<=0||stat.size>MAX_PFX_BYTES)throw new Error('Certificado A1 excede o limite de 4 MiB ou e invalido.');const pfx=fs.readFileSync(selected);const status=credentialStore.save({pfxBase64:pfx.toString('base64'),password:String(input.pfxPhrase??''),csc:String(input.cscValue??''),cscId:String(input.cscId??''),certificateName:path.basename(selected)});if(typeof onCredentialsSaved==='function')await onCredentialsSaved(credentialStore.assertUsable());return status;});
}
module.exports={registerFiscalCredentialIpc};
