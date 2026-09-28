'use strict';
const test=require('node:test');
const {mkdirSync}=require('node:fs');
const {resolve}=require('node:path');
const{launchErpElectron}=require('./fixtures/erp-electron');

async function login(page){
  await page.getByTestId('login-username').fill('admin');
  await page.getByTestId('login-password').fill('admin123');
  await page.getByTestId('login-submit').click();
  await page.getByTestId('view-dashboard').waitFor();
}

async function openView(page,view){
  const button=page.locator(`button[data-view="${view}"]`);
  if(!(await button.isVisible())){
    const group=['administracao','configuracoes'].includes(view)?'sistema':['producao','rastreabilidade','inteligencia','gestao-avancada'].includes(view)?'controle':null;
    if(group){
      const toggle=page.locator(`[data-nav-group="${group}"] .nav-group-toggle`);
      if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
    }
  }
  await button.click();
  await page.locator(`button[data-view="${view}"].active`).waitFor();
  await page.waitForTimeout(350);
}

test('captures five current ERP screens from Electron QA',async()=>{
  const erp=await launchErpElectron();
  const outputDir=resolve(__dirname,'..','screenshots-current');
  mkdirSync(outputDir,{recursive:true});
  try{
    const page=erp.page;
    await page.setViewportSize({width:1440,height:900});
    await login(page);
    await page.waitForTimeout(500);
    await page.screenshot({path:resolve(outputDir,'01-dashboard.png'),fullPage:false});

    await openView(page,'operacao');
    await page.screenshot({path:resolve(outputDir,'02-frente-de-caixa.png'),fullPage:false});

    await openView(page,'estoque');
    await page.screenshot({path:resolve(outputDir,'03-estoque.png'),fullPage:false});

    await openView(page,'financeiro');
    await page.screenshot({path:resolve(outputDir,'04-financeiro.png'),fullPage:false});

    await openView(page,'gestao-avancada');
    await page.screenshot({path:resolve(outputDir,'05-gestao-avancada.png'),fullPage:false});
  }finally{
    await erp.close();
  }
});
