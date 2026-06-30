# Security Policy

PaperForge is a local-first academic writing workbench. It may process manuscripts, references, generated figures, and user-provided API keys, so please handle security reports carefully.

## Supported Versions

Security fixes are handled on the `main` branch. If you maintain a fork, please keep it up to date with `main`.

## Reporting a Vulnerability

If you find a vulnerability, please do not publish exploit details in a public issue.

Use a private channel available to the repository owner, or open a GitHub issue with only a high-level description and request a private follow-up channel.

Please include:

- A short summary of the issue.
- Affected area, such as backend routes, project file access, LLM configuration, collaboration, tunneling, or Figure Agent artifacts.
- Reproduction steps or a minimal proof of concept.
- Expected impact.
- Suggested fix if you have one.

## Sensitive Data Guidelines

Do not include the following in public issues, pull requests, screenshots, or generated demo assets:

- API keys or bearer tokens.
- Private manuscripts or unpublished paper content.
- Personal data.
- Internal server URLs, tunnel tokens, or collaboration invite tokens.
- Full generated project directories from private work.

Before pushing or opening a PR, run:

```bash
npm run security:scan
```

The scan checks Git-tracked files for common API key/token patterns and accidental private/generated paths such as `.env`, `data/`, `backups/`, and release artifacts.

## Scope

Security-sensitive areas include:

- Path traversal and project file access.
- Upload handling.
- LLM endpoint and API key storage.
- Collaboration invite tokens and WebSocket sessions.
- Local tunnel exposure.
- Generated artifacts under `figures/`, `refs/`, and `drafts/`.

## Disclosure

We aim to acknowledge valid reports, investigate reproducible issues, and document security-relevant fixes in release notes when appropriate.
