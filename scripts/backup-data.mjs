import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import tar from 'tar';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const defaultDataDir = process.env.PaperForge_DATA_DIR
  ? path.resolve(process.env.PaperForge_DATA_DIR)
  : path.join(repoRoot, 'data');

const [, , command = 'create', ...args] = process.argv;

function getArg(name, fallback = '') {
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  if (value) return value.slice(prefix.length);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
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

async function collectStats(dataDir) {
  const stats = {
    projects: 0,
    files: 0,
    bytes: 0
  };
  if (!await exists(dataDir)) return stats;

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (await exists(path.join(absolute, 'project.json'))) stats.projects += 1;
        await walk(absolute);
      } else {
        const info = await fs.stat(absolute);
        stats.files += 1;
        stats.bytes += info.size;
      }
    }
  }

  await walk(dataDir);
  return stats;
}

async function writeManifest(dataDir) {
  const stats = await collectStats(dataDir);
  const manifest = {
    version: 1,
    source: 'PaperForge backup',
    createdAt: new Date().toISOString(),
    dataDir,
    stats
  };
  const manifestPath = path.join(dataDir, '.PaperForge-backup-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return { manifest, manifestPath };
}

async function removeManifest(manifestPath) {
  await fs.rm(manifestPath, { force: true });
}

async function createBackup() {
  const dataDir = path.resolve(getArg('--data-dir', defaultDataDir));
  const outArg = getArg('--out', '');
  const outDir = path.resolve(getArg('--out-dir', path.join(repoRoot, 'backups')));
  const output = outArg
    ? path.resolve(outArg)
    : path.join(outDir, `PaperForge-data-${timestamp()}.tgz`);

  if (!await exists(dataDir)) {
    throw new Error(`Data directory does not exist: ${dataDir}`);
  }

  await ensureDir(path.dirname(output));
  const { manifest, manifestPath } = await writeManifest(dataDir);
  try {
    await tar.c({
      gzip: true,
      file: output,
      cwd: dataDir,
      portable: true,
      filter: (entryPath) => {
        const normalized = entryPath.replace(/\\/g, '/');
        if (!normalized || normalized === '.') return true;
        if (normalized.includes('/.compile/') || normalized.endsWith('/.compile')) return false;
        return true;
      }
    }, ['.']);
  } finally {
    await removeManifest(manifestPath);
  }

  console.log(`Backup created: ${path.relative(repoRoot, output)}`);
  console.log(`Projects: ${manifest.stats.projects}, files: ${manifest.stats.files}, bytes: ${manifest.stats.bytes}`);
}

async function listBackup() {
  const input = path.resolve(getArg('--file', getArg('--in', '')));
  if (!input) throw new Error('Missing backup file. Use --file <backup.tgz>.');
  const entries = [];
  await tar.t({
    file: input,
    onentry: (entry) => entries.push(entry.path)
  });
  console.log(`Backup: ${input}`);
  console.log(`Entries: ${entries.length}`);
  const manifestName = './.PaperForge-backup-manifest.json';
  if (entries.includes(manifestName) || entries.includes('.PaperForge-backup-manifest.json')) {
    console.log('Manifest: present');
  }
  for (const item of entries.slice(0, 40)) console.log(`- ${item}`);
  if (entries.length > 40) console.log(`... ${entries.length - 40} more`);
}

async function restoreBackup() {
  const input = path.resolve(getArg('--file', getArg('--in', '')));
  const dataDir = path.resolve(getArg('--data-dir', defaultDataDir));
  const replace = hasFlag('--replace');
  if (!input) throw new Error('Missing backup file. Use --file <backup.tgz>.');
  if (!await exists(input)) throw new Error(`Backup file does not exist: ${input}`);

  if (await exists(dataDir)) {
    const entries = await fs.readdir(dataDir);
    if (entries.length > 0 && !replace) {
      throw new Error(`Target data directory is not empty: ${dataDir}. Use --replace to overwrite it.`);
    }
    if (replace) await fs.rm(dataDir, { recursive: true, force: true });
  }
  await ensureDir(dataDir);
  await tar.x({
    file: input,
    cwd: dataDir,
    filter: (entryPath) => {
      const normalized = entryPath.replace(/\\/g, '/');
      return !normalized.split('/').some((part) => part === '..');
    }
  });
  await fs.rm(path.join(dataDir, '.PaperForge-backup-manifest.json'), { force: true });
  const stats = await collectStats(dataDir);
  console.log(`Backup restored to: ${dataDir}`);
  console.log(`Projects: ${stats.projects}, files: ${stats.files}, bytes: ${stats.bytes}`);
}

async function main() {
  if (command === 'create') {
    await createBackup();
    return;
  }
  if (command === 'list') {
    await listBackup();
    return;
  }
  if (command === 'restore') {
    await restoreBackup();
    return;
  }
  throw new Error(`Unknown command: ${command}. Use create, list, or restore.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
