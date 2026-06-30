import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

async function readJson(relativePath) {
  const raw = await fs.readFile(path.join(repoRoot, relativePath), 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

function parseMaturity(output) {
  const match = output.match(/Maturity score:\s*(\d+\/100)\s*\(([^)]+)\)/);
  return match ? `${match[1]} (${match[2]})` : 'unknown';
}

function parseDocLinks(output) {
  const match = output.match(/Documentation link check:\s*(.+?)\./);
  return match ? match[1] : 'unknown';
}

function section(title, lines) {
  return [`## ${title}`, '', ...lines, ''].join('\n');
}

async function main() {
  const pkg = await readJson('package.json');
  const outDir = path.resolve(repoRoot, getArg('--out-dir', path.join('.tmp', 'status-report')));
  const stdoutOnly = hasFlag('--stdout');
  const branch = run('git', ['branch', '--show-current']);
  const commit = run('git', ['rev-parse', '--short', 'HEAD']);
  const dirty = run('git', ['status', '--porcelain']);
  const maturity = run('npm', ['run', 'maturity:check']);
  const docs = run('npm', ['run', 'docs:check']);
  const deps = run('npm', ['run', 'deps:check']);
  const env = run('npm', ['run', 'env:check']);
  const diagnostics = run('npm', ['run', 'diagnostics:check']);

  const checks = [
    ['Maturity scorecard', maturity.ok, parseMaturity(maturity.stdout)],
    ['Documentation links', docs.ok, parseDocLinks(docs.stdout)],
    ['Dependency metadata', deps.ok, deps.ok ? 'workspace and lockfile consistent' : 'failed'],
    ['Environment template', env.ok, env.ok ? 'template valid' : 'failed'],
    ['Diagnostics schema', diagnostics.ok, diagnostics.ok ? 'schema and redaction valid' : 'failed']
  ];

  const lines = [
    `# ${pkg.name || 'PaperForge'} Project Status`,
    '',
    `Generated: ${new Date().toISOString()}`,
    `Version: ${pkg.version || 'unknown'}`,
    `Git: ${branch.stdout || 'unknown'} @ ${commit.stdout || 'unknown'}`,
    `Working tree: ${dirty.stdout ? 'dirty' : 'clean'}`,
    ''
  ];

  lines.push(section('Quality Snapshot', [
    '| Check | Status | Detail |',
    '|---|---:|---|',
    ...checks.map(([name, ok, detail]) => `| ${name} | ${ok ? 'OK' : 'FAIL'} | ${detail} |`)
  ]));

  lines.push(section('Maintainer Commands', [
    '- `npm run check`',
    '- `npm run doctor`',
    '- `npm run maturity:check`',
    '- `npm run release:bundle`',
    '- `npm run release:notes`'
  ]));

  lines.push(section('Report Notes', [
    '- This report intentionally summarizes local quality signals only.',
    '- It does not include API keys, manuscripts, local data paths, or private project content.',
    '- Use `npm run diagnostics` for support bundles and `npm run release:notes` for GitHub releases.'
  ]));

  const report = `${lines.join('\n').trim()}\n`;
  if (stdoutOnly) {
    process.stdout.write(report);
    return;
  }

  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'PROJECT_STATUS.md');
  await fs.writeFile(outFile, report, 'utf8');
  console.log(`Status report written: ${path.relative(repoRoot, outFile)}`);
}

main().catch((error) => {
  console.error(`Status report failed: ${error?.stack || error}`);
  process.exit(1);
});
