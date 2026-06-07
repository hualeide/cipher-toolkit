import { test, expect } from '@playwright/test';
import { navTab } from './helpers.js';

test('加解密页凯撒加密 HELLO → KHOOR', async ({ page }) => {
  await page.goto('/');
  await navTab(page, /加解密/).click();
  await expect(page.getByRole('heading', { name: '凯撒密码', level: 2 })).toBeVisible();

  await page.getByPlaceholder('搜索加密方式…').fill('凯撒');
  await page.locator('.cipher-item').filter({ hasText: '凯撒密码' }).first().click();

  const plain = page.getByPlaceholder('输入明文，右侧自动出密文…');
  const cipher = page.getByPlaceholder('输入密文，左侧自动出明文…');

  await plain.fill('HELLO');
  await expect(cipher).toHaveValue('KHOOR', { timeout: 10_000 });
  await expect(page.getByText('分析中…')).toHaveCount(0);
});

test('加解密页双向解密 KHOOR → HELLO', async ({ page }) => {
  await page.goto('/');
  await navTab(page, /加解密/).click();
  await expect(page.getByRole('heading', { name: '凯撒密码', level: 2 })).toBeVisible();

  await page.getByPlaceholder('搜索加密方式…').fill('凯撒');
  await page.locator('.cipher-item').filter({ hasText: '凯撒密码' }).first().click();

  const plain = page.getByPlaceholder('输入明文，右侧自动出密文…');
  const cipher = page.getByPlaceholder('输入密文，左侧自动出明文…');

  await cipher.fill('KHOOR');
  await expect(plain).toHaveValue('HELLO', { timeout: 10_000 });
});
