'use strict';
const { test } = require('node:test');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { launchErpElectron } = require('./fixtures/erp-electron');

const PAGES = [
  ['dashboard','01-dashboard'],
  ['cadastros','02-cadastros'],
  ['estoque','03-estoque'],
  ['compras','04-compras'],
  ['vendas','05-vendas'],
  ['operacao','06-frente-de-caixa'],
  ['servicos','07-servicos'],
  ['financeiro','08-financeiro'],
  ['relatorios','09-relatorios'],
  ['producao','10-producao'],
  ['rastreabilidade','11-rastreabilidade'],
  ['inteligencia','12-inteligencia'],
  ['gestao-avancada','13-gestao-avancada'],
  ['administracao','14-administracao'],
  ['configuracoes','15-configuracoes']
];

test('captura evidencias visuais reais de todas as paginas principais', { timeout: 240000 }, async () => {
  const outDir = resolve(__dirname, '..', 'screenshots');
  mkdirSync(outDir, { recursive: true });
  const erp = await launchErpElectron();
  const { page } = erp;
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByTestId('login-username').waitFor({ state: 'visible' });
    await page.screenshot({ path: resolve(outDir, '00-login.png') });
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('admin123');
    await page.getByTestId('login-submit').click();
    await page.getByTestId('nav-dashboard').waitFor({ state: 'attached' });

    for (const [view, filename] of PAGES) {
      const nav = page.getByTestId(`nav-${view}`);
      await nav.evaluate(el => el.click());
      await page.waitForTimeout(700);
      await page.locator('.topbar h2').waitFor({ state: 'visible' });
      await page.screenshot({ path: resolve(outDir, `${filename}.png`), animations: 'disabled' });
    }
  } finally {
    await erp.close();
  }
});
