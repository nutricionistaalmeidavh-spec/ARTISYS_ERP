'use strict';
const { _electron } = require('playwright');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

async function launchErpElectron() {
  const dir = mkdtempSync(join(tmpdir(), 'artisys-erp-e2e-'));
  const dbPath = join(dir, 'artisys-erp.sqlite');
  let app;
  try {
    app = await _electron.launch({
      args: [resolve(__dirname, '..', '..', '..')],
      env: {
        ...process.env,
        ERP_DB_PATH: dbPath,
        ERP_E2E: '1',
        ERP_E2E_USERNAME: 'admin',
        ERP_E2E_PASSWORD: 'admin123'
      }
    });
    const page = await app.firstWindow();
    return {
      app,
      page,
      dbPath,
      dir,
      async close() {
        try { await app.close(); } finally { rmSync(dir, { recursive: true, force: true }); }
      }
    };
  } catch (error) {
    try { if (app) await app.close(); } catch {}
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { launchErpElectron };
