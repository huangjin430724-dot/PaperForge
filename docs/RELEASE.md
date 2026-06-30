# Release Bundles

PaperForge can generate a source release bundle for sharing, archiving, and GitHub release assets.

The release bundle is a `.tgz` archive built from Git-tracked files only. It excludes local data, `.env`, `node_modules`, build output, Playwright reports, backups, and other generated/private artifacts.

Each bundle contains `RELEASE_MANIFEST.json` with:

- Package name and version.
- Generated timestamp.
- Package root directory.
- File list.
- File sizes.
- SHA256 checksum for every bundled file.

## Create

```bash
npm run release:bundle
```

The archive is written to `releases/PaperForge-<version>.tgz`.

Custom version:

```bash
npm run release:bundle -- --version 0.1.1
```

Custom output directory:

```bash
npm run release:bundle -- --out-dir .tmp/release
```

## Verify

```bash
npm run release:verify -- --file releases/PaperForge-0.1.0.tgz
```

Verification checks:

- The archive has exactly one package root.
- Required project files are present.
- Every file listed in `RELEASE_MANIFEST.json` exists.
- Every listed SHA256 checksum matches.
- Blocked local/private paths are absent.

## Suggested GitHub Release Flow

1. Run the full quality gate:

   ```bash
   npm run doctor
   npm run check
   npm run e2e
   ```

2. Generate and verify the release bundle:

   ```bash
   npm run release:bundle
   npm run release:verify -- --file releases/PaperForge-0.1.0.tgz
   ```

3. Attach both files to a GitHub release:

   - `releases/PaperForge-0.1.0.tgz`
   - `releases/PaperForge-0.1.0.tgz.sha256`

4. Copy notable changes from `CHANGELOG.md` into the release notes.
