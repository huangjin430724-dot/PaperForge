import fs from 'node:fs/promises';
import fssync from 'node:fs';
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

function relative(target) {
  return path.relative(repoRoot, target) || '.';
}

function assertSafeTmp(target) {
  const tmpRoot = path.resolve(repoRoot, '.tmp');
  const resolved = path.resolve(target);
  const relativePath = path.relative(tmpRoot, resolved);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to modify a path outside .tmp: ${resolved}`);
  }
}

function run(label, command, commandArgs = [], options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    ...options,
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });
  if (result.status !== 0) {
    throw new Error([
      `${label} failed`,
      result.stdout?.trim(),
      result.stderr?.trim()
    ].filter(Boolean).join('\n'));
  }
  console.log(`OK   ${label}`);
  return (result.stdout || '').trim();
}

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, 'utf8'));
}

async function requireFile(target) {
  if (!fssync.existsSync(target)) {
    throw new Error(`Missing expected demo artifact: ${relative(target)}`);
  }
}

async function verifyDemoProject(projectRoot) {
  const figureRoot = path.join(projectRoot, 'figures');
  const expected = [
    'project.json',
    'README_DEMO.md',
    'main.tex',
    'figures/figure_plan.json',
    'figures/demo_paperforge_research_workflow.svg',
    'figures/demo_paperforge_research_workflow.mmd',
    'figures/demo_paperforge_research_workflow.tikz.tex',
    'figures/demo_paperforge_research_workflow.figure.tex',
    'figures/demo_paperforge_research_workflow.figure.json',
    'figures/demo_paperforge_research_workflow.figure.qa.json',
    'figures/index.json',
    'figures/figure_report.md'
  ];
  for (const item of expected) await requireFile(path.join(projectRoot, item));

  const registry = await readJson(path.join(figureRoot, 'index.json'));
  const first = registry.figures?.[0];
  if (!first?.mermaidPath || !first?.tikzPath || !first?.latexPath) {
    throw new Error('Demo registry is missing editable figure asset paths.');
  }

  const report = await fs.readFile(path.join(figureRoot, 'figure_report.md'), 'utf8');
  for (const marker of ['Mermaid', 'TikZ', 'LaTeX Snippet']) {
    if (!report.includes(marker)) {
      throw new Error(`Demo figure report does not mention ${marker}.`);
    }
  }
}

async function main() {
  const workDir = path.resolve(repoRoot, getArg('--work-dir', path.join('.tmp', 'demo-check')));
  assertSafeTmp(workDir);
  const dataDir = path.join(workDir, 'data');
  const restoredDir = path.join(workDir, 'restored');
  const backupFile = path.join(workDir, 'demo-backup.tgz');
  const projectRoot = path.join(dataDir, 'demo-paperforge-showcase');
  const restoredProjectRoot = path.join(restoredDir, 'demo-paperforge-showcase');

  await fs.rm(workDir, { recursive: true, force: true });
  await fs.mkdir(workDir, { recursive: true });

  run('seed demo project', process.execPath, ['scripts/seed-demo-project.mjs'], {
    env: { PaperForge_DATA_DIR: dataDir }
  });
  await verifyDemoProject(projectRoot);
  run('validate seeded Figure Agent assets', process.execPath, [
    'scripts/check-figure-assets.mjs',
    projectRoot,
    '--require'
  ]);

  run('create demo data backup', process.execPath, [
    'scripts/backup-data.mjs',
    'create',
    '--data-dir',
    dataDir,
    '--out',
    backupFile
  ]);
  await requireFile(backupFile);
  run('inspect demo data backup', process.execPath, [
    'scripts/backup-data.mjs',
    'list',
    '--file',
    backupFile
  ]);
  run('restore demo data backup', process.execPath, [
    'scripts/backup-data.mjs',
    'restore',
    '--file',
    backupFile,
    '--data-dir',
    restoredDir,
    '--replace'
  ]);
  await verifyDemoProject(restoredProjectRoot);
  run('validate restored Figure Agent assets', process.execPath, [
    'scripts/check-figure-assets.mjs',
    restoredProjectRoot,
    '--require'
  ]);

  console.log('');
  console.log(`Demo check passed: ${relative(workDir)}`);
}

main().catch((error) => {
  console.error(`Demo check failed: ${error?.stack || error}`);
  process.exit(1);
});
