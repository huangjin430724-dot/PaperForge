import { promises as fs, createWriteStream } from 'fs';
import { pipeline, Transform } from 'stream';
import { promisify } from 'util';
import { Readable } from 'stream';
import { XMLParser } from 'fast-xml-parser';

const pipelineAsync = promisify(pipeline);
const ARXIV_USER_AGENT = 'PaperForge/1.0 (mailto:contact@example.com)';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&hellip;/g, '...')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchArxivWithRetry(url, { timeoutMs = 30_000, retries = 3 } = {}) {
  let lastStatus = 0;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': ARXIV_USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.ok) return res;
      lastStatus = res.status;
      if (![429, 500, 502, 503, 504].includes(res.status) || attempt === retries) {
        return res;
      }
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
    }
    await wait(700 * (attempt + 1));
  }
  if (lastError) throw lastError;
  throw new Error(`arXiv API failed: ${lastStatus || 'unknown status'}`);
}

export function extractArxivId(input) {
  if (!input) return '';
  const trimmed = String(input).trim();
  const match = trimmed.match(/arxiv\.org\/(abs|pdf|e-print)\/([^?#/]+)/i);
  let id = match ? match[2] : trimmed;
  id = id.replace(/\.pdf$/i, '');
  id = id.replace(/v\d+$/i, '');
  return id;
}

export async function fetchArxivEntry(arxivId) {
  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`;
  const res = await fetchArxivWithRetry(url);
  if (!res.ok) {
    throw new Error(`arXiv API failed: ${res.status}`);
  }
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);
  const entry = Array.isArray(data?.feed?.entry) ? data.feed.entry[0] : data?.feed?.entry;
  if (!entry) return null;
  const authors = Array.isArray(entry.author) ? entry.author : [entry.author].filter(Boolean);
  const authorNames = authors.map((a) => a?.name).filter(Boolean);
  const published = entry.published || '';
  const year = published ? String(published).slice(0, 4) : '';
  return {
    title: String(entry.title || '').replace(/\s+/g, ' ').trim(),
    abstract: String(entry.summary || '').replace(/\s+/g, ' ').trim(),
    authors: authorNames,
    year,
    id: String(entry.id || ''),
    arxivId
  };
}

export function parseArxivSearchXml(xml) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(xml);
  const entries = Array.isArray(data?.feed?.entry) ? data.feed.entry : data?.feed?.entry ? [data.feed.entry] : [];
  return entries.map((entry) => {
    const authors = Array.isArray(entry.author) ? entry.author : [entry.author].filter(Boolean);
    const authorNames = authors.map((a) => a?.name).filter(Boolean);
    const id = String(entry.id || '');
    const arxivId = id ? id.split('/').pop() : '';
    return {
      title: String(entry.title || '').replace(/\s+/g, ' ').trim(),
      abstract: String(entry.summary || '').replace(/\s+/g, ' ').trim(),
      authors: authorNames,
      url: id,
      arxivId
    };
  });
}

export function parseArxivSearchHtml(html, maxResults = 5) {
  const blocks = String(html || '').split(/<li class="arxiv-result">/).slice(1);
  return blocks.slice(0, maxResults).map((block) => {
    const idMatch = block.match(/https:\/\/arxiv\.org\/abs\/([^"?#]+)/i);
    const titleMatch = block.match(/<p class="title[^"]*">([\s\S]*?)<\/p>/i);
    const authorsMatch = block.match(/<p class="authors">([\s\S]*?)<\/p>/i);
    const abstractFullMatch = block.match(/<span class="abstract-full[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const abstractShortMatch = block.match(/<span class="abstract-short[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const arxivId = idMatch ? idMatch[1].replace(/v\d+$/i, '') : '';
    const authors = [];
    const authorBlock = authorsMatch?.[1] || '';
    for (const match of authorBlock.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/gi)) {
      const author = decodeHtml(match[1]);
      if (author) authors.push(author);
    }
    return {
      title: decodeHtml(titleMatch?.[1] || ''),
      abstract: decodeHtml(abstractFullMatch?.[1] || abstractShortMatch?.[1] || '').replace(/^Abstract:\s*/i, ''),
      authors,
      url: arxivId ? `https://arxiv.org/abs/${arxivId}` : '',
      arxivId
    };
  }).filter((paper) => paper.arxivId && paper.title);
}

async function searchArxivHtmlFallback(query, maxResults = 5) {
  const url = `https://arxiv.org/search/?searchtype=all&query=${encodeURIComponent(String(query))}`;
  const res = await fetchArxivWithRetry(url, { retries: 2 });
  if (!res.ok) {
    throw new Error(`arXiv web search failed: ${res.status}`);
  }
  return parseArxivSearchHtml(await res.text(), maxResults);
}

export async function searchArxiv(query, maxResults = 5) {
  const max = Math.min(10, Math.max(1, Number(maxResults) || 5));
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(String(query))}&start=0&max_results=${max}`;
  try {
    const res = await fetchArxivWithRetry(url, { retries: 3 });
    if (!res.ok) {
      if ([429, 500, 502, 503, 504].includes(res.status)) {
        return searchArxivHtmlFallback(query, max);
      }
      throw new Error(`arXiv search failed: ${res.status}.`);
    }
    return parseArxivSearchXml(await res.text());
  } catch (err) {
    try {
      return await searchArxivHtmlFallback(query, max);
    } catch {
      const message = String(err?.message || err);
      throw new Error(`arXiv search failed: ${message}. The official API and web fallback are both unavailable from this network.`);
    }
  }
}

export function buildArxivBibtex(entry) {
  if (!entry) return '';
  const key = `arxiv:${entry.arxivId}`;
  const author = entry.authors.join(' and ');
  const year = entry.year || '2024';
  return `@article{${key},\n  title={${entry.title}},\n  author={${author}},\n  journal={arXiv preprint arXiv:${entry.arxivId}},\n  year={${year}}\n}`;
}

export async function downloadArxivSource(arxivId, outputPath, onProgress) {
  const url = `https://arxiv.org/e-print/${arxivId}`;
  const res = await fetchArxivWithRetry(url, { timeoutMs: 300_000, retries: 2 });
  if (!res.ok) {
    throw new Error(`arXiv download failed: ${res.status}`);
  }
  const total = parseInt(res.headers.get('content-length') || '0', 10);
  let received = 0;
  const progress = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length;
      if (onProgress) onProgress({ received, total });
      cb(null, chunk);
    }
  });
  const nodeStream = Readable.fromWeb(res.body);
  await pipelineAsync(nodeStream, progress, createWriteStream(outputPath));
}

