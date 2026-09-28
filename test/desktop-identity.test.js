'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');

test('desktop has standalone ArtiSys ERP identity and approved navigation',()=>{
  const html=read('desktop/renderer/index.html');
  assert.match(html,/ArtiSys ERP/);
  for(const section of ['Dashboard','Cadastros','Estoque','Compras','Vendas','Financeiro','Relatórios','Configurações']) assert.match(html,new RegExp(section));
  for(const forbidden of ['Terminal PDV','Balcão','Comanda','Restaurante','Abrir caixa']) assert.doesNotMatch(html,new RegExp(forbidden,'i'));
});

test('desktop shell keeps ERP services loopback-only and exposes no PDV hardware bridge',()=>{
  const main=read('desktop/main.cjs');
  const preload=read('desktop/preload.cjs');
  assert.match(main,/127\.0\.0\.1/);
  assert.match(main,/createErpRuntime/);
  assert.match(main,/createLocalServer/);
  assert.match(main,/createFiscalSidecarRuntime/);
  assert.doesNotMatch(main,/https?:\/\/(?!127\.0\.0\.1|localhost)/i);
  for(const forbidden of ['serialport','cash-drawer','hardware-bridge','receipt-actions','restaurant','pizzeria','self-service','artisys:hardware']) assert.doesNotMatch(preload,new RegExp(forbidden,'i'));
  assert.match(preload,/getFiscalCertificateStatus/);
  assert.match(preload,/erp:fiscal-certificate-status/);
  assert.match(preload,/erp:fiscal-certificate-import/);
});

test('import bridge constrains local OFX input',()=>{
  const bridge=read('desktop/import-bridge.cjs');
  assert.match(bridge,/\.ofx/i);
  assert.match(bridge,/utf-?8/i);
  assert.match(bridge,/max/i);
  assert.match(bridge,/sender/i);
});

test('desktop loads reusable modal form and toast primitives before app',()=>{
  const html=read('desktop/renderer/index.html');
  assert.match(html,/id="modal-root"/);
  assert.match(html,/id="toast-root"/);
  const ui=html.indexOf('src="ui.js"'),forms=html.indexOf('src="forms.js"'),app=html.indexOf('src="app.js"');
  assert.ok(ui>=0&&forms>=0&&ui<app&&forms<app);
  assert.match(read('desktop/renderer/ui.js'),/window\.ErpUi/);
  assert.match(read('desktop/renderer/forms.js'),/window\.ErpForms/);
});
