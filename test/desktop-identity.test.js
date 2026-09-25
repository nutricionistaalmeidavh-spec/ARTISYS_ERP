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

test('desktop shell starts only a loopback ERP server and exposes no PDV hardware bridge',()=>{
  const main=read('desktop/main.cjs');
  const preload=read('desktop/preload.cjs');
  assert.match(main,/127\.0\.0\.1/);
  assert.match(main,/createErpRuntime/);
  assert.match(main,/createLocalServer/);
  assert.doesNotMatch(main,/https?:\/\/(?!127\.0\.0\.1|localhost)/i);
  for(const forbidden of ['serialport','cash','fiscal','restaurant','pizzeria','self-service']) assert.doesNotMatch(preload,new RegExp(forbidden,'i'));
});

test('import bridge constrains local OFX input',()=>{
  const bridge=read('desktop/import-bridge.cjs');
  assert.match(bridge,/\.ofx/i);
  assert.match(bridge,/utf-?8/i);
  assert.match(bridge,/max/i);
  assert.match(bridge,/sender/i);
});
