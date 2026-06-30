import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DATA_DIR, TEMPLATE_MANIFEST } from '../config/constants.js';

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function summarizeError(error) {
  return String(error?.code || error?.name || 'error');
}

async function checkDataDir() {
  const result = {
    exists: false,
    writable: false,
    projectCount: 0
  };
  const checks = [];

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    result.exists = true;
    const marker = path.join(DATA_DIR, `.healthcheck-${process.pid}-${Date.now()}`);
    await fs.writeFile(marker, 'ok', 'utf8');
    await fs.rm(marker, { force: true });
    result.writable = true;
    checks.push({ name: 'data-dir-writable', status: 'ok' });
  } catch (error) {
    checks.push({ name: 'data-dir-writable', status: 'fail', message: summarizeError(error) });
    return { result, checks };
  }

  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    let projectCount = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (await exists(path.join(DATA_DIR, entry.name, 'project.json'))) projectCount += 1;
    }
    result.projectCount = projectCount;
    checks.push({ name: 'project-index-readable', status: 'ok' });
  } catch (error) {
    checks.push({ name: 'project-index-readable', status: 'fail', message: summarizeError(error) });
  }

  return { result, checks };
}

async function checkTemplates() {
  const result = {
    manifest: false,
    templateCount: 0,
    categoryCount: 0
  };
  const checks = [];

  try {
    const raw = await fs.readFile(TEMPLATE_MANIFEST, 'utf8');
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
    result.manifest = true;
    result.templateCount = Array.isArray(parsed.templates) ? parsed.templates.length : 0;
    result.categoryCount = Array.isArray(parsed.categories) ? parsed.categories.length : 0;
    checks.push({ name: 'template-manifest-readable', status: 'ok' });
  } catch (error) {
    checks.push({ name: 'template-manifest-readable', status: 'fail', message: summarizeError(error) });
  }

  return { result, checks };
}

export async function collectHealthReport() {
  const data = await checkDataDir();
  const templates = await checkTemplates();
  const checks = [...data.checks, ...templates.checks];
  const ok = checks.every((check) => check.status === 'ok');

  return {
    ok,
    status: ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
    dataDir: data.result,
    templates: templates.result,
    checks
  };
}
