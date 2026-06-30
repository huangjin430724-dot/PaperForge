import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const errors = [];
const warnings = [];
const info = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    errors.push(`${relativePath}: cannot parse JSON (${error.message})`);
    return null;
  }
}

function run(command, args = []) {
  const useCmd = process.platform === 'win32' && command === 'npm';
  const executable = useCmd ? (process.env.ComSpec || 'cmd.exe') : command;
  const finalArgs = useCmd ? ['/d', '/s', '/c', [command, ...args].join(' ')] : args;
  const result = spawnSync(executable, finalArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    status: result.status
  };
}

function parseMajor(versionText) {
  const match = String(versionText || '').match(/v?(\d+)\./);
  return match ? Number(match[1]) : 0;
}

function checkNode() {
  const node = run('node', ['--version']);
  if (!node.ok) {
    errors.push('Node.js is not available.');
    return;
  }
  const major = parseMajor(node.stdout);
  info.push(`Node.js ${node.stdout}`);
  if (major < 18) errors.push(`Node.js >= 18 is required, found ${node.stdout}.`);

  const npm = run('npm', ['--version']);
  if (!npm.ok) {
    errors.push('npm is not available.');
  } else {
    info.push(`npm ${npm.stdout}`);
  }
}

function checkFiles() {
  const required = [
    'package.json',
    'package-lock.json',
    'apps/backend/src/index.js',
    'apps/frontend/package.json',
    'templates/manifest.json',
    '.env.example',
    'Dockerfile',
    'docker-compose.yml',
    'docs/ARCHITECTURE.md',
    'docs/FIGURE_AGENT.md',
    'scripts/check-doc-links.mjs',
    'scripts/env-check.mjs',
    'scripts/diagnostics.mjs',
    'scripts/validate-diagnostics.mjs',
    'scripts/check-figure-assets.mjs'
  ];
  for (const file of required) {
    if (!exists(file)) errors.push(`Missing required file: ${file}`);
  }
  if (!exists('.env')) warnings.push('No .env file found. Copy .env.example to .env for deployment-specific configuration.');
  if (!exists('LICENSE')) errors.push('Missing LICENSE file.');
  if (!exists('SECURITY.md')) warnings.push('Missing SECURITY.md.');
  if (!exists('SUPPORT.md')) warnings.push('Missing SUPPORT.md.');
}

function checkPackageScripts() {
  const pkg = readJson('package.json');
  if (!pkg) return;
  const scripts = pkg.scripts || {};
  const requiredScripts = ['dev', 'start', 'build', 'typecheck', 'lint', 'test', 'doctor', 'env:check', 'diagnostics', 'diagnostics:check', 'docs:check', 'check:figures', 'check'];
  for (const script of requiredScripts) {
    if (!scripts[script]) errors.push(`package.json missing script: ${script}`);
  }
}

function checkEnvExample() {
  if (!exists('.env.example')) return;
  const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const requiredKeys = [
    'PORT',
    'PaperForge_DATA_DIR',
    'PaperForge_LLM_ENDPOINT',
    'PaperForge_LLM_API_KEY',
    'PaperForge_LLM_MODEL',
    'PaperForge_LLM_THINKING_MODE',
    'PaperForge_MINERU_TOKEN',
    'PaperForge_COLLAB_TOKEN_SECRET',
    'PaperForge_TUNNEL',
    'PaperForge_PYTHON'
  ];
  for (const key of requiredKeys) {
    if (!env.includes(`${key}=`)) warnings.push(`.env.example missing ${key}`);
  }
}

function checkDocker() {
  const docker = run('docker', ['--version']);
  if (!docker.ok) {
    warnings.push('Docker is not available. Docker deployment checks skipped.');
    return;
  }
  info.push(docker.stdout);
  const compose = run('docker', ['compose', 'config']);
  if (!compose.ok) {
    warnings.push(`docker compose config failed: ${compose.stderr || compose.stdout}`);
  } else {
    info.push('docker compose config OK');
  }
}

function checkLatex() {
  const engines = ['pdflatex', 'xelatex', 'lualatex', 'tectonic'];
  const available = engines.filter((engine) => run(engine, ['--version']).ok);
  if (available.length) {
    info.push(`LaTeX engine(s): ${available.join(', ')}`);
  } else {
    warnings.push('No LaTeX engine found in PATH. PDF compilation requires TexLive or Tectonic.');
  }
}

function checkFigureAssets() {
  const result = run('npm', ['run', 'check:figures']);
  if (!result.ok) {
    errors.push(`npm run check:figures failed:\n${result.stdout}\n${result.stderr}`.trim());
  } else {
    info.push('Figure asset check OK');
  }
}

checkNode();
checkFiles();
checkPackageScripts();
checkEnvExample();
checkDocker();
checkLatex();
checkFigureAssets();

console.log('PaperForge Doctor');
console.log('=================');
for (const line of info) console.log(`OK   ${line}`);
for (const line of warnings) console.warn(`WARN ${line}`);
for (const line of errors) console.error(`FAIL ${line}`);

if (errors.length) {
  console.error('');
  console.error(`Doctor failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log('');
console.log(`Doctor passed with ${warnings.length} warning(s).`);
