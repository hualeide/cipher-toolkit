import express from 'express';
import {
  getCipherMeta,
  encrypt,
  decrypt,
  registry,
} from '../ciphers/registry.js';
import { identify, autoChainDecrypt, chainDecrypt } from '../services/identifier.js';
import { analyzeText } from '../services/textAnalysis.js';
import { formatConvert, listFormats } from '../services/formatConvert.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 32 * 1024 * 1024 } });

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ count: registry.length, ciphers: getCipherMeta() });
});

router.get('/categories', (_req, res) => {
  res.json([...new Set(registry.map((c) => c.category))]);
});

router.get('/:id', (req, res) => {
  const meta = getCipherMeta().find((c) => c.id === req.params.id);
  if (!meta) return res.status(404).json({ error: '未找到' });
  res.json(meta);
});

router.post('/encrypt', (req, res) => {
  try {
    const { id, text, params } = req.body;
    if (!id || text === undefined) return res.status(400).json({ error: '需要 id 和 text' });
    res.json({ result: encrypt(id, text, params || {}) });
  } catch (e) {
    res.status(400).json({ error: e.message, code: e.code, scripts: e.scripts });
  }
});

router.post('/decrypt', (req, res) => {
  try {
    const { id, text, params } = req.body;
    if (!id || text === undefined) return res.status(400).json({ error: '需要 id 和 text' });
    res.json({ result: decrypt(id, text, params || {}) });
  } catch (e) {
    res.status(400).json({ error: e.message, code: e.code, scripts: e.scripts });
  }
});

router.post('/analyze', (req, res) => {
  try {
    const { text } = req.body;
    if (text === undefined) return res.status(400).json({ error: '需要 text' });
    res.json(analyzeText(String(text)));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/identify', (req, res) => {
  try {
    const { text, limit, minScore, extraKeys } = req.body;
    if (text === undefined) return res.status(400).json({ error: '需要 text' });
    const matches = identify(text, { limit: limit || 15, minScore: minScore || 30, extraKeys: extraKeys || [] });
    res.json({ matches });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/chain-decrypt', (req, res) => {
  try {
    const { text, chain, steps } = req.body;
    if (!text) return res.status(400).json({ error: '需要 text' });
    const stepList = steps || (Array.isArray(chain) ? chain.map((id) => ({ id })) : []);
    res.json(chainDecrypt(text, stepList));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/formats', (_req, res) => {
  res.json(listFormats());
});

router.post('/format-convert', (req, res) => {
  try {
    const { text, from, to } = req.body;
    if (text === undefined) return res.status(400).json({ error: '需要 text' });
    res.json({ result: formatConvert(String(text), from || 'text', to || 'hex') });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/file', upload.single('file'), (req, res) => {
  try {
    const { cipher, mode, params, encoding } = req.body;
    if (!req.file) return res.status(400).json({ error: '需要上传 file' });
    if (!cipher) return res.status(400).json({ error: '需要 cipher' });
    const parsed = params ? JSON.parse(params) : {};
    const text = req.file.buffer.toString(encoding || 'utf8');
    const fn = mode === 'decrypt' ? decrypt : encrypt;
    const result = fn(cipher, text, parsed);
    res.json({
      result,
      cipher,
      mode: mode === 'decrypt' ? 'decrypt' : 'encrypt',
      bytesIn: req.file.buffer.length,
      bytesOut: Buffer.byteLength(result, encoding || 'utf8'),
    });
  } catch (e) {
    res.status(400).json({ error: e.message, code: e.code, scripts: e.scripts });
  }
});

router.post('/auto-chain', (req, res) => {
  try {
    const { text, maxDepth } = req.body;
    if (text === undefined) return res.status(400).json({ error: '需要 text' });
    res.json({ chains: autoChainDecrypt(text, maxDepth || 2) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
