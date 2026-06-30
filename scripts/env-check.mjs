import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const errors = [];
const warnings = [];
const info = [];

const REQUIRED_KEYS = [
  'PORT',
  'PaperForge_DATA_DIR',
  'PaperForge_LLM_ENDPOINT',
  'PaperForge_LLM_API_KEY',
  'PaperForge_LLM_MODEL',
  'PaperForge_LLM_THINKING',
  'PaperForge_LLM_THINKING_MODE',
  'PaperForge_MINERU_API_BASE',
  'PaperForge_MINERU_TOKEN',
  'PaperForge_COLLAB_TOKEN_SECRET',
  'PaperForge_COLLAB_REQUIRE_TOKEN',
  'PaperForge_COLLAB_TOKEN_TTL',
  'PaperForge_COLLAB_FLUSH_DEBOUNCE_MS',
  'PaperForge_TUNNEL',
  'NGROK_AUTHTOKEN',
  'PaperForge_PYTHON'
];

const PLACEHOLDER_VALUES = new Set([
  '',
  'change-me',
  'change-me-to-a-long-random-secret',
  'your-api-key',
  'your-token',
  'sk-...'
]);

function readEnvFile(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) return null;
  const values = {};
  const lines = fs.readFileSync(target, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function isPlaceholder(value) {
  return PLACEHOLDER_VALUES.has(String(value || '').trim().toLowerCase());
}

function parseBool(value) {
  return ['true', 'false', '1', '0', 'yes', 'no'].includes(String(value || '').toLowerCase());
}

function validatePort(values, source) {
  const raw = values.PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`${source}: PORT must be an integer between 1 and 65535.`);
  }
}

function validateNumber(values, key, source, min = 0) {
  const value = Number(values[key]);
  if (!Number.isFinite(value) || value < min) {
    errors.push(`${source}: ${key} must be a number >= ${min}.`);
  }
}

function validateUrl(values, key, source) {
  const value = values[key];
  if (!value || isPlaceholder(value)) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push(`${source}: ${key} must use http or https.`);
    }
  } catch {
    errors.push(`${source}: ${key} must be a valid URL.`);
  }
}

function validateEnv(values, source, { template = false } = {}) {
  for (const key of REQUIRED_KEYS) {
    if (!Object.hasOwn(values, key)) errors.push(`${source}: missing ${key}.`);
  }

  validatePort(values, source);
  validateUrl(values, 'PaperForge_LLM_ENDPOINT', source);
  validateUrl(values, 'PaperForge_MINERU_API_BASE', source);
  validateNumber(values, 'PaperForge_COLLAB_TOKEN_TTL', source, 60);
  validateNumber(values, 'PaperForge_COLLAB_FLUSH_DEBOUNCE_MS', source, 0);

  if (values.PaperForge_LLM_THINKING && !parseBool(values.PaperForge_LLM_THINKING)) {
    errors.push(`${source}: PaperForge_LLM_THINKING must be true or false.`);
  }
  if (!['auto', 'on', 'off'].includes(String(values.PaperForge_LLM_THINKING_MODE || '').toLowerCase())) {
    errors.push(`${source}: PaperForge_LLM_THINKING_MODE must be auto, on, or off.`);
  }
  if (values.PaperForge_COLLAB_REQUIRE_TOKEN && !parseBool(values.PaperForge_COLLAB_REQUIRE_TOKEN)) {
    errors.push(`${source}: PaperForge_COLLAB_REQUIRE_TOKEN must be true or false.`);
  }
  if (!['false', 'localtunnel', 'cloudflared', 'ngrok'].includes(String(values.PaperForge_TUNNEL || '').toLowerCase())) {
    errors.push(`${source}: PaperForge_TUNNEL must be false, localtunnel, cloudflared, or ngrok.`);
  }

  if (!template) {
    if (isPlaceholder(values.PaperForge_COLLAB_TOKEN_SECRET)) {
      warnings.push(`${source}: PaperForge_COLLAB_TOKEN_SECRET still uses a placeholder value.`);
    }
    if (!values.PaperForge_LLM_API_KEY) {
      warnings.push(`${source}: PaperForge_LLM_API_KEY is empty; AI workflows will fail until configured.`);
    }
    if (String(values.PaperForge_TUNNEL).toLowerCase() === 'ngrok' && !values.NGROK_AUTHTOKEN) {
      warnings.push(`${source}: PaperForge_TUNNEL=ngrok but NGROK_AUTHTOKEN is empty.`);
    }
    if (String(values.PaperForge_TUNNEL).toLowerCase() !== 'false' && isPlaceholder(values.PaperForge_COLLAB_TOKEN_SECRET)) {
      errors.push(`${source}: set a strong PaperForge_COLLAB_TOKEN_SECRET before exposing a tunnel.`);
    }
  }
}

const template = readEnvFile('.env.example');
if (!template) {
  errors.push('Missing .env.example.');
} else {
  validateEnv(template, '.env.example', { template: true });
  info.push('.env.example parsed');
}

const local = readEnvFile('.env');
if (!local) {
  warnings.push('No .env file found. Copy .env.example to .env for deployment-specific configuration.');
} else {
  validateEnv({ ...template, ...local }, '.env');
  info.push('.env parsed');
}

console.log('PaperForge Environment Check');
console.log('============================');
for (const line of info) console.log(`OK   ${line}`);
for (const line of warnings) console.warn(`WARN ${line}`);
for (const line of errors) console.error(`FAIL ${line}`);

if (errors.length) {
  console.error('');
  console.error(`Environment check failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log('');
console.log(`Environment check passed with ${warnings.length} warning(s).`);
