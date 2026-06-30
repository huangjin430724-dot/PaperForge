import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const warnings = [];
const results = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return '';
  }
}

function readJson(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch {
    return null;
  }
}

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  failures.push(`${name}: ${detail}`);
}

function warn(name, detail) {
  warnings.push(`${name}: ${detail}`);
}

function requireFiles(name, files) {
  const missing = files.filter((file) => !exists(file));
  if (missing.length) fail(name, `missing ${missing.join(', ')}`);
  else pass(name, `${files.length} file(s)`);
}

function requireScripts(name, scripts) {
  const pkg = readJson('package.json');
  if (!pkg) {
    fail(name, 'package.json is missing or invalid');
    return;
  }
  const missing = scripts.filter((script) => !pkg.scripts?.[script]);
  if (missing.length) fail(name, `missing npm script(s): ${missing.join(', ')}`);
  else pass(name, `${scripts.length} script(s)`);
}

function requireText(name, file, patterns) {
  const content = read(file);
  if (!content) {
    fail(name, `${file} is missing or empty`);
    return;
  }
  const missing = patterns.filter((pattern) => !pattern.test(content));
  if (missing.length) fail(name, `${file} does not mention required topic(s)`);
  else pass(name, file);
}

function checkWorkflow() {
  const workflow = read('.github/workflows/ci.yml');
  if (!workflow) {
    fail('GitHub Actions CI', 'missing .github/workflows/ci.yml');
    return;
  }
  const required = [
    'npm run lint',
    'npm run test',
    'npm run typecheck',
    'npm run check:figures',
    'npm run docs:check',
    'npm run deps:check',
    'npm run licenses:check',
    'npm run env:check',
    'npm run security:scan',
    'npm run diagnostics:check',
    'npm run demo:check',
    'npm run status:report',
    'npm run release:bundle',
    'npm run release:verify',
    'npm run release:notes',
    'npm run build',
    'npm run e2e'
  ];
  const missing = required.filter((line) => !workflow.includes(line));
  if (missing.length) fail('GitHub Actions CI', `missing step(s): ${missing.join(', ')}`);
  else pass('GitHub Actions CI', `${required.length} checked command(s)`);
}

function checkReadmeBadges() {
  const readme = read('README.md');
  const required = ['CI', 'License', 'Security', 'Support'];
  const missing = required.filter((label) => !readme.includes(`[![${label}`));
  if (missing.length) fail('README badges', `missing ${missing.join(', ')}`);
  else pass('README badges', `${required.length} badge(s)`);
}

requireFiles('Community health files', [
  'LICENSE',
  'SECURITY.md',
  'SUPPORT.md',
  'CONTRIBUTING.md',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/ISSUE_TEMPLATE/figure_agent.yml',
  '.github/dependabot.yml'
]);

requireFiles('Core documentation', [
  'README.md',
  'README_ZH.md',
  'CHANGELOG.md',
  'ROADMAP.md',
  'docs/ARCHITECTURE.md',
  'docs/FIGURE_AGENT.md',
  'docs/DEMO_PROJECT.md',
  'docs/DATA_BACKUP.md',
  'docs/OPERATIONS.md',
  'docs/RELEASE.md'
]);

requireFiles('Deployment and operations assets', [
  '.env.example',
  'Dockerfile',
  'docker-compose.yml',
  '.dockerignore'
]);

requireScripts('Quality gate scripts', [
  'check',
  'typecheck',
  'lint',
  'test',
  'e2e',
  'check:figures',
  'docs:check',
  'deps:check',
  'licenses:check',
  'env:check',
  'diagnostics',
  'diagnostics:check',
  'security:scan',
  'demo:check',
  'status:report',
  'release:notes',
  'doctor'
]);

requireScripts('Release and data lifecycle scripts', [
  'release:bundle',
  'release:verify',
  'release:notes',
  'demo:check',
  'seed:demo',
  'backup:data',
  'restore:data'
]);

requireText('README feature coverage', 'README.md', [
  /Figure Agent/i,
  /Docker/i,
  /diagnostics/i,
  /backup/i,
  /release/i
]);

requireText('Operations documentation coverage', 'docs/OPERATIONS.md', [
  /health/i,
  /diagnostics/i,
  /env:check/i,
  /docs:check/i
]);

checkWorkflow();
checkReadmeBadges();

if (!exists('package-lock.json')) warn('Dependency lockfile', 'package-lock.json is missing');
if (!exists('docs/RELEASE.md')) warn('Release process', 'docs/RELEASE.md is missing');

const passed = results.filter((result) => result.ok).length;
const total = results.length;
const score = Math.round((passed / total) * 100);

console.log('PaperForge Maturity Check');
console.log('=========================');
for (const result of results) {
  console.log(`${result.ok ? 'OK  ' : 'FAIL'} ${result.name}${result.detail ? ` - ${result.detail}` : ''}`);
}
for (const item of warnings) console.warn(`WARN ${item}`);
console.log('');
console.log(`Maturity score: ${score}/100 (${passed}/${total} checks passed)`);

if (failures.length) {
  console.error('');
  for (const item of failures) console.error(`FAIL ${item}`);
  process.exit(1);
}
