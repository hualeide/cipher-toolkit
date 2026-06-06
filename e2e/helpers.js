/** 识别结果主文本（避免 getByText 多匹配） */
export function mainResultText(page, text) {
  return page.locator('pre.result-text').filter({ hasText: text });
}

/** 页面主标题 h2 */
export function pageHeading(page, name) {
  return page.getByRole('heading', { name, exact: true, level: 2 });
}
