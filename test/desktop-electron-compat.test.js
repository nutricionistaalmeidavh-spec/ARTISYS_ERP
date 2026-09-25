'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('Electron renderer compatibility checker rejects web dialogs and Node globals', () => {
  const { checkSource } = require('../scripts/check-electron-renderer-compat');
  for (const source of [
    "prompt('x')",
    "window.prompt('x')",
    "alert('x')",
    "window.alert('x')",
    "confirm('x')",
    "window.confirm('x')",
    "require('fs')",
    "process.cwd()",
    "console.log(__dirname)",
    "console.log(__filename)"
  ]) {
    assert.notEqual(checkSource(source, 'fixture.js').length, 0, source);
  }
});

test('Electron renderer compatibility checker accepts normal DOM code', () => {
  const { checkSource } = require('../scripts/check-electron-renderer-compat');
  const source = "document.querySelector('#save').addEventListener('click', () => console.log('ok'));";
  assert.deepEqual(checkSource(source, 'fixture.js'), []);
});
