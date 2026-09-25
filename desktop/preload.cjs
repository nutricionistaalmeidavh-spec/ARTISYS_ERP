'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('erpDesktop',Object.freeze({
  getBaseUrl:()=>ipcRenderer.invoke('erp:base-url'),
  selectImportFile:()=>ipcRenderer.invoke('erp:select-import-file'),
  saveExportFile:input=>ipcRenderer.invoke('erp:save-export-file',input),
  savePdf:input=>ipcRenderer.invoke('erp:save-pdf',input),
  printHtml:input=>ipcRenderer.invoke('erp:print-html',input)
}));
