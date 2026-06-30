# Contributing to PaperForge

Thanks for helping improve PaperForge. This project is a local-first academic writing workbench, so changes should keep LaTeX editing, AI workflows, and generated artifacts predictable and reviewable.

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run doctor
npm run typecheck
npm run lint
npm run test
npm run check:figures
npm run build
```

Run the full local quality gate before opening a pull request:

```bash
npm run check
```

## Figure Agent Contributions

If your change affects scientific figure planning, SVG generation, QA, registry, reports, or demo assets:

- Include a short before/after note or screenshot.
- Keep generated assets under `figures/`.
- Ensure `.figure.json` matches the generated SVG path.
- Ensure `.figure.qa.json` matches the same `assetPath` when QA is present.
- Run `npm run check:figures`.

## Pull Requests

Please include:

- A concise summary of what changed.
- The user workflow affected.
- Commands you ran for verification.
- Screenshots or generated artifact paths for UI and Figure Agent changes.
- A `CHANGELOG.md` entry for notable user-facing or workflow changes.

## Issues

Use the GitHub issue templates when possible. For Figure Agent issues, include the relevant generated files or paths such as `figures/index.json`, `.figure.json`, `.figure.qa.json`, and `figure_report.md`.
