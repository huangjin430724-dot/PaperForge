import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import tar from 'tar';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const defaultOutDir = path.join(repoRoot, 'releases');
const [, , command = 'create', ...args] = process.argv;

const REQUIRED_FILES = [
  'package.json',
  'package-lock.json',
  'README.md',
  'README_ZH.md',
  'CHANGELOG.md',
  'LICENSE',
  '.env.example',
  'Dockerfile',
  'docker-compose.yml',
  'docs/ARCHITECTURE.md',
  'docs/FIGURE_AGENT.md',
  'docs/DEMO_PROJECT.md',
  'docs/DATA_BACKUP.md',
  'docs/OPERATIONS.md',
  'docs/RELEASE.md',
  'scripts/doctor.mjs',
  'scripts/diagnostics.mjs',
  'scripts/validate-diagnostics.mjs',
  'scripts/check-figure-assets.mjs',
  'scripts/seed-demo-project.mjs',
  'scripts/backup-data.mjs',
  'scripts/release-bundle.mjs'
];

const BLOCKED_PREFIXES = [
  '.git/',
  '.tmp/',
  'backups/',
  'data/',
  'node_modules/',
  'releases/',
  'reports/',
  'outputs/',
  'test-results/',
  'playwright-report/',
  'apps/frontend/dist/',
  'apps/frontend/.vite/'
];

const BLOCKED_FILES = new Set(['.env', '.env.local']);

function getArg(name, fallback = '') {
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  if (value) return value.slice(prefix.length);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return fallback;
}

function run(commandName, commandArgs = []) {
  const result = spawnSync(commandName, commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true
  });
  if (result.status !== 0) {
    throw new Error(`${commandName} ${commandArgs.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout || '';
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function sha256(target) {
  const hash = crypto.createHash('sha256');
  const stream = fssync.createReadStream(target);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isAllowedTrackedFile(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized || BLOCKED_FILES.has(normalized)) return false;
  if (BLOCKED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (normalized.includes('/.compile/')) return false;
  return true;
}

function getTrackedFiles() {
  const raw = run('git', ['ls-files', '-z']);
  return raw
    .split('\0')
    .map(normalizePath)
    .filter(Boolean)
    .filter(isAllowedTrackedFile)
    .sort((a, b) => a.localeCompare(b));
}

async function copyFileToStaging(filePath, stagingRoot) {
  const source = path.join(repoRoot, filePath);
  const target = path.join(stagingRoot, filePath);
  await ensureDir(path.dirname(target));
  await fs.copyFile(source, target);
}

async function buildManifest(files, stagingRoot, packageName, archiveName) {
  const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  const entries = [];
  for (const filePath of files) {
    const target = path.join(stagingRoot, filePath);
    const info = await fs.stat(target);
    entries.push({
      path: filePath,
      bytes: info.size,
      sha256: await sha256(target)
    });
  }

  return {
    version: 1,
    name: pkg.name || 'PaperForge',
    packageVersion: pkg.version || '0.0.0',
    archiveName,
    packageRoot: packageName,
    generatedAt: new Date().toISOString(),
    source: 'PaperForge release bundle',
    files: entries
  };
}

async function createBundle() {
  const outDir = path.resolve(getArg('--out-dir', defaultOutDir));
  const version = getArg('--version', '');
  const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  const packageVersion = version || pkg.version || '0.0.0';
  const packageName = `PaperForge-${packageVersion}`;
  const archiveName = `${packageName}.tgz`;
  const archivePath = path.join(outDir, archiveName);
  const stagingBase = path.join(repoRoot, '.tmp', 'release-staging');
  const stagingRoot = path.join(stagingBase, packageName);

  const files = getTrackedFiles();
  const missing = REQUIRED_FILES.filter((filePath) => !files.includes(filePath));
  if (missing.length) {
    throw new Error(`Release bundle missing required tracked files: ${missing.join(', ')}`);
  }

  await fs.rm(stagingBase, { recursive: true, force: true });
  await ensureDir(stagingRoot);
  for (const filePath of files) await copyFileToStaging(filePath, stagingRoot);

  const manifest = await buildManifest(files, stagingRoot, packageName, archiveName);
  await fs.writeFile(path.join(stagingRoot, 'RELEASE_MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');

  await ensureDir(outDir);
  await tar.c({
    gzip: true,
    file: archivePath,
    cwd: stagingBase,
    portable: true
  }, [packageName]);

  const archiveHash = await sha256(archivePath);
  const summary = {
    archive: path.relative(repoRoot, archivePath),
    sha256: archiveHash,
    files: manifest.files.length,
    bytes: (await fs.stat(archivePath)).size
  };
  await fs.writeFile(`${archivePath}.sha256`, `${archiveHash}  ${archiveName}\n`, 'utf8');
  console.log(`Release bundle created: ${summary.archive}`);
  console.log(`Files: ${summary.files}, bytes: ${summary.bytes}`);
  console.log(`SHA256: ${summary.sha256}`);
}

async function verifyBundle() {
  const archiveArg = getArg('--file', getArg('--in', ''));
  if (!archiveArg) throw new Error('Missing release bundle. Use --file <archive.tgz>.');
  const archivePath = path.resolve(archiveArg);
  if (!await exists(archivePath)) throw new Error(`Release bundle not found: ${archivePath}`);

  const verifyRoot = path.join(repoRoot, '.tmp', 'release-verify');
  await fs.rm(verifyRoot, { recursive: true, force: true });
  await ensureDir(verifyRoot);
  await tar.x({ file: archivePath, cwd: verifyRoot });

  const roots = (await fs.readdir(verifyRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  if (roots.length !== 1) throw new Error(`Expected exactly one package root, found ${roots.length}.`);
  const packageRoot = path.join(verifyRoot, roots[0].name);
  const manifestPath = path.join(packageRoot, 'RELEASE_MANIFEST.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

  const missingRequired = REQUIRED_FILES.filter((filePath) => !fssync.existsSync(path.join(packageRoot, filePath)));
  if (missingRequired.length) throw new Error(`Release bundle missing required files: ${missingRequired.join(', ')}`);

  for (const entry of manifest.files || []) {
    const target = path.join(packageRoot, normalizePath(entry.path));
    if (!fssync.existsSync(target)) throw new Error(`Manifest entry missing from archive: ${entry.path}`);
    const actual = await sha256(target);
    if (actual !== entry.sha256) throw new Error(`Checksum mismatch for ${entry.path}`);
  }

  const blocked = [];
  async function walk(current, rel = '') {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextRel = normalizePath(path.join(rel, entry.name));
      if (entry.isDirectory()) {
        if (!isAllowedTrackedFile(`${nextRel}/`) && nextRel !== '') blocked.push(nextRel);
        await walk(path.join(current, entry.name), nextRel);
      } else if (!isAllowedTrackedFile(nextRel) && nextRel !== 'RELEASE_MANIFEST.json') {
        blocked.push(nextRel);
      }
    }
  }
  await walk(packageRoot);
  if (blocked.length) throw new Error(`Release bundle contains blocked paths: ${blocked.slice(0, 10).join(', ')}`);

  console.log(`Release bundle verified: ${path.relative(repoRoot, archivePath)}`);
  console.log(`Files: ${manifest.files.length}`);
}

async function main() {
  if (command === 'create') {
    await createBundle();
    return;
  }
  if (command === 'verify') {
    await verifyBundle();
    return;
  }
  throw new Error(`Unknown command: ${command}. Use create or verify.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
