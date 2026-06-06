import { getLangSupport } from './langSupport.js';
import { pickCorpusPlaintext } from './exampleCorpus.js';
import crypto from 'crypto';

const MAX_LEN = 96;

const STATIC_EXAMPLES = {
  des: {
    examplePlain: 'hello',
    exampleCipher: 'a3f1c8d92e4b7081:9c4e2a1f8b7d6035',
    exampleParams: '密码=secret',
  },
  '3des': {
    examplePlain: 'hello',
    exampleCipher: 'b2e8d4f1a3c90765:7f3a9c2e1d8b4056',
    exampleParams: '密码=secret',
  },
};

let rsaDemoPublicKey = null;
function getRsaDemoPublicKey() {
  if (!rsaDemoPublicKey) {
    const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    rsaDemoPublicKey = publicKey.export({ type: 'spki', format: 'pem' });
  }
  return rsaDemoPublicKey;
}

function truncate(s) {
  if (!s) return '';
  const line = String(s).replace(/\r\n/g, '\n').trim();
  if (line.length <= MAX_LEN) return line;
  return `${line.slice(0, MAX_LEN)}…`;
}

function isPlaceholder(text) {
  if (!text) return true;
  return /（[^）]*）/.test(text) || text.includes('见加密页');
}

function defaultParams(cipher) {
  const p = {};
  for (const param of cipher.params || []) {
    if (param.default !== undefined) p[param.name] = param.default;
    else if (param.type === 'number') p[param.name] = param.min ?? 0;
    else p[param.name] = '';
  }
  return p;
}

function formatParamsLabel(cipher, params) {
  if (!cipher.params?.length) return '';
  return cipher.params
    .map((p) => {
      const v = params[p.name];
      if (v === undefined || v === '') return null;
      return `${p.label || p.name}=${v}`;
    })
    .filter(Boolean)
    .join(', ');
}

function pickPlaintext(cipher) {
  const langs = getLangSupport(cipher.id);
  if (langs?.includes('zh')) return pickCorpusPlaintext(cipher.id);
  if (cipher.id === 'acrostic') return 'Secret\nmessage\nline';
  if (cipher.id === 'running-key') return 'ATTACK';
  if (cipher.category === '编码/表示' || cipher.category === '哈希/摘要') return 'hello';
  if (cipher.category === '对称加密' || cipher.category === '非对称加密') return 'secret';
  return 'HELLO';
}

const FALLBACK_PLAINS = ['HELLO', 'hello', '你好', 'A', 'test'];

export function finalizeExamples(cipher, detailPlain, generated) {
  const gen = generated || {};
  const plain = detailPlain || gen.examplePlain || '';
  if (!plain) {
    return {
      examplePlain: gen.examplePlain || '',
      exampleCipher: gen.exampleCipher || '',
      exampleParams: gen.exampleParams || '',
    };
  }

  const params = defaultParams(cipher);
  let cipherText = gen.exampleCipher || '';

  const plainLen = [...plain].length;
  const cipherLen = cipherText ? [...cipherText].length : 0;
  const needsRegen = !cipherText
    || isPlaceholder(cipherText)
    || (cipher.reversible !== false && plainLen !== cipherLen && gen.examplePlain !== plain);

  if (needsRegen) {
    try {
      const out = cipher.encrypt(plain, params);
      if (out != null) cipherText = truncate(out);
    } catch { /* keep previous */ }
  }

  return {
    examplePlain: plain,
    exampleCipher: cipherText || '',
    exampleParams: gen.exampleParams || formatParamsLabel(cipher, params),
  };
}

export function generateExample(cipher) {
  if (STATIC_EXAMPLES[cipher.id]) {
    return { ...STATIC_EXAMPLES[cipher.id] };
  }

  const params = defaultParams(cipher);
  if (cipher.id === 'rsa') {
    params.publicKey = getRsaDemoPublicKey();
  }
  const paramsLabel = formatParamsLabel(cipher, params);
  const langs = getLangSupport(cipher.id);
  const plains = langs?.includes('zh')
    ? [pickCorpusPlaintext(cipher.id)]
    : [pickPlaintext(cipher), ...FALLBACK_PLAINS];

  for (const plain of [...new Set(plains)]) {
    try {
      const out = cipher.encrypt(plain, params);
      if (out === undefined || out === null) continue;
      const cipherText = truncate(out);
      if (!cipherText && cipher.reversible !== false) continue;
      const exParams = cipher.id === 'rsa' ? '公钥 PEM（已内置示例）' : paramsLabel;
      return {
        examplePlain: plain,
        exampleCipher: cipherText,
        exampleParams: exParams,
      };
    } catch { /* try next plaintext */ }
  }

  return { examplePlain: pickPlaintext(cipher), exampleCipher: '', exampleParams: paramsLabel };
}

export function buildExampleCache(registry) {
  const cache = {};
  for (const c of registry) {
    cache[c.id] = generateExample(c);
  }
  return cache;
}

export { isPlaceholder, truncate };
