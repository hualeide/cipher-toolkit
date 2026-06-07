/**
 * 桌面版入口：启动内置 API + 静态前端，并打开浏览器。
 * 供 caxa 打包为 .exe，或本地：node scripts/desktop-launcher.mjs
 */
import http from 'http';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
process.chdir(root);

process.env.SERVE_FRONTEND = '1';
process.env.HOST = process.env.HOST || '127.0.0.1';
process.env.PORT = process.env.PORT || '3001';

const port = Number(process.env.PORT);

function openBrowser(url) {
  if (process.env.NO_BROWSER === '1') return;
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function waitForHealth(maxMs = 60_000) {
  const url = `http://${process.env.HOST}:${port}/api/health`;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else if (Date.now() - start > maxMs) reject(new Error('server timeout'));
        else setTimeout(tick, 250);
      }).on('error', () => {
        if (Date.now() - start > maxMs) reject(new Error('server timeout'));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

console.log('');
console.log('  密码学工具箱 · 桌面版');
console.log('  正在启动…');
console.log('');

await import('../backend/src/server.js');

try {
  await waitForHealth();
  const url = `http://${process.env.HOST}:${port}/`;
  console.log(`  已就绪 → ${url}`);
  console.log('  关闭本窗口即停止服务。');
  console.log('');
  openBrowser(url);
} catch (e) {
  console.error('  启动失败:', e.message);
  process.exit(1);
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
