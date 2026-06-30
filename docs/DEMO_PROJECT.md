# Demo Project

PaperForge includes a local demo project generator for onboarding, reports, and live demonstrations.

## Generate

```bash
npm run seed:demo
```

This creates or updates `data/demo-paperforge-showcase`. The project appears in the project list as `PaperForge Demo Project`.

To write the demo into another data directory:

```bash
PaperForge_DATA_DIR=/path/to/data npm run seed:demo
```

On Windows PowerShell:

```powershell
$env:PaperForge_DATA_DIR = "C:\path\to\data"
npm run seed:demo
Remove-Item Env:PaperForge_DATA_DIR
```

## What It Contains

- `README_DEMO.md` with a suggested demo flow.
- `drafts/source_zh.md` as a Chinese manuscript source.
- `main.tex` as a LaTeX paper draft.
- `refs/reference.bib` as a BibTeX example.
- `figures/figure_plan.json` as a Figure Agent planning artifact.
- `figures/demo_paperforge_research_workflow.svg` as an offline scientific figure.
- `.figure.json`, `.figure.qa.json`, `figures/index.json`, and `figures/figure_report.md` for the Figure Agent asset workflow.

## Validate

```bash
npm run check:figures
```

For an isolated validation run:

```bash
node scripts/check-figure-assets.mjs data/demo-paperforge-showcase --require
```

## Recommended Presentation Flow

1. Run `npm run seed:demo`.
2. Start PaperForge with `npm run dev`.
3. Open `PaperForge Demo Project`.
4. Show `drafts/source_zh.md`, `main.tex`, and the generated SVG figure.
5. Open the Plot panel, load the figure registry, and show the QA/report artifacts.
