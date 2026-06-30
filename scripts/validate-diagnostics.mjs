import { spawnSync } from 'node:child_process';
import process from 'node:process';

function runDiagnostics() {
  const result = spawnSync('node', ['scripts/diagnostics.mjs', '--stdout'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    windowsHide: true
  });
  if (result.status !== 0) {
    throw new Error(`diagnostics failed:\n${result.stdout}\n${result.stderr}`.trim());
  }
  return JSON.parse(result.stdout);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const payload = runDiagnostics();

assert(payload.schemaVersion === 1, 'schemaVersion must be 1');
assert(payload.source === 'PaperForge diagnostics script', 'unexpected diagnostics source');
assert(payload.package?.name === 'PaperForge', 'package name missing');
assert(typeof payload.generatedAt === 'string', 'generatedAt missing');
assert(payload.runtime?.node?.startsWith('v'), 'runtime.node missing');
assert(typeof payload.runtime?.npm === 'string', 'runtime.npm missing');
assert(payload.readiness?.status, 'readiness status missing');
assert(Array.isArray(payload.readiness?.checks), 'readiness checks missing');
assert(payload.readiness?.dataDir && !Object.hasOwn(payload.readiness.dataDir, 'path'), 'dataDir.path must not be exported');
assert(payload.environment && Object.hasOwn(payload.environment, 'PaperForge_LLM_API_KEY'), 'environment key presence missing');
assert(typeof payload.environment.PaperForge_LLM_API_KEY === 'boolean', 'API key presence must be boolean only');

const serialized = JSON.stringify(payload);
assert(!serialized.includes('sk-'), 'diagnostics must not contain OpenAI-style API keys');
assert(!serialized.includes('deepseek-'), 'diagnostics must not contain DeepSeek-style token values');

console.log('Diagnostics validation passed.');
