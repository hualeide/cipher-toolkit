import sharp from 'sharp';

export function toDataUrl(buffer, mime = 'image/png') {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function loadRaw(buffer, width, height) {
  return sharp(buffer)
    .resize(width, height, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

/** 彩色幻影坦克：RGB 三通道分别运算，保留彩色 */
export async function createMirageTank(whiteBuf, blackBuf, opts = {}) {
  const size = Math.min(Math.max(Number(opts.size) || 800, 128), 2048);
  const colorBoost = Math.min(Math.max(Number(opts.colorBoost) || 1, 0.5), 1.5);
  const [a, b] = await Promise.all([
    loadRaw(whiteBuf, size, size),
    loadRaw(blackBuf, size, size),
  ]);
  const { width, height } = a.info;
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const ai = i * 4;
    const bi = i * 4;
    const oi = i * 4;
    for (let c = 0; c < 3; c++) {
      const av = a.data[ai + c];
      const bv = b.data[bi + c];
      let v = (av + (255 - bv)) / 2;
      v = 128 + (v - 128) * colorBoost;
      pixels[oi + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    pixels[oi + 3] = 255;
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 6 }).toBuffer();
}

/** 模拟贴白/黑底后的视觉效果（彩色合成预览） */
export async function simulateMiragePreview(mirageBuf) {
  const { data, info } = await sharp(mirageBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const onWhite = Buffer.alloc(data.length);
  const onBlack = Buffer.alloc(data.length);
  for (let i = 0; i < info.width * info.height; i++) {
    const si = i * 4;
    for (let c = 0; c < 3; c++) {
      const g = data[si + c];
      onWhite[si + c] = Math.round((g * 2 + 255) / 3);
      onBlack[si + c] = Math.round((g * 2) / 3);
    }
    onWhite[si + 3] = onBlack[si + 3] = 255;
  }
  const mk = (buf) => sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return { onWhite: await mk(onWhite), onBlack: await mk(onBlack) };
}

/** 图片融合：底图 + 上层，多种混合模式 */
export async function blendImages(baseBuf, topBuf, opts = {}) {
  const mode = opts.mode || 'overlay';
  const opacity = Math.min(Math.max(Number(opts.opacity) ?? 0.85, 0), 1);
  const x = Math.round(Number(opts.x) || 0);
  const y = Math.round(Number(opts.y) || 0);
  const scale = Math.min(Math.max(Number(opts.scale) || 1, 0.1), 3);

  const base = sharp(baseBuf);
  const meta = await base.metadata();
  const bw = meta.width || 800;
  const bh = meta.height || 600;

  const tw = Math.round(bw * scale * 0.5);
  const top = await sharp(topBuf).resize(tw, null, { fit: 'inside' }).ensureAlpha().toBuffer();
  const topMeta = await sharp(top).metadata();

  const composites = [{
    input: top,
    left: Math.max(0, Math.min(x, bw - (topMeta.width || tw))),
    top: Math.max(0, Math.min(y, bh - (topMeta.height || tw))),
    blend: mode === 'normal' ? 'over' : mode,
  }];

  let pipeline = base.composite(composites);
  if (opacity < 1) {
    const blended = await pipeline.png().toBuffer();
    const faded = await sharp(top).ensureAlpha().linear([1, 1, 1, opacity], [0, 0, 0, 0]).toBuffer();
    return sharp(baseBuf)
      .resize(bw, bh)
      .composite([{
        input: faded,
        left: Math.max(0, Math.min(x, bw - (topMeta.width || tw))),
        top: Math.max(0, Math.min(y, bh - (topMeta.height || tw))),
        blend: 'over',
      }])
      .png()
      .toBuffer();
  }
  return pipeline.png().toBuffer();
}

/** 一图融入另一图：自动居中或指定位置，带羽化边缘 */
export async function embedImage(baseBuf, insertBuf, opts = {}) {
  const opacity = Math.min(Math.max(Number(opts.opacity) ?? 0.92, 0), 1);
  const scale = Math.min(Math.max(Number(opts.scale) || 0.45, 0.05), 1);
  const feather = Math.min(Math.max(Number(opts.feather) || 8, 0), 40);
  const position = opts.position || 'center';

  const baseMeta = await sharp(baseBuf).metadata();
  const bw = baseMeta.width || 800;
  const bh = baseMeta.height || 600;
  const iw = Math.round(bw * scale);
  let insert = sharp(insertBuf).resize(iw, null, { fit: 'inside' }).ensureAlpha();

  if (feather > 0) {
    insert = insert.blur(Math.max(0.3, feather * 0.15));
  }
  const insertPng = await insert.toBuffer();
  const im = await sharp(insertPng).metadata();
  const iw2 = im.width || iw;
  const ih2 = im.height || iw;

  let left = Math.round((bw - iw2) / 2);
  let top = Math.round((bh - ih2) / 2);
  if (position === 'bottom-right') { left = bw - iw2 - 20; top = bh - ih2 - 20; }
  if (position === 'top-left') { left = 20; top = 20; }
  if (position === 'custom') {
    left = Math.round(Number(opts.x) ?? left);
    top = Math.round(Number(opts.y) ?? top);
  }

  const faded = await sharp(insertPng)
    .ensureAlpha()
    .linear([1, 1, 1, opacity], [0, 0, 0, 0])
    .toBuffer();

  return sharp(baseBuf)
    .resize(bw, bh)
    .composite([{ input: faded, left: Math.max(0, left), top: Math.max(0, top), blend: 'over' }])
    .png()
    .toBuffer();
}

export async function convertImage(buffer, format, opts = {}) {
  const fmt = format.toLowerCase();
  const quality = Math.min(Math.max(Number(opts.quality) || 90, 1), 100);
  let img = sharp(buffer);
  switch (fmt) {
    case 'png': return img.png({ compressionLevel: 6 }).toBuffer();
    case 'jpeg':
    case 'jpg': return img.jpeg({ quality, mozjpeg: true }).toBuffer();
    case 'webp': return img.webp({ quality }).toBuffer();
    case 'avif': return img.avif({ quality: Math.min(quality, 85) }).toBuffer();
    case 'tiff': return img.tiff({ quality }).toBuffer();
    case 'gif': return img.gif().toBuffer();
    case 'bmp': return img.png().toBuffer();
    default: throw new Error(`不支持格式: ${format}`);
  }
}

export async function upscaleImage(buffer, scale = 2, opts = {}) {
  const meta = await sharp(buffer).metadata();
  const s = Math.min(Math.max(Number(scale) || 2, 1), 4);
  let w = meta.width || 256;
  let h = meta.height || 256;

  let img = sharp(buffer);
  if (opts.denoiseFirst) img = img.median(3);

  for (let step = 0; step < Math.ceil(Math.log2(s)); step++) {
    w = Math.min(Math.round(w * 2), (meta.width || 256) * s);
    h = Math.min(Math.round(h * 2), (meta.height || 256) * s);
    img = img.resize(w, h, { kernel: sharp.kernel.lanczos3 });
  }
  const finalW = Math.round((meta.width || 256) * s);
  const finalH = Math.round((meta.height || 256) * s);
  return img
    .resize(finalW, finalH, { kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 1, m1: 1.2, m2: 0.6 })
    .modulate({ brightness: 1.02, saturation: 1.05 })
    .png()
    .toBuffer();
}

export async function denoiseImage(buffer, strength = 2, opts = {}) {
  const s = Math.min(Math.max(Number(strength) || 2, 1), 5);
  const median = s % 2 === 0 ? s + 1 : s;
  let img = sharp(buffer);
  if (opts.preserveEdges !== false) {
    img = img.median(median).blur(Math.max(0.3, s * 0.15));
  }
  return img
    .sharpen({ sigma: 0.4 + s * 0.1, m1: 1, m2: 0.4 })
    .normalise()
    .png()
    .toBuffer();
}

export async function getImageInfo(buffer) {
  const m = await sharp(buffer).metadata();
  return { width: m.width, height: m.height, format: m.format, size: buffer.length };
}

/** PNG LSB 藏文 — RGB 最低位嵌入 UTF-8（4 字节大端长度前缀） */
export async function embedLsbText(imageBuf, text) {
  const msg = String(text ?? '');
  const { data, info } = await sharp(imageBuf).png().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const payload = Buffer.from(msg, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payload.length, 0);
  const bits = [];
  for (const byte of [...header, ...payload]) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  const capacity = info.width * info.height * 3;
  if (bits.length > capacity) throw new Error(`图片容量不足：需要 ${bits.length} 位，可用 ${capacity} 位`);

  const ch = info.channels || 4;
  const out = Buffer.from(data);
  let bi = 0;
  for (let i = 0; i < out.length && bi < bits.length; i += ch) {
    for (let c = 0; c < 3 && bi < bits.length; c++) {
      out[i + c] = (out[i + c] & 0xfe) | bits[bi++];
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: ch } })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

export async function extractLsbText(imageBuf) {
  const { data, info } = await sharp(imageBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels || 4;
  const bits = [];
  for (let i = 0; i < data.length; i += ch) {
    for (let c = 0; c < 3; c++) bits.push(data[i + c] & 1);
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    bytes.push(b);
  }
  if (bytes.length < 4) throw new Error('未检测到藏文');
  const len = Buffer.from(bytes.slice(0, 4)).readUInt32BE(0);
  if (!len || 4 + len > bytes.length) throw new Error('藏文长度无效');
  return Buffer.from(bytes.slice(4, 4 + len)).toString('utf8');
}
