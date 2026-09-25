'use strict';
const fs = require('node:fs');
const path = require('node:path');

const forbidden = [
  ['prompt()', /(?:\bwindow\s*\.\s*prompt\s*\(|(?<![\w$.])prompt\s*\()/g],
  ['alert()', /(?:\bwindow\s*\.\s*alert\s*\(|(?<![\w$.])alert\s*\()/g],
  ['confirm()', /(?:\bwindow\s*\.\s*confirm\s*\(|(?<![\w$.])confirm\s*\()/g],
  ['require()', /\brequire\s*\(/g],
  ['process.*', /\bprocess\s*\./g],
  ['__dirname', /\b__dirname\b/g],
  ['__filename', /\b__filename\b/g]
];

function checkSource(source, file = '<source>') {
  const violations = [];
  for (const [name, pattern] of forbidden) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      const line = source.slice(0, match.index).split('\n').length;
      violations.push({ file, line, rule: name });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
  return violations;
}

function listJsFiles(root) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function scanDirectory(root) {
  const violations = [];
  for (const file of listJsFiles(root)) {
    violations.push(...checkSource(fs.readFileSync(file, 'utf8'), path.relative(process.cwd(), file)));
  }
  return violations;
}

function main() {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'desktop', 'renderer'));
  const violations = scanDirectory(root);
  if (violations.length) {
    for (const item of violations) console.error(`${item.file}:${item.line} forbidden renderer API: ${item.rule}`);
    process.exitCode = 1;
    return;
  }
  console.log('Electron renderer compatibility: OK');
}

if (require.main === module) main();
module.exports = { checkSource, scanDirectory };
