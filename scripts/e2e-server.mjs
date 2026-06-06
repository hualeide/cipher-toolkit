/**
 * E2E 专用：按需启动 backend + frontend（固定 5199 端口），供 Playwright webServer 使用。
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const E2E_PORT = 5199;
const E2E_HOST = '127.0.0.1';
const FRONTEND_URL = `http://${E2E_HOST}:${E2E_PORT}`;
const BACKEND_HEALTH = 'http://127.0.0.1:3001/api/health';

const children = [];

async function isUp(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitUp(url, ms = 120_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await isUp(url)) return true;
    await sleep(500);
  }
  return false;
}

function start(cmd, args, name) {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[e2e-server] ${name} exited ${code}`);
  });
  children.push(child);
  return child;
}

async function main() {
  if (!(await isUp(BACKEND_HEALTH))) {
    console.log('[e2e-server] starting backend…');
    start('npm', ['run', 'dev', '--prefix', 'backend'], 'backend');
    if (!(await waitUp(BACKEND_HEALTH))) {
      console.error('[e2e-server] backend failed to start');
      process.exit(1);
    }
  }

  if (!(await isUp(FRONTEND_URL))) {
    console.log(`[e2e-server] starting frontend on ${E2E_PORT}…`);
    start('npm', ['run', 'dev', '--prefix', 'frontend', '--', '--port', String(E2E_PORT), '--strictPort', '--host', E2E_HOST], 'frontend');
    if (!(await waitUp(FRONTEND_URL))) {
      console.error('[e2e-server] frontend failed to start');
      process.exit(1);
    }
  }

  console.log(`[e2e-server] ready → ${FRONTEND_URL}`);

  const shutdown = () => {
    for (const c of children) c.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await new Promise(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
