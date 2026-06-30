import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const warnings = [];

const BLOCKED_TRACKED_PATHS = [
  /^\.env$/i,
  /^\.env\.(?!example$)/i,
  /^data\//i,
  /^backups\//i,
  /^releases\//i,
  /^reports\//i,
  /^outputs\//i,
  /^\.tmp\//i,
  /^test-results\//i,
  /^playwright-report\//i,
  /^node_modules\//i,
  /^apps\/frontend\/dist\//i
];

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.json', '.md', '.yml', '.yaml', '.txt', '.env',
  '.example', '.css', '.html', '.tex', '.bib', '.svg',
  '.sh', '.ps1', '.dockerignore', '.gitignore'
]);

const SECRET_PATTERNS = [
  {
    name: 'OpenAI-style API key',
    pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/g
  },
  {
    name: 'GitHub token',
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g
  },
  {
    name: 'JWT token',
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g
  },
  {
    name: 'Generic secret assignment',
    pattern: /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{24,})["']?/gi
  }
];

const ALLOWLIST_VALUE_HINTS = [
  'your-',
  'your_',
  'example',
  'placeholder',
  'changeme',
  'change-me',
  'sk-...',
  'sk-xxx',
  'token_here',
  'api-key',
  'PaperForge-collab-dev'
];

const ALLOWLIST_FILES = new Set([
  '.env.example',
  'SECURITY.md',
  'README.md',
  'README_ZH.md',
  'docs/DATA_BACKUP.md',
  'docs/RELEASE.md'
]);

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout || '';
}

function normalize(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function trackedFiles() {
  return runGit(['ls-files', '-z'])
    .split('\0')
    .map(normalize)
    .filter(Boolean);
}

function isTextLike(filePath) {
  const base = path.basename(filePath);
  if (base.startsWith('.env')) return true;
  if (base === '.gitignore' || base === '.dockerignore') return true;
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function isAllowedMatch(filePath, matchText) {
  const lower = String(matchText || '').toLowerCase();
  if (ALLOWLIST_VALUE_HINTS.some((hint) => lower.includes(hint))) return true;
  if (ALLOWLIST_FILES.has(filePath)) {
    return lower.includes('your') || lower.includes('example') || lower.includes('token_here') || lower.includes('sk-');
  }
  return false;
}

function lineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function scanPath(filePath) {
  for (const pattern of BLOCKED_TRACKED_PATHS) {
    if (pattern.test(filePath)) {
      failures.push(`${filePath}: blocked private/generated path is tracked`);
    }
  }
}

function scanContent(filePath) {
  if (!isTextLike(filePath)) return;
  const absolute = path.join(root, filePath);
  let content;
  try {
    content = fs.readFileSync(absolute, 'utf8');
  } catch (error) {
    warnings.push(`${filePath}: skipped unreadable text file (${error.message})`);
    return;
  }
  for (const rule of SECRET_PATTERNS) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(content)) !== null) {
      const matchText = match[1] || match[0];
      if (isAllowedMatch(filePath, matchText)) continue;
      failures.push(`${filePath}:${lineNumber(content, match.index)} possible ${rule.name}`);
    }
  }
}

function main() {
  const files = trackedFiles();
  for (const filePath of files) {
    scanPath(filePath);
    scanContent(filePath);
  }

  console.log(`Security scan checked ${files.length} tracked file(s).`);
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  console.log('Security scan passed.');
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
