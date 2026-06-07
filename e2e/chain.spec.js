import { test, expect } from '@playwright/test';
import { mainResultText, pageHeading, navTab } from './helpers.js';

test('组合解密页自动链解密 Base64', async ({ page }) => {
  await page.goto('/');
  await navTab(page, /组合解密/).click();
  await expect(pageHeading(page, '组合解密')).toBeVisible();

  await page.getByPlaceholder('粘贴多层加密文本…').fill('aGVsbG8=');
  await page.waitForTimeout(700);

  await expect(page.locator('.chain-tag').filter({ hasText: 'Base64' })).toBeVisible({ timeout: 15_000 });
  await expect(mainResultText(page, 'hello')).toBeVisible();
});
