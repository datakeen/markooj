// Run the in-app smoke test and print a short report.
// Usage: node scripts/smoke.js [outDir]   (default: smoke-out)
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'smoke-out'));
fs.mkdirSync(outDir, { recursive: true });
try { fs.unlinkSync(path.join(outDir, 'smoke.json')); } catch {}

const electron = require('electron'); // path to the binary when required from Node
const child = spawn(electron, ['.', '--smoke', outDir], { cwd: root, stdio: 'inherit', windowsHide: true });
child.on('exit', code => {
  let report = null;
  try { report = JSON.parse(fs.readFileSync(path.join(outDir, 'smoke.json'), 'utf8')); } catch {}
  if (!report) { console.error(`No smoke.json was written (exit code ${code}).`); process.exit(code || 1); }
  const all = [];
  const walk = v => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if ('ok' in v && ('name' in v || 'format' in v || 'id' in v)) all.push(v); else Object.values(v).forEach(walk); } };
  walk(report.results);
  for (const r of all) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name || r.format || r.id}${r.ok ? '' : '\n      ' + String(r.error || '').split('\n')[0]}`);
  const errors = (report.console || []).filter(c => /error|3/.test(c.level));
  if (errors.length) console.log(`\n${errors.length} console error(s), first: ${errors[0].message}`);
  console.log(`\n${all.filter(r => r.ok).length}/${all.length} passed. Exit code ${code}. Report: ${path.join(outDir, 'smoke.json')}`);
  process.exit(code);
});
