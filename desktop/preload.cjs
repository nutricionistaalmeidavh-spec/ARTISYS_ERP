'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('erpDesktop',Object.freeze({
  getBaseUrl:()=>ipcRenderer.invoke('erp:base-url'),
  selectImportFile:()=>ipcRenderer.invoke('erp:select-import-file')
}));
