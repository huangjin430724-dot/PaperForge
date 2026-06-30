import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectHealthReport } from '../apps/backend/src/services/healthService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

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

function run(command, commandArgs = []) {
  const useCmd = process.platform === 'win32' && command === 'npm';
  const executable = useCmd ? (process.env.ComSpec || 'cmd.exe') : command;
  const finalArgs = useCmd ? ['/d', '/s', '/c', [command, ...commandArgs].join(' ')] : commandArgs;
  const result = spawnSync(executable, finalArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
}

async function readPackageInfo() {
  try {
    const raw = await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw.replace(/^\uFEFF/, ''));
    return {
      name: pkg.name || 'PaperForge',
      version: pkg.version || '0.0.0',
      private: Boolean(pkg.private)
    };
  } catch (error) {
    return {
      name: 'PaperForge',
      version: 'unknown',
      packageReadError: String(error?.code || error?.message || error)
    };
  }
}

function collectGitInfo() {
  const branch = run('git', ['branch', '--show-current']);
  const commit = run('git', ['rev-parse', '--short', 'HEAD']);
  const status = run('git', ['status', '--porcelain']);
  return {
    available: branch.ok && commit.ok && status.ok,
    branch: branch.ok ? branch.stdout : '',
    commit: commit.ok ? commit.stdout : '',
    dirty: status.ok ? status.stdout.length > 0 : null
  };
}

function collectRuntimeInfo() {
  const npm = run('npm', ['--version']);
  return {
    node: process.version,
    npm: npm.ok ? npm.stdout : 'unavailable',
    platform: process.platform,
    arch: process.arch,
    cwdName: path.basename(repoRoot)
  };
}

function collectEnvPresence() {
  const keys = [
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
  return Object.fromEntries(keys.map((key) => [key, Boolean(process.env[key])]));
}

function makeFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `paperforge-diagnostics-${stamp}.json`;
}

async function main() {
  const outDir = path.resolve(repoRoot, getArg('--out-dir', path.join('.tmp', 'diagnostics')));
  const stdoutOnly = hasFlag('--stdout');
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'PaperForge diagnostics script',
    package: await readPackageInfo(),
    repository: collectGitInfo(),
    runtime: collectRuntimeInfo(),
    environment: collectEnvPresence(),
    readiness: await collectHealthReport()
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  if (stdoutOnly) {
    process.stdout.write(json);
    return;
  }

  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, makeFilename());
  await fs.writeFile(outFile, json, 'utf8');
  console.log(`Diagnostics written: ${path.relative(repoRoot, outFile)}`);
}

main().catch((error) => {
  console.error(`Diagnostics failed: ${error?.stack || error}`);
  process.exit(1);
});
