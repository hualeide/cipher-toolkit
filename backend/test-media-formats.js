import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import sharp from 'sharp';
import mediaRouter from './src/routes/media.js';
import { convertImage } from './src/services/imageProcess.js';

const PNG_MAGIC = '89504e470d0a1a0a';

async function rawPng(w, h, rgb) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = rgb[0];
    buf[i * 3 + 1] = rgb[1];
    buf[i * 3 + 2] = rgb[2];
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

async function rawJpeg(w, h, rgb) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = rgb[0];
    buf[i * 3 + 1] = rgb[1];
    buf[i * 3 + 2] = rgb[2];
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
}

function dataUrlParts(url) {
  const m = /^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(url);
  assert.ok(m, url.slice(0, 40));
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
}

const LISTED = {
  png: { format: 'png', mime: 'image/png' },
  jpeg: { format: 'jpeg', mime: 'image/jpeg' },
  webp: { format: 'webp', mime: 'image/webp' },
  avif: { format: 'heif', mime: 'image/avif', compression: 'av1' },
  tiff: { format: 'tiff', mime: 'image/tiff' },
  gif: { format: 'gif', mime: 'image/gif' },
};

test('convertImage(bmp) 明确不支持，不能返回 PNG', async () => {
  const png = await rawPng(8, 8, [70, 120, 180]);
  await assert.rejects(() => convertImage(png, 'bmp'), /不支持格式/);
});

test('media router 格式契约与 blend/embed 默认字段', async () => {
  const app = express();
  app.use('/api/media', mediaRouter);
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const addr = server.address();
    assert.equal(addr.address, '127.0.0.1');
    const base = `http://127.0.0.1:${addr.port}/api/media`;
    const png = await rawPng(8, 8, [70, 120, 180]);
    const jpeg = await rawJpeg(8, 8, [180, 100, 60]);

    const listedRes = await fetch(`${base}/formats`);
    assert.equal(listedRes.status, 200);
    const listed = await listedRes.json();
    assert.deepEqual(listed, Object.keys(LISTED));
    assert.equal(listed.includes('bmp'), false);

    async function convert(format, file = png) {
      const fd = new FormData();
      fd.append('file', new Blob([file], { type: 'image/png' }), 'tiny.png');
      fd.append('format', format);
      const res = await fetch(`${base}/convert`, { method: 'POST', body: fd });
      const body = await res.json();
      return { res, body };
    }

    for (const name of listed) {
      const spec = LISTED[name];
      const { res, body } = await convert(name);
      assert.equal(res.status, 200, name);
      assert.equal(body.mime, spec.mime, name);
      const parsed = dataUrlParts(body.result);
      assert.equal(parsed.mime, spec.mime, name);
      const meta = await sharp(parsed.buf).metadata();
      assert.equal(meta.format, spec.format, name);
      if (spec.compression) assert.equal(meta.compression, spec.compression, name);
    }

    for (const alias of ['jpg', 'JPEG']) {
      const { res, body } = await convert(alias);
      assert.equal(res.status, 200, alias);
      assert.equal(body.mime, 'image/jpeg', alias);
      const parsed = dataUrlParts(body.result);
      assert.equal(parsed.mime, 'image/jpeg', alias);
      assert.equal((await sharp(parsed.buf).metadata()).format, 'jpeg', alias);
    }

    for (const bad of ['bmp', 'xyz']) {
      const { res, body } = await convert(bad);
      assert.equal(res.status, 400, bad);
      assert.match(body.error, /不支持格式/, bad);
      assert.equal(body.result, undefined, bad);
    }

    const missing = new FormData();
    missing.append('format', 'png');
    const missingRes = await fetch(`${base}/convert`, { method: 'POST', body: missing });
    const missingBody = await missingRes.json();
    assert.equal(missingRes.status, 400);
    assert.match(missingBody.error, /文件/);

    async function twoImages(path, topName) {
      const fd = new FormData();
      fd.append('baseImage', new Blob([png], { type: 'image/png' }), 'base.png');
      fd.append(topName, new Blob([jpeg], { type: 'image/jpeg' }), 'top.jpg');
      const res = await fetch(`${base}${path}`, { method: 'POST', body: fd });
      const body = await res.json();
      assert.equal(res.status, 200, path);
      const parsed = dataUrlParts(body.result);
      assert.equal(parsed.mime, 'image/png', path);
      assert.equal(parsed.buf.subarray(0, 8).toString('hex'), PNG_MAGIC, path);
      assert.equal((await sharp(parsed.buf).metadata()).format, 'png', path);
    }

    await twoImages('/blend', 'topImage');
    await twoImages('/embed', 'insertImage');

    async function sized(path, baseFile, topFile, topName, topType, name) {
      const fd = new FormData();
      fd.append('baseImage', new Blob([baseFile], { type: 'image/png' }), 'base.png');
      fd.append(topName, new Blob([topFile], { type: topType }), 'top.bin');
      const res = await fetch(`${base}${path}`, { method: 'POST', body: fd });
      const body = await res.json();
      assert.equal(res.status, 200, name);
      assert.equal(body.error, undefined, name);
      const parsed = dataUrlParts(body.result);
      assert.equal(parsed.buf.subarray(0, 8).toString('hex'), PNG_MAGIC, name);
      const out = await sharp(parsed.buf).metadata();
      const src = await sharp(baseFile).metadata();
      assert.equal(out.format, 'png', name);
      assert.equal(out.width, src.width, name);
      assert.equal(out.height, src.height, name);
    }

    const shortBase = await rawPng(32, 16, [70, 120, 180]);
    const tall = await rawPng(2, 64, [180, 100, 60]);
    const tiny = await rawPng(1, 1, [70, 120, 180]);
    const wideJpeg = await rawJpeg(64, 2, [180, 100, 60]);
    await sized('/blend', shortBase, tall, 'topImage', 'image/png', 'blend 32x16+2x64');
    await sized('/embed', shortBase, tall, 'insertImage', 'image/png', 'embed 32x16+2x64');
    await sized('/blend', tiny, wideJpeg, 'topImage', 'image/jpeg', 'blend 1x1');
    await sized('/embed', tiny, wideJpeg, 'insertImage', 'image/jpeg', 'embed 1x1');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
