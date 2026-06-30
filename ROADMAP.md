# PaperForge Roadmap

This roadmap summarizes the current maturity of PaperForge and the next areas of investment. It is intentionally practical: items are grouped by user value and engineering readiness rather than by vague feature names.

## Shipped

### Academic Writing Workbench

- Local-first multi-project LaTeX workspace.
- Monaco-like editing workflow with file tree, outline, PDF preview, compile log, and diagnostics.
- OpenAI-compatible LLM configuration with DeepSeek / Ark-style endpoint support.
- Thinking-mode controls and token-aware thinking decisions for compatible models.
- AI writing, translation, review, consistency, citation, and evidence workflows.

### Figure Agent

- Scientific figure skill presets.
- Manuscript-aware `figure_plan.json` generation.
- Plan-driven SVG generation and `.figure.json` packages.
- Figure QA reports with score, verdict, issues, caption suggestions, and revision prompts.
- Skill-aware layouts for pipelines, architectures, result cards, timelines, and system overviews.
- Figure registry at `figures/index.json`.
- Figure registry browser in the UI.
- Figure report export to `figures/figure_report.md`.
- Offline demo asset generation.
- `npm run check:figures` quality gate.

### Open Source Maturity

- GitHub Actions CI.
- Playwright smoke tests for the landing page and project creation-to-editor flow.
- Seeded demo project for onboarding, reports, and Figure Agent walkthroughs.
- Docker / Docker Compose deployment.
- `.env.example` configuration template.
- Project Doctor via `npm run doctor`.
- Data backup and restore workflow for `PaperForge_DATA_DIR`.
- Liveness and readiness endpoints for deployment monitoring.
- Release bundle generation with manifest and checksum verification.
- Secret scanning and Dependabot dependency update configuration.
- Workspace system status panel for readiness checks and sanitized diagnostics export.
- Command-line diagnostics bundle generation for support and deployment triage.
- Diagnostics schema/redaction validation in local checks and GitHub Actions.
- Environment template and local deployment configuration validation.
- Markdown link and README anchor validation in local checks and CI.
- Issue templates, PR template, contribution guide, support policy, security policy, MIT license.
- Architecture guide, Figure Agent guide, changelog, and release notes.

## Next

### Better First-Run Experience

- Add a guided onboarding checklist in the UI.
- Show LLM / LaTeX / Docker readiness from `npm run doctor` results.
- Add more sample projects for template transfer and review workflows.

### Figure Agent Refinement

- Add editable node/edge controls after SVG generation.
- Add export to Mermaid and TikZ for users who prefer text-native diagrams.
- Add journal/template-aware figure style checks.
- Add batch generation from `figure_plan.json`.

### Deployment and Operations

- Add optional Docker image variants with TexLive or Tectonic.
- Add health endpoint details for deployment monitoring.
- Add restore checklists and alerting recipes for hosted instances.

## Later

### Collaboration

- Improve invite management and collaboration permissions.
- Add project-level audit history.
- Add snapshot restore UI for generated artifacts.

### Research Automation

- Add paper-specific literature map generation.
- Add experiment checklist extraction.
- Add reviewer-response drafting from review reports and evidence ledger.

### Quality and Testing

- Expand Playwright smoke tests to cover Figure Agent demos and template transfer flows.
- Add fixture-based tests for Figure Agent package and report generation.
- Reduce existing lint warnings incrementally.

## Non-Goals

- PaperForge is not intended to replace a full cloud document platform.
- Figure Agent is focused on structured scientific diagrams, not photorealistic image generation.
- Docker default images prioritize quick web deployment; heavy LaTeX distributions should remain optional.
