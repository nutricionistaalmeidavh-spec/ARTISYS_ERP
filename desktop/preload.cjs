'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('erpDesktop',Object.freeze({
  getBaseUrl:()=>ipcRenderer.invoke('erp:base-url'),
  getUpdateStatus:()=>ipcRenderer.invoke('erp:update-status'),
  checkForUpdates:()=>ipcRenderer.invoke('erp:update-check'),
  downloadUpdate:()=>ipcRenderer.invoke('erp:update-download'),
  installUpdate:()=>ipcRenderer.invoke('erp:update-install'),
  selectImportFile:()=>ipcRenderer.invoke('erp:select-import-file'),
  selectAttachment:()=>ipcRenderer.invoke('erp:select-attachment'),
  saveExportFile:input=>ipcRenderer.invoke('erp:save-export-file',input),
  savePdf:input=>ipcRenderer.invoke('erp:save-pdf',input),
  printHtml:input=>ipcRenderer.invoke('erp:print-html',input),
  getFiscalCertificateStatus:()=>ipcRenderer.invoke('erp:fiscal-certificate-status'),
  importFiscalCertificate:input=>ipcRenderer.invoke('erp:fiscal-certificate-import',input),
  removeFiscalCertificate:()=>ipcRenderer.invoke('erp:fiscal-certificate-remove')
}));
