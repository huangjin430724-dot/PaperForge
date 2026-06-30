import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.describe('PaperForge smoke flows', () => {
  test('health endpoints report liveness and readiness', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    await expect(await health.json()).toEqual(expect.objectContaining({ ok: true, status: 'ok' }));

    const live = await request.get('/api/health/live');
    expect(live.ok()).toBeTruthy();
    await expect(await live.json()).toEqual(expect.objectContaining({ ok: true, status: 'alive' }));

    const ready = await request.get('/api/health/ready');
    expect(ready.ok()).toBeTruthy();
    const report = await ready.json();
    expect(report).toEqual(expect.objectContaining({
      ok: true,
      status: 'ok',
      dataDir: expect.objectContaining({ writable: true }),
      templates: expect.objectContaining({ manifest: true }),
    }));
    expect(report.dataDir.path).toBeUndefined();
  });

  test('landing page exposes the product entry point', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /PaperForge is Here/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /开始写作|Start Writing/i })).toBeVisible();
  });

  test('project workspace can create and open a project', async ({ page }) => {
    const projectName = `E2E Project ${Date.now()}`;

    await page.goto('/projects');
    await expect(page.getByText('PaperForge').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /\+ 新建项目|\+ New Project/i })).toBeVisible();

    await page.getByRole('button', { name: /\+ 新建项目|\+ New Project/i }).click();
    const createDialog = page.locator('.modal').filter({ hasText: /新建项目|New Project/i });
    await expect(createDialog).toBeVisible();
    await createDialog.locator('input.input').first().fill(projectName);
    await createDialog.getByRole('button', { name: /^创建$|^Create$/i }).click();

    await expect(page).toHaveURL(/\/editor\//);
    await expect(page.getByText(projectName).first()).toBeVisible();
    await expect(page.getByText(/编辑器|Editor/i).first()).toBeVisible();
    await expect(page.getByText(/预览|Preview/i).first()).toBeVisible();
  });

  test('project workspace exposes a system status panel', async ({ page }) => {
    await page.goto('/projects');
    await page.getByTestId('project-health-button').click();
    const modal = page.getByTestId('project-health-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Ready|Degraded/i)).toBeVisible();
    await expect(modal.getByText('data-dir-writable')).toBeVisible();
    await expect(modal.getByText('template-manifest-readable')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await modal.getByTestId('download-diagnostics-button').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^paperforge-diagnostics-.*\.json$/);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const diagnostics = JSON.parse(await readFile(downloadPath!, 'utf8'));
    expect(diagnostics).toEqual(expect.objectContaining({
      schemaVersion: 1,
      source: 'PaperForge workspace system status',
      readiness: expect.objectContaining({
        ok: true,
        status: 'ok',
      }),
    }));
    expect(diagnostics.readiness.dataDir.path).toBeUndefined();
  });
});
