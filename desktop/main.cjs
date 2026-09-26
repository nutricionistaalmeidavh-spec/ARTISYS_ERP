'use strict';
const path=require('node:path');
const {app,BrowserWindow,ipcMain,shell}=require('electron');
const {createErpRuntime}=require('../js/core/erp-runtime');
const {createLocalServer}=require('../server/local-server');
const {registerImportBridge}=require('./import-bridge.cjs');
const {registerDocumentBridge}=require('./document-bridge.cjs');
const {registerAttachmentBridge}=require('./attachment-bridge.cjs');
const {createUpdateService}=require('./update-service.cjs');
const {createFiscalSidecarRuntime}=require('./fiscal-sidecar-runtime.cjs');
const {resolveFiscalRuntimePaths}=require('./fiscal-runtime-paths.cjs');
let runtime=null;let localServer=null;let baseUrl=null;let mainWindow=null;let updater=null;let fiscalSidecar=null;
async function boot(){
  const dbPath=process.env.ERP_DB_PATH?path.resolve(process.env.ERP_DB_PATH):path.join(app.getPath('userData'),'data','artisys-erp.sqlite');
  let fiscalRuntimeConfig=null;
  try{
    const fiscalPaths=resolveFiscalRuntimePaths({isPackaged:app.isPackaged,resourcesPath:process.resourcesPath});
    fiscalSidecar=createFiscalSidecarRuntime({entryPath:fiscalPaths.sidecarEntry,env:process.env,onError:error=>console.error('[fiscal-sidecar]',error?.message||error)});
    const fiscalConnection=await fiscalSidecar.start();
    fiscalRuntimeConfig={sidecarBaseUrl:fiscalConnection.baseUrl,sidecarAuthToken:fiscalSidecar.getAuthToken(),focusToken:process.env.ARTISYS_FOCUS_TOKEN||null};
  }catch(error){console.error('[fiscal-sidecar] Runtime local indisponivel:',error?.message||error);try{await fiscalSidecar?.stop();}catch{}fiscalSidecar=null;}
  runtime=createErpRuntime({dbPath,fiscalRuntimeConfig});
  if(process.env.ERP_E2E==='1'&&runtime.auth.countUsers()===0){runtime.auth.createUser({username:process.env.ERP_E2E_USERNAME||'admin',name:'E2E Admin',role:'admin',password:process.env.ERP_E2E_PASSWORD||'admin123'});}
  localServer=createLocalServer({runtime,host:'127.0.0.1',port:0});
  const address=await localServer.start();
  baseUrl=`http://127.0.0.1:${address.port}`;
  ipcMain.handle('erp:base-url',()=>baseUrl);
  updater=createUpdateService({app,shell});ipcMain.handle('erp:update-status',()=>updater.status());ipcMain.handle('erp:update-check',()=>updater.check());ipcMain.handle('erp:update-download',()=>updater.download());ipcMain.handle('erp:update-install',()=>updater.install());setTimeout(()=>updater.check().catch(()=>{}),5000);
  registerImportBridge({ipcMain,app});
  registerDocumentBridge({ipcMain,app});
  registerAttachmentBridge({ipcMain,app});
  mainWindow=new BrowserWindow({width:1440,height:900,minWidth:1100,minHeight:700,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  const rendererPath=path.join(__dirname,'..','frontend','dist','index.html');
  await mainWindow.loadFile(rendererPath);
}
app.whenReady().then(boot).catch(error=>{console.error(error);app.exit(1);});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',event=>{if(!localServer&&!fiscalSidecar)return;event.preventDefault();const server=localServer,sidecar=fiscalSidecar;localServer=null;fiscalSidecar=null;Promise.allSettled([server?.stop(),sidecar?.stop()]).finally(()=>{try{runtime?.close();}catch{}runtime=null;app.exit(0);});});
