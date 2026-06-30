import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const errors = [];
const checked = {
  files: 0,
  links: 0,
  anchors: 0
};

const SKIP_DIRS = new Set([
  '.git',
  '.tmp',
  'apps/frontend/dist',
  'backups',
  'data',
  'node_modules',
  'playwright-report',
  'releases',
  'reports',
  'test-results'
]);

function normalizePathForSkip(relativePath) {
  return relativePath.split(path.sep).join('/');
}

async function listMarkdownFiles(dir = root) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs);
    const normalized = normalizePathForSkip(rel);
    if (entry.isDirectory()) {
      if ([...SKIP_DIRS].some((skip) => normalized === skip || normalized.startsWith(`${skip}/`))) continue;
      files.push(...await listMarkdownFiles(abs));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(abs);
    }
  }
  return files;
}

function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

function collectAnchors(markdown) {
  const anchors = new Set();
  const duplicates = new Map();
  const lines = markdown.split(/\r?\n/);
  for (const match of markdown.matchAll(/<a\s+(?:[^>]*?\s)?(?:name|id)=["']([^"']+)["'][^>]*>/gi)) {
    anchors.add(match[1].toLowerCase());
  }
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;
    const base = slugify(heading[2]);
    if (!base) continue;
    const count = duplicates.get(base) || 0;
    duplicates.set(base, count + 1);
    anchors.add(count ? `${base}-${count}` : base);
  }
  return anchors;
}

function stripCodeBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '');
}

function extractLinks(markdown) {
  const text = stripCodeBlocks(markdown);
  const links = [];
  const mdLink = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const href = /href=["']([^"']+)["']/g;
  for (const match of text.matchAll(mdLink)) links.push(match[1]);
  for (const match of text.matchAll(href)) links.push(match[1]);
  return links;
}

function isExternal(link) {
  return /^(https?:|mailto:|tel:)/i.test(link) || link.startsWith('data:');
}

function decodeLinkPath(link) {
  try {
    return decodeURIComponent(link);
  } catch {
    return link;
  }
}

async function checkLink(file, link, anchorsByFile) {
  if (!link || isExternal(link)) return;
  if (link.startsWith('<') || link.startsWith('{')) return;
  checked.links += 1;

  const [rawPath, rawAnchor = ''] = link.split('#');
  const cleanedPath = decodeLinkPath(rawPath).replace(/^\/+/, '');
  const target = cleanedPath
    ? path.resolve(path.dirname(file), cleanedPath)
    : file;

  if (!target.startsWith(root)) {
    errors.push(`${path.relative(root, file)}: link escapes repository: ${link}`);
    return;
  }
  if (cleanedPath && !fssync.existsSync(target)) {
    errors.push(`${path.relative(root, file)}: missing link target: ${link}`);
    return;
  }
  if (rawAnchor) {
    checked.anchors += 1;
    const targetFile = cleanedPath ? target : file;
    const targetAnchors = anchorsByFile.get(targetFile);
    if (targetAnchors && !targetAnchors.has(rawAnchor.toLowerCase())) {
      errors.push(`${path.relative(root, file)}: missing anchor ${link}`);
    }
  }
}

const files = await listMarkdownFiles();
const anchorsByFile = new Map();

for (const file of files) {
  const markdown = await fs.readFile(file, 'utf8');
  anchorsByFile.set(file, collectAnchors(markdown));
}

for (const file of files) {
  checked.files += 1;
  const markdown = await fs.readFile(file, 'utf8');
  for (const link of extractLinks(markdown)) {
    await checkLink(file, link, anchorsByFile);
  }
}

console.log(`Documentation link check: ${checked.files} file(s), ${checked.links} local link(s), ${checked.anchors} anchor link(s).`);

if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`);
  console.error(`Documentation link check failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log('Documentation link check passed.');
