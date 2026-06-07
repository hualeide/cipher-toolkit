import { test, expect } from '@playwright/test';
import { mainResultText, identifyInput, navTab } from './helpers.js';

test('识别凯撒密文 KHOOR → HELLO', async ({ page }) => {
  await page.goto('/');
  await navTab(page, /自动识别/).click();
  await expect(identifyInput(page)).toBeVisible();

  await identifyInput(page).fill('KHOOR');
  await page.waitForTimeout(700);

  await expect(page.locator('.result-name').filter({ hasText: '凯撒' })).toBeVisible();
  await expect(mainResultText(page, 'HELLO')).toBeVisible();
});

test('识别 Base64 aGVsbG8=', async ({ page }) => {
  await page.goto('/');
  await navTab(page, /自动识别/).click();
  await expect(identifyInput(page)).toBeVisible();

  await identifyInput(page).fill('aGVsbG8=');
  await page.waitForTimeout(700);

  await expect(page.locator('.result-name').filter({ hasText: 'Base64' })).toBeVisible();
  await expect(mainResultText(page, 'hello')).toBeVisible();
});
