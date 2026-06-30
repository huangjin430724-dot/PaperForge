import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
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

async function readJson(relativePath) {
  const raw = await fs.readFile(path.join(root, relativePath), 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

async function readChangelog() {
  return fs.readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
}

function extractSection(markdown, sectionName) {
  const lines = markdown.split(/\r?\n/);
  const target = `## ${sectionName}`.toLowerCase();
  const collected = [];
  let inSection = false;
  for (const line of lines) {
    if (line.toLowerCase().trim() === target) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith('## ')) break;
    if (inSection) collected.push(line);
  }
  return collected.join('\n').trim();
}

function normalizeSectionTitle(version) {
  if (version.toLowerCase() === 'unreleased') return 'Unreleased';
  return version;
}

function buildNotes({ packageName, version, body }) {
  const title = version.toLowerCase() === 'unreleased'
    ? `${packageName} Unreleased Notes`
    : `${packageName} ${version}`;
  return `# ${title}\n\n${body.trim()}\n`;
}

async function main() {
  const pkg = await readJson('package.json');
  const version = normalizeSectionTitle(getArg('--version', 'Unreleased'));
  const outDir = path.resolve(root, getArg('--out-dir', path.join('.tmp', 'release-notes')));
  const stdoutOnly = hasFlag('--stdout');
  const changelog = await readChangelog();
  const section = extractSection(changelog, version);

  if (!section) {
    throw new Error(`CHANGELOG.md does not contain a non-empty "${version}" section.`);
  }

  const notes = buildNotes({ packageName: pkg.name || 'PaperForge', version, body: section });
  if (stdoutOnly) {
    process.stdout.write(notes);
    return;
  }

  await fs.mkdir(outDir, { recursive: true });
  const safeVersion = version.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-|-$/g, '') || 'release';
  const outFile = path.join(outDir, `PaperForge-${safeVersion}-release-notes.md`);
  await fs.writeFile(outFile, notes, 'utf8');
  console.log(`Release notes written: ${path.relative(root, outFile)}`);
}

main().catch((error) => {
  console.error(`Release notes failed: ${error?.stack || error}`);
  process.exit(1);
});
