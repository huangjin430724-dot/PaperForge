import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const args = process.argv.slice(2);
const targetArg = args.find((arg) => !arg.startsWith('--'));
const requireRegistry = args.includes('--require');
const baseDir = targetArg ? path.resolve(root, targetArg) : path.join(root, 'data');
const failures = [];
const warnings = [];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    failures.push(`${filePath}: invalid JSON (${error.message})`);
    return null;
  }
}

function exists(projectDir, relativePath) {
  return fs.existsSync(path.join(projectDir, relativePath));
}

function collectProjectDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  if (fs.existsSync(path.join(dir, 'project.json'))) return [dir];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name))
    .filter((candidate) => fs.existsSync(path.join(candidate, 'project.json')));
}

function validateFigurePackage(projectDir, item) {
  const pkgPath = path.join(projectDir, item.packagePath || '');
  const pkg = readJson(pkgPath);
  if (!pkg) return;
  if (pkg.assetPath !== item.assetPath) {
    failures.push(`${pkgPath}: assetPath does not match registry (${pkg.assetPath} !== ${item.assetPath})`);
  }
  if (!pkg.latex?.caption && !pkg.spec?.caption) {
    warnings.push(`${pkgPath}: missing caption`);
  }
  if (!pkg.latex?.label && !pkg.spec?.label) {
    warnings.push(`${pkgPath}: missing label`);
  }
  if (!Array.isArray(pkg.spec?.nodes) || pkg.spec.nodes.length < 2) {
    failures.push(`${pkgPath}: spec.nodes must contain at least 2 nodes`);
  }
  if (!Array.isArray(pkg.spec?.edges)) {
    failures.push(`${pkgPath}: spec.edges must be an array`);
  }
}

function validateQa(projectDir, item) {
  if (!item.qaPath) return;
  const qaPath = path.join(projectDir, item.qaPath);
  const qa = readJson(qaPath);
  if (!qa) return;
  if (qa.assetPath !== item.assetPath) {
    failures.push(`${qaPath}: assetPath does not match registry (${qa.assetPath} !== ${item.assetPath})`);
  }
  if (!Number.isFinite(Number(qa.overall_score))) {
    failures.push(`${qaPath}: overall_score must be numeric`);
  }
  if (!qa.verdict) {
    warnings.push(`${qaPath}: missing verdict`);
  }
  if (Number.isFinite(Number(item.qaScore)) && Number(qa.overall_score) !== Number(item.qaScore)) {
    warnings.push(`${qaPath}: QA score differs from registry (${qa.overall_score} !== ${item.qaScore})`);
  }
}

function validateProject(projectDir) {
  const registryPath = path.join(projectDir, 'figures', 'index.json');
  if (!fs.existsSync(registryPath)) {
    if (requireRegistry) failures.push(`${projectDir}: missing figures/index.json`);
    return { checked: false, count: 0 };
  }

  const registry = readJson(registryPath);
  if (!registry) return { checked: true, count: 0 };
  if (!Array.isArray(registry.figures)) {
    failures.push(`${registryPath}: figures must be an array`);
    return { checked: true, count: 0 };
  }

  const seen = new Set();
  for (const item of registry.figures) {
    if (!item.assetPath) failures.push(`${registryPath}: figure item missing assetPath`);
    if (!item.packagePath) failures.push(`${registryPath}: figure item missing packagePath`);
    if (item.assetPath && seen.has(item.assetPath)) {
      failures.push(`${registryPath}: duplicate assetPath ${item.assetPath}`);
    }
    seen.add(item.assetPath);

    if (item.assetPath && !exists(projectDir, item.assetPath)) {
      failures.push(`${registryPath}: missing SVG ${item.assetPath}`);
    }
    if (item.packagePath && !exists(projectDir, item.packagePath)) {
      failures.push(`${registryPath}: missing package ${item.packagePath}`);
    }
    if (item.qaPath && !exists(projectDir, item.qaPath)) {
      failures.push(`${registryPath}: missing QA report ${item.qaPath}`);
    }
    if (item.assetPath && !item.assetPath.startsWith('figures/')) {
      warnings.push(`${registryPath}: assetPath should live under figures/ (${item.assetPath})`);
    }

    if (item.packagePath && exists(projectDir, item.packagePath)) validateFigurePackage(projectDir, item);
    if (item.qaPath && exists(projectDir, item.qaPath)) validateQa(projectDir, item);
  }

  const reportPath = path.join(projectDir, 'figures', 'figure_report.md');
  if (fs.existsSync(reportPath)) {
    const report = fs.readFileSync(reportPath, 'utf8');
    for (const item of registry.figures) {
      if (item.assetPath && !report.includes(item.assetPath)) {
        warnings.push(`${reportPath}: report does not mention ${item.assetPath}`);
      }
    }
  }

  return { checked: true, count: registry.figures.length };
}

const projectDirs = collectProjectDirs(baseDir);
let checkedProjects = 0;
let figureCount = 0;
for (const projectDir of projectDirs) {
  const result = validateProject(projectDir);
  if (result.checked) checkedProjects += 1;
  figureCount += result.count;
}

console.log(`Figure asset check: ${checkedProjects} project(s), ${figureCount} figure(s).`);
for (const warning of warnings) console.warn(`WARN ${warning}`);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('Figure asset check passed.');
