import { extractArxivId, fetchArxivEntry, buildArxivBibtex, searchArxiv } from '../services/arxivService.js';

export function registerArxivRoutes(fastify) {
  fastify.post('/api/arxiv/search', async (req) => {
    const { query, maxResults } = req.body || {};
    if (!query || !String(query).trim()) {
      return { ok: false, error: 'Missing query.' };
    }
    try {
      const papers = await searchArxiv(String(query), maxResults);
      return { ok: true, papers };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  });

  fastify.post('/api/arxiv/bibtex', async (req) => {
    const { arxivId } = req.body || {};
    const id = extractArxivId(arxivId);
    if (!id) return { ok: false, error: 'Invalid arXiv ID.' };
    const entry = await fetchArxivEntry(id);
    if (!entry) return { ok: false, error: 'No arXiv metadata found.' };
    return { ok: true, bibtex: buildArxivBibtex(entry), entry };
  });
}
