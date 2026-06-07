import { test, expect } from '@playwright/test';
import { identifyInput, pageHeading, navTab } from './helpers.js';

test.describe('应用启动', () => {
  test('加载算法库并显示识别页', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('密码学工具箱')).toBeVisible();
    await expect(page.getByText(/\d+种算法/)).toBeVisible();
    await expect(identifyInput(page)).toBeVisible();
    await expect(navTab(page, /自动识别/)).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('导航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(identifyInput(page)).toBeVisible();
  });

  test('切换主要页面', async ({ page }) => {
    await navTab(page, /加解密/).click();
    await expect(pageHeading(page, '凯撒密码')).toBeVisible();

    await navTab(page, /组合解密/).click();
    await expect(pageHeading(page, '组合解密')).toBeVisible();

    await navTab(page, /算法百科/).click();
    await expect(pageHeading(page, '算法百科')).toBeVisible();

    await navTab(page, /多媒体/).click();
    await expect(pageHeading(page, '多媒体实验室')).toBeVisible();

    await navTab(page, /设置/).click();
    await expect(pageHeading(page, '设置')).toBeVisible();

    await navTab(page, /自动识别/).click();
    await expect(identifyInput(page)).toBeVisible();
  });
});
