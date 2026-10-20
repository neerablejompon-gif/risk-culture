#!/usr/bin/env node
/* รัน unit tests (src/server/Tests.gs) + integration tests (tests/integration.js) ใน Node vm */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SERVER = ['Config', 'Status', 'Workflow', 'Validation', 'Seed', 'Auth', 'Audit', 'Dashboard', 'ReportService', 'Evidence', 'Export', 'Tests'];
const ctx = vm.createContext({ console, atob, btoa });
ctx.globalThis = ctx;
const load = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

SERVER.forEach((f) => load(`src/server/${f}.gs`));
['dev/fixture.js', 'dev/shim.js', 'tests/integration.js'].forEach(load);

const unit = vm.runInContext('runTests()', ctx);
const integ = vm.runInContext('runIntegrationTests()', ctx);
const failed = unit.failed + integ.failed;
console.log(failed ? `\n✗ ${failed} test(s) failed` : `\n✓ all ${unit.passed + integ.passed} tests passed`);
process.exit(failed ? 1 : 0);
