import { test, expect } from '@playwright/test';
import { mainResultText, pageHeading } from './helpers.js';

test('识别凯撒密文 KHOOR → HELLO', async ({ page }) => {
  await page.goto('/');
  await expect(pageHeading(page, '自动识别')).toBeVisible();

  await page.getByPlaceholder('粘贴可疑文本，无需选择算法…').fill('KHOOR');
  await page.waitForTimeout(700);

  await expect(page.locator('.result-name').filter({ hasText: '凯撒' })).toBeVisible();
  await expect(mainResultText(page, 'HELLO')).toBeVisible();
});

test('识别 Base64 aGVsbG8=', async ({ page }) => {
  await page.goto('/');
  await expect(pageHeading(page, '自动识别')).toBeVisible();

  await page.getByPlaceholder('粘贴可疑文本，无需选择算法…').fill('aGVsbG8=');
  await page.waitForTimeout(700);

  await expect(page.locator('.result-name').filter({ hasText: 'Base64' })).toBeVisible();
  await expect(mainResultText(page, 'hello')).toBeVisible();
});
