import { Router } from 'express';
import multer from 'multer';
import {
  createMirageTank, simulateMiragePreview, blendImages, embedImage,
  convertImage, upscaleImage, denoiseImage, getImageInfo, toDataUrl,
  embedLsbText, extractLsbText,
} from '../services/imageProcess.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();

function ok(res, buffer, extra = {}) {
  res.json({ result: toDataUrl(buffer), ...extra });
}

router.post('/mirage-tank', upload.fields([
  { name: 'whiteImage', maxCount: 1 },
  { name: 'blackImage', maxCount: 1 },
]), async (req, res) => {
  try {
    const w = req.files?.whiteImage?.[0]?.buffer;
    const b = req.files?.blackImage?.[0]?.buffer;
    if (!w || !b) return res.status(400).json({ error: '需要 whiteImage + blackImage' });
    const opts = { size: req.body.size, colorBoost: req.body.colorBoost };
    const out = await createMirageTank(w, b, opts);
    const previews = await simulateMiragePreview(out);
    res.json({
      result: toDataUrl(out),
      previewWhite: toDataUrl(previews.onWhite),
      previewBlack: toDataUrl(previews.onBlack),
      colorMode: 'rgb',
      mime: 'image/png',
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/blend', upload.fields([
  { name: 'baseImage', maxCount: 1 },
  { name: 'topImage', maxCount: 1 },
]), async (req, res) => {
  try {
    const base = req.files?.baseImage?.[0]?.buffer;
    const top = req.files?.topImage?.[0]?.buffer;
    if (!base || !top) return res.status(400).json({ error: '需要 baseImage + topImage' });
    const out = await blendImages(base, top, {
      mode: req.body.mode || 'over',
      opacity: req.body.opacity,
      x: req.body.x, y: req.body.y, scale: req.body.scale,
    });
    ok(res, out, { mode: req.body.mode });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/embed', upload.fields([
  { name: 'baseImage', maxCount: 1 },
  { name: 'insertImage', maxCount: 1 },
]), async (req, res) => {
  try {
    const base = req.files?.baseImage?.[0]?.buffer;
    const ins = req.files?.insertImage?.[0]?.buffer;
    if (!base || !ins) return res.status(400).json({ error: '需要 baseImage + insertImage' });
    const out = await embedImage(base, ins, {
      opacity: req.body.opacity,
      scale: req.body.scale,
      position: req.body.position,
      x: req.body.x, y: req.body.y,
      feather: req.body.feather,
    });
    ok(res, out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '需要上传文件' });
    const format = req.body.format || 'png';
    const out = await convertImage(req.file.buffer, format, { quality: req.body.quality });
    const mimeMap = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', tiff: 'image/tiff', gif: 'image/gif' };
    const info = await getImageInfo(out);
    res.json({ result: toDataUrl(out, mimeMap[format.toLowerCase()] || 'image/png'), format, info, mime: mimeMap[format.toLowerCase()] });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/upscale', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '需要上传图片' });
    const before = await getImageInfo(req.file.buffer);
    const out = await upscaleImage(req.file.buffer, Number(req.body.scale) || 2, { denoiseFirst: req.body.denoiseFirst === 'true' });
    const after = await getImageInfo(out);
    res.json({ result: toDataUrl(out), scale: req.body.scale, before, after });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/denoise', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '需要上传图片' });
    const out = await denoiseImage(req.file.buffer, Number(req.body.strength) || 2);
    ok(res, out, { strength: req.body.strength });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/stego/embed', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '需要上传 PNG 图片' });
    const text = req.body.text;
    if (!text) return res.status(400).json({ error: '需要 text' });
    const out = await embedLsbText(req.file.buffer, text);
    ok(res, out, { textLength: String(text).length, mime: 'image/png' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/stego/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '需要上传 PNG 图片' });
    const text = await extractLsbText(req.file.buffer);
    res.json({ text, length: text.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/formats', (_req, res) => {
  res.json(['png', 'jpeg', 'webp', 'avif', 'tiff', 'gif', 'bmp']);
});

router.get('/blend-modes', (_req, res) => {
  res.json([
    { id: 'over', name: '正常叠加' },
    { id: 'multiply', name: '正片叠底' },
    { id: 'screen', name: '滤色' },
    { id: 'overlay', name: '叠加' },
    { id: 'soft-light', name: '柔光' },
    { id: 'hard-light', name: '强光' },
    { id: 'darken', name: '变暗' },
    { id: 'lighten', name: '变亮' },
  ]);
});

export default router;
