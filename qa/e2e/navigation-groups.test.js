'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const{launchErpElectron}=require('./fixtures/erp-electron');

async function login(p){await p.getByTestId('login-username').fill('admin');await p.getByTestId('login-password').fill('admin123');await p.getByTestId('login-submit').click();await p.getByTestId('view-dashboard').waitFor({state:'visible'});}

test('advanced and system modules stay collapsed until requested',async()=>{const erp=await launchErpElectron();try{const p=erp.page;await login(p);const specialists=p.locator('[data-nav-group="controle"] .nav-group-toggle'),system=p.locator('[data-nav-group="sistema"] .nav-group-toggle');assert.equal(await specialists.getAttribute('aria-expanded'),'false');assert.equal(await system.getAttribute('aria-expanded'),'false');assert.equal(await p.getByTestId('nav-gestao-avancada').isVisible(),false);assert.equal(await p.getByTestId('nav-configuracoes').isVisible(),false);await specialists.click();assert.equal(await p.getByTestId('nav-gestao-avancada').isVisible(),true);await system.click();assert.equal(await p.getByTestId('nav-configuracoes').isVisible(),true);}finally{await erp.close();}});

test('selected module keeps its progressive navigation group open',async()=>{const erp=await launchErpElectron();try{const p=erp.page;await login(p);const system=p.locator('[data-nav-group="sistema"] .nav-group-toggle');await system.click();await p.getByTestId('nav-configuracoes').click();await p.getByText('Local-first',{exact:true}).waitFor();assert.equal(await system.getAttribute('aria-expanded'),'true');assert.match(await p.getByTestId('nav-configuracoes').getAttribute('class')||'',/active/);await system.click();assert.equal(await system.getAttribute('aria-expanded'),'true','active group must not collapse around the current module');}finally{await erp.close();}});
