'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchErpElectron } = require('./fixtures/erp-electron');

test('Electron user can login and open dashboard without web dialogs', async () => {
  const erp = await launchErpElectron();
  const dialogs = [];
  erp.page.on('dialog', dialog => {
    dialogs.push(dialog.type());
    dialog.dismiss().catch(() => {});
  });
  try {
    await erp.page.getByTestId('login-username').fill('admin');
    await erp.page.getByTestId('login-password').fill('admin123');
    await erp.page.getByTestId('login-submit').click();
    await erp.page.getByTestId('view-dashboard').waitFor({ state: 'visible' });
    assert.deepEqual(dialogs, []);
  } finally {
    await erp.close();
  }
});
