import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);

if (process.env.CIPHER_ROUTE_CHILD !== '1') {
  const child = spawn(process.execPath, [here], {
    env: {
      ...process.env,
      OPENAI_API_KEY: 'sk-fictional-cipher-toolkit-test',
      IDENTIFY_LLM_RERANK: '0',
      CIPHER_ROUTE_CHILD: '1',
    },
    stdio: 'inherit',
    windowsHide: true,
  });
  const [code] = await once(child, 'exit');
  process.exit(code ?? 1);
}

function request(port, method, path, body) {
  const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method,
        path,
        headers: data
          ? { 'content-type': 'application/json', 'content-length': data.length }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, json: JSON.parse(raw) });
        });
      },
    );
    req.on('error', reject);
    if (data) req.end(data);
    else req.end();
  });
}

const express = (await import('express')).default;
const { default: router } = await import('./src/routes/ciphers.js');
const { getCipherMeta, registry } = await import('./src/ciphers/registry.js');

const app = express();
app.use(express.json());
app.use(router);
const server = http.createServer(app);

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const addr = server.address();
  assert.strictEqual(addr.address, '127.0.0.1');
  const port = addr.port;

  const formats = await request(port, 'GET', '/formats');
  assert.strictEqual(formats.status, 200);
  assert.deepStrictEqual(formats.json, ['text', 'hex', 'base64', 'binary']);

  const categories = await request(port, 'GET', '/categories');
  assert.strictEqual(categories.status, 200);
  assert.deepStrictEqual(categories.json, [...new Set(registry.map((c) => c.category))]);

  const caesar = await request(port, 'GET', '/caesar');
  const meta = getCipherMeta().find((c) => c.id === 'caesar');
  assert.strictEqual(caesar.status, 200);
  assert.strictEqual(caesar.json.id, 'caesar');
  assert.strictEqual(caesar.json.name, meta.name);
  assert.strictEqual(caesar.json.category, meta.category);

  const missing = await request(port, 'GET', '/no-such-cipher-zz');
  assert.strictEqual(missing.status, 404);
  assert.deepStrictEqual(missing.json, { error: '未找到' });

  const converted = await request(port, 'POST', '/format-convert', {
    text: 'Hi',
    from: 'text',
    to: 'hex',
  });
  assert.strictEqual(converted.status, 200);
  assert.deepStrictEqual(converted.json, { result: '48 69' });

  const noText = await request(port, 'POST', '/format-convert', { from: 'text', to: 'hex' });
  assert.strictEqual(noText.status, 400);
  assert.deepStrictEqual(noText.json, { error: '需要 text' });

  const badFormat = await request(port, 'POST', '/format-convert', {
    text: 'Hi',
    from: 'morse',
    to: 'hex',
  });
  assert.strictEqual(badFormat.status, 400);
  assert.strictEqual(badFormat.json.error, '格式须为 text/hex/base64/binary');
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log('cipher routes ok');
