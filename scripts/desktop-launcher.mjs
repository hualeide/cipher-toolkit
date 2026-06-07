/**
 * 桌面版入口：启动内置 API + 静态前端，并打开浏览器。
 * 供 caxa 打包为 .exe，或本地：node scripts/desktop-launcher.mjs
 */
import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
process.chdir(root);

/** 日志写在 exe 旁，便于用户查看 */
const logFile = (() => {
  if (process.platform === 'win32' && process.execPath.toLowerCase().endsWith('.exe')) {
    return path.join(path.dirname(process.execPath), 'desktop.log');
  }
  return path.join(root, 'desktop.log');
})();

process.env.SERVE_FRONTEND = '1';
process.env.HOST = process.env.HOST || '127.0.0.1';
process.env.PORT = process.env.PORT || '3001';

const port = Number(process.env.PORT);

/** Windows 双击 .exe 无控制台时，用 cmd 窗口重新拉起自身 */
function ensureWindowsConsole() {
  if (process.platform !== 'win32') return false;
  if (process.env.DESKTOP_CONSOLE === '1') return false;
  if (process.stdout.isTTY) return false;

  const env = { ...process.env, DESKTOP_CONSOLE: '1' };
  spawn('cmd.exe', ['/k', process.execPath], {
    cwd: root,
    env,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  }).unref();
  return true;
}

function log(...args) {
  console.log(...args);
  try {
    const line = `${args.join(' ')}\n`;
    fs.appendFileSync(logFile, line, 'utf8');
  } catch { /* ignore */ }
}

function openBrowser(url) {
  if (process.env.NO_BROWSER === '1') return;
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }
  if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
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

if (ensureWindowsConsole()) {
  process.exit(0);
}

try { fs.writeFileSync(logFile, '', 'utf8'); } catch { /* ignore */ }

log('');
log('  密码学工具箱 · 桌面版');
log('  正在启动…');
log('');

await import('../backend/src/server.js');

try {
  await waitForHealth();
  const url = `http://${process.env.HOST}:${port}/`;
  log(`  已就绪 → ${url}`);
  log('  关闭本窗口即停止服务。');
  log('');
  openBrowser(url);
  setTimeout(() => openBrowser(url), 800);
} catch (e) {
  log('  启动失败:', e.message);
  log('  详见 desktop.log');
  process.exit(1);
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
