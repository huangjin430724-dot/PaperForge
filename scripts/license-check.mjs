import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const lockPath = path.join(root, 'package-lock.json');
const errors = [];
const warnings = [];
const licenseCounts = new Map();

const BLOCKED_PATTERNS = [
  /\bAGPL\b/i,
  /\bGPL\b/i,
  /\bLGPL\b/i,
  /\bSSPL\b/i,
  /\bBUSL\b/i,
  /\bCommons-Clause\b/i
];

const ALLOWED_PATTERNS = [
  /\b0BSD\b/i,
  /\bApache-2\.0\b/i,
  /\bBSD-2-Clause\b/i,
  /\bBSD-3-Clause\b/i,
  /\bBlueOak-1\.0\.0\b/i,
  /\bCC-BY-4\.0\b/i,
  /\bISC\b/i,
  /\bMIT\b/i,
  /\bMIT\/X11\b/i,
  /\bPython-2\.0\b/i,
  /\bUnlicense\b/i,
  /\bZlib\b/i
];

function readJson(target) {
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    errors.push(`Cannot parse ${path.relative(root, target)}: ${error.message}`);
    return null;
  }
}

function packageName(packagePath) {
  return packagePath.replace(/^node_modules\//, '').replace(/\/node_modules\//g, ' > ');
}

function isAllowed(license) {
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(license));
}

function isBlocked(license) {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(license));
}

const lock = readJson(lockPath);
if (!lock?.packages) {
  errors.push('package-lock.json does not contain a packages map.');
} else {
  for (const [packagePath, meta] of Object.entries(lock.packages)) {
    if (!packagePath.includes('node_modules/')) continue;
    if (meta.link) continue;
    const license = String(meta.license || '').trim();
    if (!license) {
      warnings.push(`${packageName(packagePath)} has no license field in package-lock.json`);
      licenseCounts.set('MISSING', (licenseCounts.get('MISSING') || 0) + 1);
      continue;
    }
    licenseCounts.set(license, (licenseCounts.get(license) || 0) + 1);
    if (isBlocked(license)) {
      errors.push(`${packageName(packagePath)} uses blocked license: ${license}`);
    } else if (!isAllowed(license)) {
      warnings.push(`${packageName(packagePath)} uses unclassified license: ${license}`);
    }
  }
}

console.log('PaperForge License Check');
console.log('========================');
for (const [license, count] of [...licenseCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`OK   ${license}: ${count}`);
}
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`FAIL ${error}`);

if (errors.length) {
  console.error('');
  console.error(`License check failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log('');
console.log(`License check passed with ${warnings.length} warning(s).`);
