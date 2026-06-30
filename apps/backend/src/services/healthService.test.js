import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectHealthReport } from './healthService.js';

test('collectHealthReport returns readiness checks without exposing absolute data path', async () => {
  const report = await collectHealthReport();

  assert.equal(typeof report.ok, 'boolean');
  assert.match(report.status, /^(ok|degraded)$/);
  assert.equal(typeof report.uptimeSeconds, 'number');
  assert.equal(typeof report.dataDir.projectCount, 'number');
  assert.equal(typeof report.templates.templateCount, 'number');
  assert.ok(Array.isArray(report.checks));
  assert.ok(report.checks.some((check) => check.name === 'data-dir-writable'));
  assert.equal(Object.hasOwn(report.dataDir, 'path'), false);
});
