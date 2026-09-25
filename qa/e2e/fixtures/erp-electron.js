'use strict';
const { _electron } = require('playwright');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

async function launchErpElectron() {
  const { existsSync } = require('node:fs');
  const { execFileSync } = require('node:child_process');
  const root = resolve(__dirname, '..', '..', '..');
  if (!existsSync(join(root, 'frontend', 'dist', 'index.html'))) execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'frontend:build'], { cwd: root, stdio: 'inherit' });
  const dir = mkdtempSync(join(tmpdir(), 'artisys-erp-e2e-'));
  const dbPath = join(dir, 'artisys-erp.sqlite');
  const ofxFixture = resolve(__dirname, 'sample.ofx');
  let app;
  try {
    app = await _electron.launch({
      args: [root],
      env: {
        ...process.env,
        ERP_DB_PATH: dbPath,
        ERP_E2E: '1',
        ERP_E2E_USERNAME: 'admin',
        ERP_E2E_PASSWORD: 'admin123',
        ERP_E2E_IMPORT_FILE: ofxFixture
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
