import { expect, test } from '@playwright/test';

test.describe('PaperForge smoke flows', () => {
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
});
