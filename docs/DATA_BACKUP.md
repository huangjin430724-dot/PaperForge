# Data Backup and Restore

PaperForge stores local projects under `data/` by default. Deployments can override this with `PaperForge_DATA_DIR`.

The backup workflow packages the project data directory into a `.tgz` archive with a small manifest. It is designed for local migration, self-hosted deployments, and safe demos.

## Create a Backup

```bash
npm run backup:data
```

By default this writes a timestamped archive to `backups/`.

Custom output:

```bash
npm run backup:data -- --out backups/my-paperforge-backup.tgz
```

Custom data directory:

```bash
npm run backup:data -- --data-dir /var/PaperForge/data --out backups/server-data.tgz
```

Windows PowerShell:

```powershell
npm run backup:data -- --data-dir "C:\PaperForge\data" --out "C:\PaperForge\backups\data.tgz"
```

## Inspect a Backup

```bash
node scripts/backup-data.mjs list --file backups/my-paperforge-backup.tgz
```

This lists the archive contents and reports whether the backup manifest is present.

## Restore a Backup

Restore into an empty data directory:

```bash
npm run restore:data -- --file backups/my-paperforge-backup.tgz --data-dir ./data-restored
```

Overwrite an existing directory only when intentional:

```bash
npm run restore:data -- --file backups/my-paperforge-backup.tgz --data-dir ./data --replace
```

## Recommended Operations

- Stop the running PaperForge server before restoring.
- Keep `.env` and API keys outside backups unless your deployment policy explicitly requires encrypted secret backup.
- Store backup archives outside the repository for real deployments.
- Run `npm run doctor` and `npm run check:figures` after restore.
- For Figure Agent projects, run `node scripts/check-figure-assets.mjs <restored-project-or-data-dir> --require` when you need stricter validation.

## Demo Round Trip

Run the full demo validation workflow:

```bash
npm run demo:check
```

This seeds a demo project in `.tmp/demo-check`, validates editable Figure Agent assets, creates a backup, restores it, and validates the restored project again.

Manual equivalent:

```bash
PaperForge_DATA_DIR=.tmp/demo-data npm run seed:demo
npm run backup:data -- --data-dir .tmp/demo-data --out .tmp/demo-backup.tgz
npm run restore:data -- --file .tmp/demo-backup.tgz --data-dir .tmp/demo-restored --replace
node scripts/check-figure-assets.mjs .tmp/demo-restored/demo-paperforge-showcase --require
```
