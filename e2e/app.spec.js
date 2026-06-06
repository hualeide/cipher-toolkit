import { test, expect } from '@playwright/test';
import { pageHeading } from './helpers.js';

test.describe('应用启动', () => {
  test('加载算法库并显示识别页', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('密码学工具箱')).toBeVisible();
    await expect(page.getByText(/\d+种算法/)).toBeVisible();
    await expect(page.getByRole('heading', { name: '自动识别' })).toBeVisible();
  });
});

test.describe('导航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '自动识别' })).toBeVisible();
  });

  test('切换主要页面', async ({ page }) => {
    await page.getByRole('button', { name: /加解密/ }).click();
    await expect(pageHeading(page, '加解密')).toBeVisible();

    await page.getByRole('button', { name: /组合解密/ }).click();
    await expect(pageHeading(page, '组合解密')).toBeVisible();

    await page.getByRole('button', { name: /算法百科/ }).click();
    await expect(pageHeading(page, '算法百科')).toBeVisible();

    await page.getByRole('button', { name: /多媒体/ }).click();
    await expect(pageHeading(page, '多媒体实验室')).toBeVisible();

    await page.getByRole('button', { name: /设置/ }).click();
    await expect(pageHeading(page, '设置')).toBeVisible();

    await page.getByRole('button', { name: /自动识别/ }).click();
    await expect(pageHeading(page, '自动识别')).toBeVisible();
  });
});
