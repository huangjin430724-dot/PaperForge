import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const errors = [];
const warnings = [];
const info = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/^\uFEFF/, '');
}

function readJson(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch (error) {
    errors.push(`${relativePath}: cannot parse JSON (${error.message})`);
    return null;
  }
}

function listWorkspacePackages(pattern) {
  const [base, wildcard] = pattern.split('/');
  if (wildcard !== '*') return [];
  const baseDir = path.join(root, base);
  if (!fs.existsSync(baseDir)) return [];
  return fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${base}/${entry.name}`)
    .filter((workspacePath) => exists(`${workspacePath}/package.json`));
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

const rootPkg = readJson('package.json');
const lock = readJson('package-lock.json');
const ci = exists('.github/workflows/ci.yml') ? read('.github/workflows/ci.yml') : '';
const readme = exists('README.md') ? read('README.md') : '';

if (rootPkg && lock) {
  assert(rootPkg.private === true, 'root package should remain private for this workspace app');
  assert(rootPkg.type === 'module', 'root package should use type=module');
  assert(Array.isArray(rootPkg.workspaces), 'root package must define workspaces');
  assert(lock.lockfileVersion === 3, 'package-lock.json should use lockfileVersion 3');
  assert(lock.packages?.['']?.name === rootPkg.name, 'package-lock root package name must match package.json');
  assert(lock.packages?.['']?.version === rootPkg.version, 'package-lock root version must match package.json');

  const workspacePaths = rootPkg.workspaces.flatMap(listWorkspacePackages);
  for (const workspacePath of workspacePaths) {
    const pkg = readJson(`${workspacePath}/package.json`);
    assert(Boolean(lock.packages?.[workspacePath]), `package-lock missing workspace package: ${workspacePath}`);
    assert(pkg?.private === true, `${workspacePath}/package.json should be private`);
    assert(pkg?.type === 'module', `${workspacePath}/package.json should use type=module`);
  }
  info.push(`Workspace packages: ${workspacePaths.join(', ') || 'none'}`);

  const requiredScripts = ['dev', 'start', 'build', 'typecheck', 'lint', 'test', 'e2e', 'check'];
  for (const script of requiredScripts) {
    assert(Boolean(rootPkg.scripts?.[script]), `missing root script: ${script}`);
  }
}

if (ci) {
  assert(ci.includes('node-version: 20'), 'CI should pin Node.js 20 for reproducible checks');
  assert(ci.includes('cache: npm'), 'CI should enable npm cache');
  assert(ci.includes('npm ci'), 'CI should install dependencies with npm ci');
} else {
  errors.push('missing GitHub Actions CI workflow');
}

if (readme) {
  assert(/node-%3E%3D18\.0\.0/i.test(readme) || /Node\.js\s*>=\s*18/i.test(readme), 'README should document Node.js >= 18');
} else {
  errors.push('missing README.md');
}

const backendPkg = readJson('apps/backend/package.json');
const frontendPkg = readJson('apps/frontend/package.json');
if (backendPkg && frontendPkg) {
  assert(Boolean(backendPkg.dependencies?.fastify), 'backend package should depend on fastify');
  assert(Boolean(frontendPkg.dependencies?.react), 'frontend package should depend on react');
  assert(Boolean(frontendPkg.devDependencies?.vite), 'frontend package should depend on vite as a dev dependency');
}

if (!exists('package-lock.json')) warnings.push('package-lock.json is missing; npm ci will not be reproducible');

console.log('PaperForge Dependency Check');
console.log('===========================');
for (const line of info) console.log(`OK   ${line}`);
for (const line of warnings) console.warn(`WARN ${line}`);
for (const line of errors) console.error(`FAIL ${line}`);

if (errors.length) {
  console.error('');
  console.error(`Dependency check failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log('');
console.log(`Dependency check passed with ${warnings.length} warning(s).`);
