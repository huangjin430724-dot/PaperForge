import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('seed demo project includes editable Figure Agent assets', () => {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paperforge-demo-seed-'));
  const env = { ...process.env, PaperForge_DATA_DIR: tempDataDir };

  execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'seed-demo-project.mjs')], {
    cwd: repoRoot,
    env,
    stdio: 'pipe'
  });

  const projectRoot = path.join(tempDataDir, 'demo-paperforge-showcase');
  const figureRoot = path.join(projectRoot, 'figures');
  const assetPath = 'figures/demo_paperforge_research_workflow.svg';
  const mermaidPath = 'figures/demo_paperforge_research_workflow.mmd';
  const tikzPath = 'figures/demo_paperforge_research_workflow.tikz.tex';
  const latexPath = 'figures/demo_paperforge_research_workflow.figure.tex';
  const packagePath = 'figures/demo_paperforge_research_workflow.figure.json';
  const reportPath = path.join(figureRoot, 'figure_report.md');

  for (const relativePath of [assetPath, mermaidPath, tikzPath, latexPath, packagePath, 'figures/index.json']) {
    assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), true, `${relativePath} should exist`);
  }

  const registry = readJson(path.join(projectRoot, 'figures', 'index.json'));
  assert.equal(registry.figures[0].assetPath, assetPath);
  assert.equal(registry.figures[0].mermaidPath, mermaidPath);
  assert.equal(registry.figures[0].tikzPath, tikzPath);
  assert.equal(registry.figures[0].latexPath, latexPath);

  const figurePackage = readJson(path.join(projectRoot, packagePath));
  assert.equal(figurePackage.editable.mermaidPath, mermaidPath);
  assert.equal(figurePackage.editable.tikzPath, tikzPath);
  assert.equal(figurePackage.editable.latexPath, latexPath);
  assert.match(figurePackage.editable.mermaid, /^flowchart LR/m);
  assert.match(figurePackage.editable.tikz, /\\begin\{tikzpicture\}/);
  assert.match(figurePackage.editable.latexSnippet, /\\includegraphics/);

  const report = fs.readFileSync(reportPath, 'utf8');
  assert.match(report, /Mermaid/);
  assert.match(report, /TikZ/);
  assert.match(report, /LaTeX Snippet/);
  assert.match(report, new RegExp(mermaidPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  execFileSync(process.execPath, [
    path.join(repoRoot, 'scripts', 'check-figure-assets.mjs'),
    tempDataDir,
    '--require'
  ], {
    cwd: repoRoot,
    stdio: 'pipe'
  });
});
