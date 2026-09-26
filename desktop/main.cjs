'use strict';
const path=require('node:path');
const {app,BrowserWindow,ipcMain,shell,safeStorage,dialog}=require('electron');
const {createErpRuntime}=require('../js/core/erp-runtime');
const {createLocalServer}=require('../server/local-server');
const {registerImportBridge}=require('./import-bridge.cjs');
const {registerDocumentBridge}=require('./document-bridge.cjs');
const {registerAttachmentBridge}=require('./attachment-bridge.cjs');
const {createUpdateService}=require('./update-service.cjs');
const {createFiscalSidecarRuntime}=require('./fiscal-sidecar-runtime.cjs');
const {resolveFiscalRuntimePaths}=require('./fiscal-runtime-paths.cjs');
const {createFiscalCredentialStore}=require('./fiscal-credential-store.cjs');
const {registerFiscalCredentialIpc}=require('./fiscal-credential-bridge.cjs');
const {createBundledAcbrMonitorRuntime}=require('./acbr-monitor-runtime.cjs');
let runtime=null;let localServer=null;let baseUrl=null;let mainWindow=null;let updater=null;let fiscalSidecar=null;let fiscalCredentialStore=null;let acbrMonitor=null;
async function configureAcbrFromCurrentSettings(){if(!acbrMonitor||!runtime)return;const settings=runtime.fiscal?.settings?.();if(settings?.provider==='acbr-local'&&settings?.address?.state&&settings?.environment)await acbrMonitor.configureFiscal({state:settings.address.state,environment:settings.environment});}
async function applyStoredFiscalCredentials(){if(!acbrMonitor||!fiscalCredentialStore)return;const status=fiscalCredentialStore.publicStatus();if(!status.configured)return;if(status.expired)throw new Error('Certificado A1 salvo esta vencido. Importe um certificado valido para emitir documentos fiscais.');await acbrMonitor.configureCredentials(fiscalCredentialStore.assertUsable());}
async function boot(){
  const dbPath=process.env.ERP_DB_PATH?path.resolve(process.env.ERP_DB_PATH):path.join(app.getPath('userData'),'data','artisys-erp.sqlite');
  fiscalCredentialStore=createFiscalCredentialStore({app,safeStorage});
  const fiscalRuntimeConfig={focusToken:process.env.ARTISYS_FOCUS_TOKEN||null,assertLocalCredentials:()=>fiscalCredentialStore.assertUsable()};
  const acbrHost='127.0.0.1',acbrPort=Number(process.env.ARTISYS_ACBR_PORT||3434);
  try{
    const fiscalPaths=resolveFiscalRuntimePaths({isPackaged:app.isPackaged,resourcesPath:process.resourcesPath});
    acbrMonitor=createBundledAcbrMonitorRuntime({bundleRoot:fiscalPaths.acbrRoot,writableRoot:path.join(app.getPath('userData'),'fiscal','acbr'),host:acbrHost,port:acbrPort});
    await acbrMonitor.start();
    try{await applyStoredFiscalCredentials();}catch(error){console.error('[acbr-monitor] Credenciais fiscais salvas nao puderam ser aplicadas:',error?.message||error);}
    const sidecarEnv={...process.env,ARTISYS_ACBR_HOST:acbrHost,ARTISYS_ACBR_PORT:String(acbrPort)};
    fiscalSidecar=createFiscalSidecarRuntime({entryPath:fiscalPaths.sidecarEntry,env:sidecarEnv,onError:error=>console.error('[fiscal-sidecar]',error?.message||error)});
    const fiscalConnection=await fiscalSidecar.start();
    fiscalRuntimeConfig.sidecarBaseUrl=fiscalConnection.baseUrl;fiscalRuntimeConfig.sidecarAuthToken=fiscalSidecar.getAuthToken();
  }catch(error){console.error('[fiscal-runtime] Runtime ACBr local indisponivel:',error?.message||error);try{await fiscalSidecar?.stop();}catch{}try{await acbrMonitor?.stop();}catch{}fiscalSidecar=null;acbrMonitor=null;}
  runtime=createErpRuntime({dbPath,fiscalRuntimeConfig});
  try{await configureAcbrFromCurrentSettings();}catch(error){console.error('[acbr-monitor] Configuracao fiscal inicial nao aplicada:',error?.message||error);}
  if(process.env.ERP_E2E==='1'&&runtime.auth.countUsers()===0){runtime.auth.createUser({username:process.env.ERP_E2E_USERNAME||'admin',name:'E2E Admin',role:'admin',password:process.env.ERP_E2E_PASSWORD||'admin123'});}
  localServer=createLocalServer({runtime,host:'127.0.0.1',port:0});
  const address=await localServer.start();baseUrl=`http://127.0.0.1:${address.port}`;
  ipcMain.handle('erp:base-url',()=>baseUrl);
  updater=createUpdateService({app,shell});ipcMain.handle('erp:update-status',()=>updater.status());ipcMain.handle('erp:update-check',()=>updater.check());ipcMain.handle('erp:update-download',()=>updater.download());ipcMain.handle('erp:update-install',()=>updater.install());setTimeout(()=>updater.check().catch(()=>{}),5000);
  registerImportBridge({ipcMain,app});registerDocumentBridge({ipcMain,app});registerAttachmentBridge({ipcMain,app});registerFiscalCredentialIpc({ipcMain,dialog,credentialStore:fiscalCredentialStore,getParentWindow:()=>mainWindow,onCredentialsSaved:async secret=>{if(!acbrMonitor)throw new Error('Runtime ACBr local indisponivel no computador.');await acbrMonitor.configureCredentials(secret);await configureAcbrFromCurrentSettings();},onCredentialsRemoved:async()=>{if(!acbrMonitor)return;try{await acbrMonitor.stop();await acbrMonitor.start();await configureAcbrFromCurrentSettings();}catch(error){console.error('[acbr-monitor] Falha ao reiniciar apos remover certificado:',error?.message||error);}}});
  mainWindow=new BrowserWindow({width:1440,height:900,minWidth:1100,minHeight:700,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  mainWindow.once('ready-to-show',()=>mainWindow.show());const rendererPath=path.join(__dirname,'..','frontend','dist','index.html');await mainWindow.loadFile(rendererPath);
}
app.whenReady().then(boot).catch(error=>{console.error(error);app.exit(1);});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',event=>{if(!localServer&&!fiscalSidecar&&!acbrMonitor)return;event.preventDefault();const server=localServer,sidecar=fiscalSidecar,monitor=acbrMonitor;localServer=null;fiscalSidecar=null;acbrMonitor=null;Promise.allSettled([server?.stop(),sidecar?.stop(),monitor?.stop()]).finally(()=>{try{runtime?.close();}catch{}runtime=null;app.exit(0);});});
