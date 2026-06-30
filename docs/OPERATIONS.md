# Operations Guide

This guide covers runtime checks for local use, self-hosted deployments, and CI smoke verification.

## Health Endpoints

PaperForge exposes three health endpoints:

| Endpoint | Purpose | Response |
|---|---|---|
| `/api/health` | Lightweight compatibility check | `200` when the server process can answer HTTP |
| `/api/health/live` | Liveness check for process monitors | `200` with uptime and timestamp |
| `/api/health/ready` | Readiness check for deployments | `200` when required runtime checks pass, `503` when degraded |

The readiness endpoint checks:

- Project data directory can be created and written.
- Project index can be read.
- Template manifest can be parsed.
- Project and template counts can be reported.

The endpoint intentionally does not expose the absolute local data directory path.

Example:

```bash
curl http://localhost:8787/api/health/ready
```

Typical response:

```json
{
  "ok": true,
  "status": "ok",
  "uptimeSeconds": 42,
  "dataDir": {
    "exists": true,
    "writable": true,
    "projectCount": 1
  },
  "templates": {
    "manifest": true,
    "templateCount": 4,
    "categoryCount": 8
  },
  "checks": [
    { "name": "data-dir-writable", "status": "ok" },
    { "name": "project-index-readable", "status": "ok" },
    { "name": "template-manifest-readable", "status": "ok" }
  ]
}
```

## Recommended Checks

Before sharing, deploying, or backing up an instance:

```bash
npm run doctor
npm run check:figures
npm run test
npm run e2e
```

For self-hosted deployments:

1. Configure `PaperForge_DATA_DIR` outside the repository.
2. Start the service.
3. Check `/api/health/live`.
4. Check `/api/health/ready`.
5. Create a backup with `npm run backup:data`.

## Troubleshooting

- `data-dir-writable` fails: check directory permissions and disk availability.
- `project-index-readable` fails: check whether `PaperForge_DATA_DIR` contains inaccessible files or corrupted project folders.
- `template-manifest-readable` fails: check `templates/manifest.json` syntax.
- `/api/health` works but `/api/health/ready` returns `503`: the server is alive, but a dependency needed for real use is degraded.
