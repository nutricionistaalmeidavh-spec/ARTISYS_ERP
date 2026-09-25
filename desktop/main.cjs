'use strict';
const path=require('node:path');
const {app,BrowserWindow,ipcMain}=require('electron');
const {createErpRuntime}=require('../js/core/erp-runtime');
const {createLocalServer}=require('../server/local-server');
const {registerImportBridge}=require('./import-bridge.cjs');
const {registerDocumentBridge}=require('./document-bridge.cjs');
let runtime=null;let localServer=null;let baseUrl=null;let mainWindow=null;
async function boot(){
  const dbPath=path.join(app.getPath('userData'),'data','artisys-erp.sqlite');
  runtime=createErpRuntime({dbPath});
  localServer=createLocalServer({runtime,host:'127.0.0.1',port:0});
  const address=await localServer.start();
  baseUrl=`http://127.0.0.1:${address.port}`;
  ipcMain.handle('erp:base-url',()=>baseUrl);
  registerImportBridge({ipcMain,app});
  registerDocumentBridge({ipcMain,app});
  mainWindow=new BrowserWindow({width:1440,height:900,minWidth:1100,minHeight:700,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  await mainWindow.loadFile(path.join(__dirname,'renderer','index.html'));
}
app.whenReady().then(boot).catch(error=>{console.error(error);app.exit(1);});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',event=>{if(!localServer)return;event.preventDefault();const server=localServer;localServer=null;Promise.resolve(server.stop()).catch(()=>{}).finally(()=>{try{runtime?.close();}catch{}runtime=null;app.exit(0);});});
