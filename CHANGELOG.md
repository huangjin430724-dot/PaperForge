# Changelog

All notable changes to PaperForge are documented here.

This project follows a practical changelog style inspired by Keep a Changelog. Dates use `YYYY-MM-DD`.

## Unreleased

### Added

- `docs/FIGURE_AGENT.md` with demo steps, artifact reference, QA workflow, registry/report usage, and validation commands.
- `docs/ARCHITECTURE.md` with system overview, backend routes, data layout, Figure Agent workflow, deployment, and quality gates.
- `.env.example` with documented server, LLM, thinking, MinerU, collaboration, tunnel, and plotting configuration.
- Dockerfile, Docker Compose configuration, and `.dockerignore` for one-command self-hosted deployment.
- MIT `LICENSE`, `SECURITY.md`, and `SUPPORT.md` community health files.
- GitHub Actions CI workflow for lint, tests, typecheck, Figure Agent asset checks, and production build.
- GitHub issue templates for bug reports, feature requests, and Figure Agent feedback.
- Pull request template with verification checklist and Figure Agent artifact fields.
- `CONTRIBUTING.md` with development commands, quality gates, and Figure Agent contribution rules.

## 2026-06-30 - Figure Agent Maturity Release

### Added

- Scientific Figure Agent presets for method pipelines, model architectures, experiment workflows, result analysis, research timelines, and system overviews.
- Manuscript-aware figure planning workflow that writes `figures/figure_plan.json`.
- Plan-driven SVG generation with matching `.figure.json` packages.
- Figure QA workflow that writes `.figure.qa.json` reports with score, verdict, issues, strengths, caption suggestions, and revision prompts.
- Skill-aware SVG renderer with different layouts for pipelines, layered architectures, result cards, timelines, and system overviews.
- Figure asset registry at `figures/index.json` for tracking generated SVGs, figure packages, QA reports, captions, labels, and scores.
- Figure registry browser in the plot panel for previewing and inserting historical scientific figures.
- Figure asset report export to `figures/figure_report.md`.
- Offline Figure Agent demo asset generation for API-free demos and onboarding.
- Figure asset quality gate via `npm run check:figures`.

### Changed

- `npm run check` now includes Figure Agent asset validation.
- README and README_ZH now document Figure Agent asset management, QA, reports, demo assets, CI, and contribution workflows.

### Verified

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run check:figures`
- `npm run build`
- `npm run check`

## 2026-06-29 - PaperForge Project Polish

### Added

- OpenAI-compatible endpoint guidance and DeepSeek / Ark-compatible configuration improvements.
- Thinking-mode controls and token-aware thinking decision support.
- Submission readiness checks and review-oriented writing tools.
- Citation support verifier, claim evidence ledger, literature evidence matrix, and writing style guides.

### Changed

- Project branding was aligned around PaperForge while preserving OpenPrism compatibility where needed.
