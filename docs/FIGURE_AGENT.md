# Figure Agent Guide

The PaperForge Figure Agent turns manuscript context into reusable scientific figure assets. It is designed as a complete workflow rather than a one-shot image generator:

```text
Plan -> Generate SVG -> QA -> Registry -> Report -> Quality Gate
```

## Quick Demo

Use this when you want to demonstrate the feature without configuring an API key.

1. Open a PaperForge project.
2. Open the **Plot** panel.
3. Click **Generate demo assets**.
4. PaperForge creates a complete demo bundle under `figures/`.

Generated files:

```text
figures/figure_plan.json
figures/demo_paperforge_figure_agent.svg
figures/demo_paperforge_figure_agent.figure.json
figures/demo_paperforge_figure_agent.figure.qa.json
figures/index.json
figures/figure_report.md
```

This is useful for onboarding, screenshots, presentations, and offline demos.

## Manuscript-Driven Workflow

For a real paper:

1. Put your manuscript or draft content in the project.
2. Open the **Plot** panel.
3. Click **Generate figure plan**.
4. Review the recommended figure candidates.
5. Select a plan item.
6. Click **Generate from plan**.
7. Run **Figure QA**.
8. Load the **Figure Registry**.
9. Export the **Figure Report**.

## Figure Skills

The renderer uses different layouts for different scientific communication tasks:

| Skill | Use case | Layout |
|---|---|---|
| Method pipeline | Method overview, data flow, preprocessing | Horizontal pipeline |
| Model architecture | Neural modules, encoders, decoders, layers | Layered architecture |
| Experiment workflow | Dataset, baselines, metrics, evaluation protocol | Workflow diagram |
| Result analysis | Ablation, error analysis, finding summaries | Result cards |
| Research timeline | Research phases, milestones, method evolution | Milestone axis |
| System overview | Tool platforms, agents, services, artifacts | System boundary / radial overview |

## Generated Artifacts

### `figures/figure_plan.json`

Stores candidate figure ideas:

- figure type
- target section
- purpose
- why the figure matters
- caption
- label
- key visual elements
- risks

### `figures/*.svg`

The generated scientific figure. SVG is used because it is readable, lightweight, and easy to version.

### `figures/*.figure.json`

The structured figure package. It records:

- adopted plan
- figure skill
- source file
- SVG path
- LaTeX include snippet
- caption and label
- editable node/edge spec

### `figures/*.figure.qa.json`

The QA report. It includes:

- score
- verdict
- summary
- strengths
- issues
- recommended caption
- revision prompt

### `figures/index.json`

The Figure Registry. It tracks all generated figures in the project:

- SVG path
- package path
- QA path
- title
- caption
- label
- skill
- QA score
- QA verdict

### `figures/figure_report.md`

A handoff report for reviewing or presenting generated figures. It includes a table of figures and ready-to-copy LaTeX snippets.

## Quality Gate

Run:

```bash
npm run check:figures
```

The check validates:

- `figures/index.json` parses correctly
- SVG files exist
- `.figure.json` packages exist
- `.figure.qa.json` reports exist when referenced
- registry paths match package and QA paths
- package specs include nodes and edges
- QA scores are numeric
- `figure_report.md` references generated figures

The full project gate also includes this check:

```bash
npm run check
```

## Recommended Demo Script

Use this short path in a presentation:

```text
1. Open a project.
2. Click Plot -> Generate demo assets.
3. Show the generated SVG preview.
4. Open the Figure Registry.
5. Show the QA score.
6. Export the Figure Report.
7. Run npm run check:figures.
```

One-sentence explanation:

> PaperForge Figure Agent converts manuscript context into a managed scientific figure asset pipeline, including planning, SVG generation, QA, registry tracking, LaTeX insertion, report export, and automated validation.

## Notes and Limitations

- The default SVG renderer creates structured research diagrams, not photorealistic illustrations.
- For final submission, regenerate demo assets with manuscript-specific context.
- For paper-specific accuracy, review QA issues and captions before inserting figures.
- If the LLM provider does not support images, Figure Agent still works for text-driven planning and SVG generation.
