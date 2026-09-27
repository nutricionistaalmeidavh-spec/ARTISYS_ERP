'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {launchErpElectron}=require('./fixtures/erp-electron');

test('advanced ERP depth entry preserves navigation and exposes the six workspaces',async()=>{
 const erp=await launchErpElectron();
 try{
  await erp.page.getByTestId('login-username').fill('admin');
  await erp.page.getByTestId('login-password').fill('admin123');
  await erp.page.getByTestId('login-submit').click();
  await erp.page.getByTestId('nav-gestao-avancada').click();
  await erp.page.getByTestId('view-depth').waitFor({state:'visible'});
  const ids=['accounting','projects','crm','shop-floor','stock-logistics','assets'];
  const legacy=['Accounting Core','Projects 2.0','CRM','Manufacturing Shop Floor','Stock Logistics','Asset Accounting'];
  for(let i=0;i<ids.length;i++){
   await erp.page.getByTestId(`advanced-nav-${ids[i]}`).waitFor({state:'visible'});
   await erp.page.getByText(legacy[i],{exact:true}).waitFor({state:'visible'});
   await erp.page.getByTestId(`advanced-nav-${ids[i]}`).click();
   await erp.page.getByTestId(`workspace-${ids[i]}`).waitFor({state:'visible'});
  }
  assert.equal(await erp.page.getByTestId('view-depth').isVisible(),true);
 }finally{await erp.close();}
});
