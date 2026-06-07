/** 识别结果主文本（避免 getByText 多匹配） */
export function mainResultText(page, text) {
  return page.locator('pre.result-text').filter({ hasText: text });
}

/** 识别页已就绪（无页头，用输入框判断） */
export function identifyInput(page) {
  return page.getByPlaceholder('粘贴密文…');
}

/** 页面主标题 h2 */
export function pageHeading(page, name) {
  return page.getByRole('heading', { name, exact: true, level: 2 });
}

/** 顶部导航 tab（NavBar 使用 role=tab） */
export function navTab(page, name) {
  return page.getByRole('tab', { name });
}
