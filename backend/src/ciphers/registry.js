import * as E from './engine.js';
import * as M from './cryptoModern.js';
import * as S from './specialCiphers.js';
import * as U from './unicodeCipher.js';
import { enrichCipherMeta } from './cipherDetails.js';
import { getLangSupport, MULTILINGUAL_KEYS, assertTextLangSupported } from './langSupport.js';
import { cipherRequiresKey } from './cipherMeta.js';
import { buildExampleCache } from './cipherExamples.js';
import { formatConvert } from '../services/formatConvert.js';

const COPRIME_A = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];
const COMMON_KEYS = ['KEY', 'SECRET', 'PASSWORD', 'CIPHER', 'CRYPTO', 'CODE', 'LOCK', 'AGENT', 'HIDDEN', 'TEST', 'KEYWORD', 'secret'];

function def(cfg) {
  return {
    reversible: cfg.reversible !== false,
    identifiable: cfg.identifiable !== false,
    ...cfg,
  };
}

function shifts(n, max = 25) {
  return Array.from({ length: max }, (_, i) => ({ [n]: i + 1 }));
}

function railsRange(max = 15) {
  return Array.from({ length: max - 1 }, (_, i) => ({ rails: i + 2 }));
}

function commonKeyParams(field = 'key') {
  return COMMON_KEYS.map((k) => ({ [field]: k }));
}

function multilingualKeyParams(field = 'key') {
  return MULTILINGUAL_KEYS.map((k) => ({ [field]: k }));
}

function affineParams() {
  const out = [];
  const seen = new Set();
  const add = (a, b) => {
    const k = `${a}:${b}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ a, b });
  };
  for (const b of [7, 8, 3, 11, 17, 0, 1, 2, 4, 5, 6, 9, 10, 12, 13, 14, 15]) add(5, b);
  for (const a of COPRIME_A) {
    for (let b = 0; b < 26; b++) add(a, b);
  }
  return out;
}

function formatParams(cipher, params) {
  if (!params || !Object.keys(params).length) return '默认参数';
  return cipher.params
    ?.map((p) => {
      const v = params[p.name];
      if (v === undefined) return null;
      return `${p.label || p.name}=${v}`;
    })
    .filter(Boolean)
    .join(', ') || JSON.stringify(params);
}

export const registry = [
  def({
    id: 'caesar', name: '凯撒密码', category: '古典替换',
    description: '将字母表中的每个字母向后移动固定位数。中文、日文、韩文及标点会在 Unicode 码点域同步移位。',
    usage: '设置移位量（1-25），加密时向后移，解密时向前移。英文 A→D（移位3）；中文「你好」→ 另一组汉字。',
    history: '公元前1世纪，凯撒在《高卢战记》通信中使用移位 3 的版本。',
    params: [{ name: 'shift', label: '移位量', type: 'number', default: 3, min: 1, max: 25 }],
    getIdentifyParams: () => shifts('shift', 25),
    encrypt: (t, p) => E.caesar(t, Number(p.shift ?? 3)),
    decrypt: (t, p) => E.caesar(t, -Number(p.shift ?? 3)),
  }),

  def({
    id: 'rot13', name: 'ROT13', category: '古典替换',
    description: '移位 13 的凯撒密码。含中文/日文/韩文时在 Unicode 码点域同步移位 13。',
    usage: '无需密钥。英文 ROT13 自逆；多语言文本请用解密（反向移位 13）。',
    params: [],
    encrypt: (t) => E.rot13(t),
    decrypt: (t) => E.caesar(t, -13),
  }),

  def({
    id: 'rot47', name: 'ROT47', category: '古典替换',
    description: '对 ASCII 可打印字符 (33-126) 循环移位 47 位，可处理字母、数字和符号。',
    usage: '加解密为同一操作，适合含标点的文本。',
    params: [],
    encrypt: (t) => E.rot47(t, 1),
    decrypt: (t) => E.rot47(t, -1),
  }),

  def({
    id: 'rot5', name: 'ROT5 (数字)', category: '古典替换',
    description: '仅对数字 0-9 循环移位 5 位，字母不变。',
    usage: '常与 ROT13 组合为 ROT18。',
    params: [],
    encrypt: (t) => E.rot5(t, 1),
    decrypt: (t) => E.rot5(t, -1),
  }),

  def({
    id: 'rot18', name: 'ROT18', category: '古典替换',
    description: 'ROT13 + ROT5 组合，同时处理字母和数字。',
    usage: '先字母 ROT13，再数字 ROT5。',
    params: [],
    encrypt: (t) => E.rot18(t, false),
    decrypt: (t) => E.rot18(t, true),
  }),

  def({
    id: 'rot-all', name: '全字符 ROT', category: '古典替换',
    description: '同时对字母和数字进行相同移位量的循环移位。',
    usage: '设置移位量 n，字母 mod 26，数字 mod 10。',
    params: [{ name: 'n', label: '移位量', type: 'number', default: 5, min: 1, max: 25 }],
    getIdentifyParams: () => shifts('n', 15),
    encrypt: (t, p) => E.rotAll(t, Number(p.n ?? 5), false),
    decrypt: (t, p) => E.rotAll(t, Number(p.n ?? 5), true),
  }),

  def({
    id: 'atbash', name: 'Atbash 密码', category: '古典替换',
    description: 'A↔Z, B↔Y, C↔X 首尾对称替换，源自希伯来字母表。',
    usage: '无需密钥，加密解密相同。',
    params: [],
    encrypt: E.atbash, decrypt: E.atbash,
  }),

  def({
    id: 'affine', name: '仿射密码', category: '古典替换',
    description: '公式 E(x) = (ax + b) mod 26。a 必须与 26 互质。',
    usage: '设置参数 a 和 b。常见 a 值：3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25。',
    params: [
      { name: 'a', label: '乘数 a', type: 'number', default: 5, min: 1, max: 25 },
      { name: 'b', label: '加数 b', type: 'number', default: 7, min: 0, max: 25 },
    ],
    getIdentifyParams: affineParams,
    encrypt: (t, p) => E.affine(t, Number(p.a ?? 5), Number(p.b ?? 7), false),
    decrypt: (t, p) => E.affine(t, Number(p.a ?? 5), Number(p.b ?? 7), true),
  }),

  def({
    id: 'keyword-sub', name: '关键字替换密码', category: '古典替换',
    description: '用关键字构建替换字母表：先写密钥不重复字母，再补全剩余字母。',
    usage: '输入关键字（如 SECRET），仅替换 A-Z 字母。',
    params: [{ name: 'keyword', label: '关键字', type: 'text', default: 'SECRET' }],
    getIdentifyParams: () => commonKeyParams('keyword'),
    encrypt: (t, p) => E.keywordSub(t, p.keyword || 'SECRET', false),
    decrypt: (t, p) => E.keywordSub(t, p.keyword || 'SECRET', true),
  }),

  def({
    id: 'playfair', name: 'Playfair 密码', category: '古典替换',
    description: '5×5 密钥方阵对字母对 digraph 加密：同行左右移、同列上下移、否则矩形对角。比单表替换更安全，一战二战电报常用。',
    usage: '输入密钥构建方阵（I/J 合并）；明文两两分组，重复字母间插 X；仅 A-Z。',
    params: [{ name: 'key', label: '密钥', type: 'text', default: 'KEYWORD' }],
    getIdentifyParams: () => commonKeyParams('key'),
    encrypt: (t, p) => E.playfair(t, p.key || 'KEYWORD', false),
    decrypt: (t, p) => E.playfair(t, p.key || 'KEYWORD', true),
  }),

  def({
    id: 'vigenere', name: '维吉尼亚密码', category: '多表替换',
    description: '使用 repeating 密钥的多表凯撒密码。明文与密钥均支持中文、日文、韩文及英文混合。',
    usage: '密钥可为「密钥」「密码」「KEY」或日文、韩文等任意字符，逐字循环驱动移位。',
    params: [{ name: 'key', label: '密钥', type: 'text', default: '密钥' }],
    getIdentifyParams: () => multilingualKeyParams('key'),
    encrypt: (t, p) => E.vigenere(t, p.key || '密钥', false),
    decrypt: (t, p) => E.vigenere(t, p.key || '密钥', true),
  }),

  def({
    id: 'beaufort', name: 'Beaufort 密码', category: '多表替换',
    description: '密钥字母减去明文字母 mod 26，与维吉尼亚方向相反。支持多语言明文与中文等密钥。',
    usage: '密钥词可为中文或英文，如「密码」「SECRET」。',
    params: [{ name: 'key', label: '密钥', type: 'text', default: '密钥' }],
    getIdentifyParams: () => multilingualKeyParams('key'),
    encrypt: (t, p) => E.beaufort(t, p.key || '密钥'),
    decrypt: (t, p) => E.beaufort(t, p.key || '密钥'),
  }),

  def({
    id: 'autokey', name: 'Autokey 密码', category: '多表替换',
    description: '密钥启动后，用明文/密文自身扩展密钥流。起始密钥可为中文、日文、韩文或英文。',
    usage: '输入起始密钥，如「密钥」或 KEY。',
    params: [{ name: 'key', label: '起始密钥', type: 'text', default: '密钥' }],
    getIdentifyParams: () => multilingualKeyParams('key'),
    encrypt: (t, p) => E.autokey(t, p.key || '密钥', false),
    decrypt: (t, p) => E.autokey(t, p.key || '密钥', true),
  }),

  def({
    id: 'gronsfeld', name: 'Gronsfeld 密码', category: '多表替换',
    description: '维吉尼亚的数字变体，每位数字决定移位量。',
    usage: '输入数字密钥，如 31415。',
    params: [{ name: 'key', label: '数字密钥', type: 'text', default: '314' }],
    getIdentifyParams: () => ['123', '314', '271828', '12345', '999'].map((k) => ({ key: k })),
    encrypt: (t, p) => E.gronsfeld(t, p.key || '314', false),
    decrypt: (t, p) => E.gronsfeld(t, p.key || '314', true),
  }),

  def({
    id: 'rail-fence', name: '栅栏密码', category: '换位密码',
    description: '将文本按锯齿形写入多行后按行读出，属于换位密码。',
    usage: '设置栏数（2-20），栏数越多结构越复杂。',
    params: [{ name: 'rails', label: '栏数', type: 'number', default: 3, min: 2, max: 20 }],
    getIdentifyParams: railsRange,
    encrypt: (t, p) => E.railFence(t, Number(p.rails ?? 3), false),
    decrypt: (t, p) => E.railFence(t, Number(p.rails ?? 3), true),
  }),

  def({
    id: 'columnar', name: '列移位密码', category: '换位密码',
    description: '按密钥字母顺序重排列，明文写入网格后按列读出。',
    usage: '输入列密钥词，不足补 X。',
    params: [{ name: 'key', label: '列密钥', type: 'text', default: 'CIPHER' }],
    getIdentifyParams: () => commonKeyParams('key'),
    encrypt: (t, p) => E.columnarTransposition(t, p.key || 'CIPHER', false),
    decrypt: (t, p) => E.columnarTransposition(t, p.key || 'CIPHER', true),
  }),

  def({
    id: 'scytale', name: 'Skytale 木棍密码', category: '换位密码',
    description: '古希腊 Spartans 使用的 transposition 密码，纸条缠绕木棍读写。',
    usage: '设置木棍直径（列数）。',
    params: [{ name: 'diameter', label: '直径/列数', type: 'number', default: 5, min: 2, max: 20 }],
    getIdentifyParams: () => Array.from({ length: 14 }, (_, i) => ({ diameter: i + 3 })),
    encrypt: (t, p) => E.scytale(t, Number(p.diameter ?? 5), false),
    decrypt: (t, p) => E.scytale(t, Number(p.diameter ?? 5), true),
  }),

  def({
    id: 'morse', name: '摩斯电码', category: '编码/表示',
    description: '国际摩斯（A–Z/0–9）；中文模式用标准电报码（四位数字发码，约七千字）。',
    usage: '含中文时默认自动切电报码；可手动选模式。',
    params: [{
      name: 'variant',
      label: '模式',
      type: 'select',
      default: 'auto',
      options: [
        { value: 'auto', label: '自动' },
        { value: 'intl', label: '国际（字母）' },
        { value: 'zh', label: '中文电报码' },
      ],
    }],
    encrypt: (t, p) => E.morseEncode(t, p?.variant || 'auto'),
    decrypt: (t, p) => E.morseDecode(t, p?.variant || 'auto'),
  }),
  ...encode('binary', '二进制编码', '编码/表示', '每字符 8 位二进制，空格分隔。', E.binaryEncode, E.binaryDecode),
  ...encode('hex', '十六进制', '编码/表示', '每字节两位十六进制。', E.hexEncode, E.hexDecode),
  ...encode('octal', '八进制', '编码/表示', 'ASCII 八进制表示。', E.octalEncode, E.octalDecode),
  ...encode('base64', 'Base64', '编码/表示', 'RFC 4648，HTTP/邮件常用编码。', E.base64Encode, E.base64Decode),
  ...encode('base32', 'Base32', '编码/表示', 'Base32 字母数字编码。', E.base32Encode, E.base32Decode),
  ...encode('url', 'URL 编码', '编码/表示', 'Percent-encoding，%XX 形式。', E.urlEncode, E.urlDecode),
  ...encode('html-entities', 'HTML 实体', '编码/表示', '&amp; &lt; 等 HTML 转义。', E.htmlEntitiesEncode, E.htmlEntitiesDecode),
  ...encode('unicode-escape', 'Unicode 转义', '编码/表示', '\\uXXXX JavaScript 风格。', E.unicodeEscapeEncode, E.unicodeEscapeDecode),
  ...encode('quoted-printable', 'Quoted-Printable', '编码/表示', '邮件 MIME 编码，=XX 表示非 ASCII。', E.quotedPrintableEncode, E.quotedPrintableDecode),
  ...encode('ascii85', 'Ascii85', '编码/表示', 'Adobe Base85，<~ ~> 包裹。', E.ascii85Encode, E.ascii85Decode),
  ...encode('bacon', 'Bacon 密码', '编码/表示', 'Francis Bacon 用 a/b 双字母组表示 5 位。', E.baconEncode, E.baconDecode),
  ...encode('tap-code', 'Tap Code', '编码/表示', '5×5 网格坐标，监狱通信用。', E.tapCodeEncode, E.tapCodeDecode),

  def({
    id: 'semaphore', name: '旗语密码', category: '编码/表示',
    description: '国际海事旗语：每个字母用两面旗的方向组合表示。CTF/密码吧视觉题常见。',
    usage: '加密得方向符号；解密时粘贴符号，每组两面旗以空格分隔。',
    params: [],
    getIdentifyParams: () => [{}],
    encrypt: (t) => S.semaphoreEncode(t),
    decrypt: (t) => S.semaphoreDecode(t),
  }),
  ...encode('polybius', 'Polybius 方阵', '编码/表示', '5×5 坐标 (行,列) 表字母。', E.polybiusEncode, E.polybiusDecode),
  ...encode('nato', 'NATO 音标', '编码/表示', 'Alpha Bravo Charlie 军事拼读。', E.natoEncode, E.natoDecode),
  ...encode('braille', '盲文映射', '编码/表示', '字母到 Unicode 盲文字符。', E.brailleEncode, E.brailleDecode),
  ...encode('fullwidth', '全角字符', '编码/表示', '半角 ASCII 转全角 Unicode。', E.fullwidthEncode, E.fullwidthDecode),
  ...encode('zero-width', '零宽隐写', '编码/表示', '零宽字符编码隐藏信息。', E.zeroWidthEncode, E.zeroWidthDecode),
  ...encode('gzip-base64', 'Gzip+Base64', '编码/表示', '先 gzip 压缩再 Base64 编码。', M.gzipBase64Encode, M.gzipBase64Decode),

  def({
    id: 'format-convert', name: '格式转换', category: '编码/表示',
    identifiable: false,
    description: 'text / hex / base64 / binary 互转，便于组合链拼接。',
    usage: '设置源格式 from 与目标格式 to，如 text→hex、hex→base64。',
    params: [
      {
        name: 'from', label: '源格式', type: 'select', default: 'text',
        options: [
          { value: 'text', label: '文本' },
          { value: 'hex', label: '十六进制' },
          { value: 'base64', label: 'Base64' },
          { value: 'binary', label: '二进制' },
        ],
      },
      {
        name: 'to', label: '目标格式', type: 'select', default: 'hex',
        options: [
          { value: 'text', label: '文本' },
          { value: 'hex', label: '十六进制' },
          { value: 'base64', label: 'Base64' },
          { value: 'binary', label: '二进制' },
        ],
      },
    ],
    encrypt: (t, p) => formatConvert(t, p?.from || 'text', p?.to || 'hex'),
    decrypt: (t, p) => formatConvert(t, p?.to || 'hex', p?.from || 'text'),
  }),

  def({
    id: 'jwt', name: 'JWT 解析', category: '编码/表示',
    description: 'JSON Web Token：header.payload.signature 三段 Base64URL，用于 API/OAuth 鉴权。本工具解码 header 与 payload JSON，不验证签名。',
    usage: '粘贴 eyJ… 三段式令牌（可含 Bearer 前缀）；查看 alg、sub、exp 等声明，勿将未验签内容当信任依据。',
    history: 'RFC 7519，Web/API 鉴权常用格式。',
    params: [],
    encrypt: (t) => E.jwtEncode(t, {}),
    decrypt: (t) => E.jwtDecode(t),
  }),

  def({
    id: 'phone-keypad', name: '手机键盘码', category: '编码/表示',
    description: '电话键盘数字对应字母（简化版）。', usage: '2=ABC, 3=DEF…',
    params: [], encrypt: E.phoneKeypadEncode, decrypt: E.phoneKeypadDecode,
  }),

  def({
    id: 'reverse', name: '文本反转', category: '文本变换',
    description: '字符顺序完全颠倒。', usage: 'hello → olleh',
    params: [], encrypt: E.reverseText, decrypt: E.reverseText,
  }),

  def({
    id: 'swap-case', name: '大小写互换', category: '文本变换',
    description: '大写变小写，小写变大写。', usage: 'Hello → hELLO',
    params: [], encrypt: E.swapCase, decrypt: E.swapCase,
  }),

  def({
    id: 'leet', name: 'Leet Speak', category: '文本变换',
    description: 'a→4, e→3, o→0 等黑客文字。', usage: 'elite → 3lit3',
    params: [], encrypt: E.leetEncode, decrypt: E.leetDecode,
  }),

  def({
    id: 'pig-latin', name: 'Pig Latin', category: '文本变换',
    description: '英语 Pig Latin 变形。', usage: 'hello → ellohay',
    params: [], encrypt: E.pigLatinEncode, decrypt: E.pigLatinDecode,
  }),

  def({
    id: 'upside-down', name: '倒置文字', category: '文本变换',
    description: 'Unicode 倒置字符 + 反转。', usage: '趣味文本效果',
    params: [], encrypt: E.upsideDown, decrypt: E.upsideDownDecode,
  }),

  def({
    id: 'bubble', name: 'Bubble 数学字母', category: '文本变换',
    description: 'Unicode 数学双线字母。', usage: 'ABC → 𝐀𝐁𝐂',
    params: [], encrypt: E.bubbleText, decrypt: E.bubbleTextDecode,
  }),

  def({
    id: 'even-odd-split', name: '奇偶拆分', category: '文本变换',
    description: '偶数位在前、奇数位在后。', usage: 'abcdef → acebdf',
    params: [], encrypt: E.evenOddSplit, decrypt: E.evenOddMerge,
  }),

  def({
    id: 'keyboard-shift', name: 'QWERTY 键盘移位', category: '文本变换',
    description: '字母替换为键盘同行右移键位。', usage: '设置移位 1-5',
    params: [{ name: 'shift', label: '移位', type: 'number', default: 1, min: 1, max: 5 }],
    getIdentifyParams: () => shifts('shift', 5),
    encrypt: (t, p) => E.keyboardShift(t, Number(p.shift ?? 1)),
    decrypt: (t, p) => E.keyboardShiftDecode(t, Number(p.shift ?? 1)),
  }),

  def({
    id: 'xor', name: 'XOR 异或', category: '对称加密',
    description: '逐字节异或，简单对称加密。', usage: '输入密钥字节 (0-255)',
    params: [{ name: 'keyByte', label: '密钥字节', type: 'number', default: 66, min: 0, max: 255 }],
    getIdentifyParams: () => [{ keyByte: 66 }, ...[0x13, 0x42, 0x55, 0x7F, 0xAA, 0xFF, 0x01, 0x20, 42].map((k) => ({ keyByte: k }))],
    encrypt: (t, p) => E.xorCipher(t, Number(p.keyByte ?? 66)),
    decrypt: (t, p) => E.xorCipher(t, Number(p.keyByte ?? 66)),
  }),

  def({
    id: 'rc4', name: 'RC4 流密码', category: '对称加密',
    description: '经典流密码，SSL/TLS 曾广泛使用（已弃用）。', usage: '输入字符串密钥',
    params: [{ name: 'key', label: '密钥', type: 'text', default: 'secret' }],
    getIdentifyParams: () => [{ key: 'secret' }, ...commonKeyParams('key')],
    encrypt: (t, p) => M.rc4(t, p.key || 'secret'),
    decrypt: (t, p) => M.rc4(t, p.key || 'secret'),
  }),

  def({
    id: 'aes-256-cbc', name: 'AES-256-CBC', category: '对称加密',
    description: '高级加密标准 AES，256 位密钥 CBC 模式，现代最常用对称加密之一。',
    usage: '输入密码短语，输出 iv:ciphertext 十六进制格式。',
    params: [{ name: 'password', label: '密码', type: 'password', default: 'secret' }],
    identifiable: false,
    encrypt: (t, p) => M.aesEncrypt(t, p.password, 'aes-256-cbc'),
    decrypt: (t, p) => M.aesDecrypt(t, p.password, 'aes-256-cbc'),
  }),

  def({
    id: 'aes-128-cbc', name: 'AES-128-CBC', category: '对称加密',
    description: 'AES 128 位 CBC 模式。', usage: '输入密码，需保存密文和 IV。',
    params: [{ name: 'password', label: '密码', type: 'password', default: 'secret' }],
    identifiable: false,
    encrypt: (t, p) => M.aesEncrypt(t, p.password, 'aes-128-cbc'),
    decrypt: (t, p) => M.aesDecrypt(t, p.password, 'aes-128-cbc'),
  }),

  def({
    id: 'aes-256-gcm', name: 'AES-256-GCM', category: '对称加密',
    description: 'AES-GCM 认证加密模式，提供完整性校验。',
    usage: '输入密码，输出 iv:tag:ciphertext。',
    params: [{ name: 'password', label: '密码', type: 'password', default: 'secret' }],
    identifiable: false,
    encrypt: (t, p) => M.aesEncrypt(t, p.password, 'aes-256-gcm'),
    decrypt: (t, p) => M.aesDecrypt(t, p.password, 'aes-256-gcm'),
  }),

  def({
    id: 'des', name: 'DES', category: '对称加密',
    description: '数据加密标准，56 位密钥，已被认为不安全。', usage: '输入密码短语',
    params: [{ name: 'password', label: '密码', type: 'password', default: 'secret' }],
    identifiable: false,
    encrypt: (t, p) => M.desEncrypt(t, p.password),
    decrypt: (t, p) => M.desDecrypt(t, p.password),
  }),

  def({
    id: '3des', name: '3DES (Triple DES)', category: '对称加密',
    description: '三重 DES，密钥长度 168 位有效。', usage: '输入密码短语',
    params: [{ name: 'password', label: '密码', type: 'password', default: 'secret' }],
    identifiable: false,
    encrypt: (t, p) => M.tripleDesEncrypt(t, p.password),
    decrypt: (t, p) => M.tripleDesDecrypt(t, p.password),
  }),

  def({
    id: 'md5', name: 'MD5 哈希', category: '哈希/摘要',
    description: '128 位消息摘要，已不推荐用于安全场景。单向，不可逆。',
    usage: '输入明文得到 32 位十六进制哈希。', reversible: false, identifiable: true,
    params: [],
    encrypt: M.md5Hash,
    decrypt: () => { throw new Error('MD5 是单向哈希，无法解密'); },
  }),

  def({
    id: 'sha1', name: 'SHA-1', category: '哈希/摘要',
    description: '160 位安全哈希算法，已逐步淘汰。', reversible: false,
    params: [], encrypt: M.sha1Hash,
    decrypt: () => { throw new Error('SHA-1 是单向哈希'); },
  }),

  def({
    id: 'sha256', name: 'SHA-256', category: '哈希/摘要',
    description: '256 位 SHA-2 系列，比特币、TLS 广泛使用。', reversible: false,
    params: [], encrypt: M.sha256Hash,
    decrypt: () => { throw new Error('SHA-256 是单向哈希'); },
  }),

  def({
    id: 'sha512', name: 'SHA-512', category: '哈希/摘要',
    description: '512 位 SHA-2 系列哈希。', reversible: false,
    params: [], encrypt: M.sha512Hash,
    decrypt: () => { throw new Error('SHA-512 是单向哈希'); },
  }),

  def({
    id: 'sha3-256', name: 'SHA3-256', category: '哈希/摘要',
    description: 'Keccak 算法标准，SHA-3 系列。', reversible: false,
    params: [], encrypt: M.sha3Hash,
    decrypt: () => { throw new Error('SHA3 是单向哈希'); },
  }),

  def({
    id: 'hmac-sha256', name: 'HMAC-SHA256', category: '哈希/摘要',
    description: '带密钥的消息认证码，验证消息完整性。', reversible: false,
    params: [{ name: 'key', label: '密钥', type: 'text', default: 'secret' }],
    encrypt: (t, p) => M.hmacSha256(t, p.key),
    decrypt: () => { throw new Error('HMAC 不可逆'); },
  }),

  def({
    id: 'crc32', name: 'CRC32 校验', category: '哈希/摘要',
    description: '循环冗余校验，用于错误检测。', reversible: false,
    params: [], encrypt: M.crc32,
    decrypt: () => { throw new Error('CRC32 不可逆'); },
  }),

  def({
    id: 'pbkdf2', name: 'PBKDF2 密钥派生', category: '哈希/摘要',
    description: '从密码派生密钥，用于密码存储。', reversible: false,
    params: [
      { name: 'password', label: '密码', type: 'password', default: 'salt' },
      { name: 'iterations', label: '迭代次数', type: 'number', default: 10000 },
    ],
    encrypt: (t, p) => M.pbkdf2Demo(t, p.password, Number(p.iterations ?? 10000)),
    decrypt: () => { throw new Error('PBKDF2 不可逆'); },
  }),

  def({
    id: 'rsa', name: 'RSA 非对称加密', category: '非对称加密',
    description: 'RSA 公钥加密、私钥解密，现代 HTTPS 基础。',
    usage: '粘贴 PEM 格式公钥/私钥。',
    params: [
      { name: 'publicKey', label: '公钥 PEM', type: 'textarea', default: '' },
      { name: 'privateKey', label: '私钥 PEM', type: 'textarea', default: '' },
    ],
    identifiable: false,
    encrypt: (t, p) => M.rsaEncrypt(t, p.publicKey),
    decrypt: (t, p) => M.rsaDecrypt(t, p.privateKey),
  }),

  def({
    id: 'decimal', name: '十进制 ASCII', category: '编码/表示',
    description: '每个字符用十进制 ASCII 码表示，空格分隔。', usage: '72 101 108 108 111 = Hello',
    params: [], encrypt: E.decimalEncode, decrypt: E.decimalDecode,
  }),

  def({
    id: 'base58', name: 'Base58', category: '编码/表示',
    description: 'Bitcoin 常用编码，去掉了易混淆字符 0OIl。', usage: '区块地址常用格式',
    params: [], encrypt: E.base58Encode, decrypt: E.base58Decode,
  }),

  def({
    id: 'uuencode', name: 'UUEncode', category: '编码/表示',
    description: 'Unix 传统编码，每行 45 字节。', usage: '老邮件附件编码',
    params: [], encrypt: E.uuencode, decrypt: E.uudecode,
  }),

  def({
    id: 'hill', name: 'Hill 密码', category: '古典替换',
    description: '线性代数矩阵加密，每两个字母为一组向量乘以 2×2 矩阵 mod 26。',
    usage: '输入 2×2 矩阵四个元素，如 3,2,5,7',
    params: [{ name: 'matrix', label: '矩阵 (a,b,c,d)', type: 'text', default: '3,2,5,7' }],
    getIdentifyParams: () => ['3,2,5,7', '5,8,17,3', '7,5,3,11'].map((m) => ({ matrix: m })),
    encrypt: (t, p) => E.hillCipher(t, p.matrix, false),
    decrypt: (t, p) => E.hillCipher(t, p.matrix, true),
  }),

  def({
    id: 'bifid', name: 'Bifid 密码', category: '古典替换',
    description: '双分密码：5×5 Polybius 方阵，字母→(行,列) 坐标，行列序列混排后重配对取密文。破坏单表频率，Felix Delastelle 1901。',
    usage: '输入密钥构建方阵；明文仅 A-Z（J 视作 I）；加密时先写满行坐标再写列坐标。',
    params: [{ name: 'key', label: '密钥', type: 'text', default: 'KEYWORD' }],
    getIdentifyParams: () => commonKeyParams('key'),
    encrypt: (t, p) => E.bifidEncode(t, p.key),
    decrypt: (t, p) => E.bifidDecode(t, p.key),
  }),

  def({
    id: 'trifid', name: 'Trifid 密码', category: '古典替换',
    description: '三分密码：3×3×3 立方体（A-Z + 句点），每字用层/行/列三元坐标；层、行、列序列分别拼接后三位一组重组。Bifid 的三维加强版。',
    usage: '输入密钥填充立方体；明文 A-Z 与句点；加密顺序：全部层→全部行→全部列→三位取字。',
    params: [{ name: 'key', label: '密钥', type: 'text', default: 'KEYWORD' }],
    getIdentifyParams: () => commonKeyParams('key'),
    encrypt: (t, p) => E.trifidEncode(t, p.key),
    decrypt: (t, p) => E.trifidDecode(t, p.key),
  }),

  def({
    id: 'four-square', name: 'Four-square 密码', category: '古典替换',
    description: '四格密码：四个 5×5 方阵（两密钥表+两标准表），明文对取自左上/右下，密文对由右上/左下交叉行列生成。双密钥 Playfair 变体，1902。',
    usage: 'key1 建左上方阵、key2 建右下方阵；明文 Playfair 式两两分组；仅 A-Z。',
    params: [
      { name: 'key1', label: '密钥 1（左上）', type: 'text', default: 'KEYWORD' },
      { name: 'key2', label: '密钥 2（右下）', type: 'text', default: 'SECRET' },
    ],
    getIdentifyParams: () => [
      { key1: 'KEYWORD', key2: 'SECRET' },
      { key1: 'SECRET', key2: 'KEYWORD' },
      ...COMMON_KEYS.slice(0, 6).flatMap((k) => [{ key1: k, key2: 'SECRET' }, { key1: 'KEYWORD', key2: k }]),
    ],
    encrypt: (t, p) => E.fourSquare(t, p.key1, p.key2, false),
    decrypt: (t, p) => E.fourSquare(t, p.key1, p.key2, true),
  }),

  def({
    id: 'running-key', name: 'Running Key 密码', category: '多表替换',
    description: '用书页文本作为无限长密钥的维吉尼亚变体。',
    usage: '输入长文本作为密钥（如书籍段落）',
    params: [{ name: 'keyText', label: '密钥文本', type: 'textarea', default: 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG' }],
    identifiable: false,
    encrypt: (t, p) => E.runningKey(t, p.keyText, false),
    decrypt: (t, p) => E.runningKey(t, p.keyText, true),
  }),

  def({
    id: 'otp', name: '一次性密码本 (OTP)', category: '对称加密',
    description: '理论上不可破解的加密，密钥与明文等长且只用一次。',
    usage: '输入与明文等长的随机密钥',
    params: [{ name: 'key', label: '密钥', type: 'text', default: 'SECRETKEY' }],
    identifiable: false,
    encrypt: (t, p) => E.otpEncrypt(t, p.key || 'SECRETKEY'),
    decrypt: (t, p) => E.otpEncrypt(t, p.key || 'SECRETKEY'),
  }),

  def({
    id: 'enigma-simple', name: 'Enigma 简化版', category: '古典替换',
    description: '模拟 Enigma 转子替换（Educational 简化，非历史精确）。',
    usage: '设置转子初始位置 0-25',
    params: [{ name: 'rotorPos', label: '转子位置', type: 'number', default: 0, min: 0, max: 25 }],
    getIdentifyParams: () => shifts('rotorPos', 26).map((p) => ({ rotorPos: p.rotorPos - 1 })),
    encrypt: (t, p) => E.enigmaSimple(t, Number(p.rotorPos ?? 0), false),
    decrypt: (t, p) => E.enigmaSimple(t, Number(p.rotorPos ?? 0), true),
  }),

  def({
    id: 'jcuken', name: 'JCUKEN 俄键盘移位', category: '文本变换',
    description: '俄语 JCUKEN 键盘布局移位替换。', usage: '设置移位量',
    params: [{ name: 'shift', label: '移位', type: 'number', default: 1, min: 1, max: 10 }],
    getIdentifyParams: () => shifts('shift', 5),
    encrypt: (t, p) => E.jcukenShift(t, Number(p.shift ?? 1)),
    decrypt: (t, p) => E.jcukenShift(t, -Number(p.shift ?? 1)),
  }),

  def({
    id: 'adler32', name: 'Adler-32 校验', category: '哈希/摘要',
    description: 'zlib 使用的快速校验和。', reversible: false,
    params: [], encrypt: (t) => String(E.adler32(t)), decrypt: () => { throw new Error('不可逆'); },
  }),

  def({
    id: 'chacha20', name: 'ChaCha20-Poly1305', category: '对称加密',
    description: '现代流密码 AEAD，TLS 1.3 支持。', usage: '输入密码短语',
    params: [{ name: 'password', label: '密码', type: 'password', default: 'secret' }],
    identifiable: false,
    encrypt: (t, p) => M.chachaEncrypt(t, p.password),
    decrypt: (t, p) => M.chachaDecrypt(t, p.password),
  }),

  // ── 怪诞小镇 / 流行文化 ──
  def({
    id: 'gf-caesar3', name: '怪诞小镇 凯撒-3', category: '影视/流行文化',
    description: 'Gravity Falls 最常用的 Caesar-3：每个字母在字母表中移动 3 位。Journal 3 大量 cryptogram 使用此法。',
    usage: '加密 +3，解密 -3。Stan 密码本入门第一课。',
    history: 'Gravity Falls (2012-2016)',
    params: [],
    getIdentifyParams: () => [{ shift: 3 }],
    encrypt: (t) => E.caesar(t, 3),
    decrypt: (t) => E.caesar(t, -3),
  }),

  def({
    id: 'gf-a1z26', name: '怪诞小镇 A1Z26', category: '影视/流行文化',
    description: 'A=1, B=2 … Z=26 数字替字母。书中如「10-15-21-18-14-1-12」= JOURNAL。',
    usage: '数字用 - 或空格分隔，0 表空格。',
    params: [{ name: 'sep', label: '分隔符', type: 'text', default: '-' }],
    encrypt: (t, p) => S.a1z26Encode(t, p.sep || '-'),
    decrypt: S.a1z26Decode,
  }),

  def({
    id: 'gf-author', name: '怪诞小镇 Author 符号', category: '影视/流行文化',
    description: 'Ford Pines (The Author) 在 Journal 使用的 26 符号替换。本工具用 Unicode 符号集模拟官方 CipherFont 原理。',
    usage: '加密得符号串；解密粘贴符号序列。对照 Journal 3 轮盘学习。',
    params: [],
    encrypt: S.gfAuthorEncode, decrypt: S.gfAuthorDecode,
  }),

  def({
    id: 'gf-bill', name: '怪诞小镇 Bill 符号', category: '影视/流行文化',
    description: 'Bill Cipher 专用符号字母表，与 Author 符号不同。出现在衍生读物与 ARG。',
    usage: '符号→字母替换，从左到右阅读。',
    params: [],
    encrypt: S.gfBillEncode, decrypt: S.gfBillDecode,
  }),

  def({
    id: 'gf-vigenere-pines', name: '怪诞小镇 维吉尼亚 (PINES)', category: '影视/流行文化',
    description: 'Blendin 信件等剧情的维吉尼亚密码，固定密钥 PINES。',
    usage: '密钥 PINES 循环，标准维吉尼亚加解密。',
    params: [{ name: 'key', label: '密钥', type: 'text', default: 'PINES' }],
    getIdentifyParams: () => [{ key: 'PINES' }, { key: 'pines' }],
    encrypt: (t, p) => E.vigenere(t, p.key || 'PINES', false),
    decrypt: (t, p) => E.vigenere(t, p.key || 'PINES', true),
  }),

  def({
    id: 'a1z26', name: 'A1Z26 数字密码', category: '编码/表示',
    description: '通用 A1Z26：A=1 … Z=26，CTF 与 ARG 常见。',
    usage: '分隔符可选 - 或空格。',
    params: [{ name: 'sep', label: '分隔符', type: 'text', default: '-' }],
    encrypt: (t, p) => S.a1z26Encode(t, p.sep || '-'),
    decrypt: S.a1z26Decode,
  }),

  def({
    id: 'pigpen', name: '猪圈密码 (Pigpen)', category: '古典替换',
    description: 'Masonic 四格几何密码：每字母对应格子图形符号（见百科对照图）。',
    usage: '密文区用猪圈字体显示几何符号（底层仍为 A–Z）；仍兼容旧格坐标 A1/B2。',
    params: [],
    encrypt: S.pigpenEncode, decrypt: S.pigpenDecode,
  }),

  def({
    id: 'zalgo', name: 'Zalgo 崩坏文本', category: '网络/迷因',
    description: '叠加 Unicode 组合符制造「被诅咒」视觉效果，Discord/Tumblr 迷因。',
    usage: '解密 normalize 剥离附加符。',
    params: [{ name: 'intensity', label: '强度', type: 'number', default: 3, min: 1, max: 8 }],
    encrypt: (t, p) => S.zalgoEncode(t, Number(p.intensity ?? 3)),
    decrypt: S.zalgoDecode,
    identifiable: false,
  }),

  def({
    id: 'discord-spoiler', name: 'Discord 剧透块', category: '网络/迷因',
    description: '||文字|| Discord Markdown 剧透语法。',
    usage: '包裹 || 即可。',
    params: [],
    encrypt: S.discordSpoilerEncode, decrypt: S.discordSpoilerDecode,
  }),

  def({
    id: 'brainfuck', name: 'Brainfuck', category: '网络/迷因',
    description: '极简 esolang，八种指令。CTF/程序员梗常用。',
    usage: '短文本可编解码；长文本仅演示。',
    params: [],
    encrypt: S.brainfuckEncode,
    decrypt: S.brainfuckDecode,
    identifiable: false,
  }),

  def({
    id: 'ook', name: 'Ook! (Brainfuck 方言)', category: '网络/迷因',
    description: 'Ook. Ook? Ook! 三种词组成，语义等同 Brainfuck。',
    params: [],
    encrypt: (t) => S.brainfuckEncode(t).replace(/\+/g, 'Ook! ').replace(/>/g, 'Ook. '),
    decrypt: S.ookDecode,
    identifiable: false,
  }),

  def({
    id: 'emoji', name: 'Emoji 字母替换', category: '网络/迷因',
    description: 'A→🔴, B→🟠 … 社交藏信息玩法。',
    params: [],
    encrypt: S.emojiCipherEncode, decrypt: S.emojiCipherDecode,
  }),

  def({
    id: 'periodic-table', name: '元素周期表密码', category: '网络/迷因',
    description: '用化学元素符号拼单词，STEM 梗。',
    params: [],
    encrypt: S.periodicEncode, decrypt: S.periodicDecode,
  }),

  def({
    id: 'scp-redact', name: 'SCP 涂黑', category: '网络/迷因',
    description: 'SCP 基金会风格 ███ 涂黑，不可逆。',
    reversible: false,
    params: [{ name: 'char', label: '涂黑符', type: 'text', default: '█' }],
    encrypt: (t, p) => S.scpRedactEncode(t, p.char || '█'),
    decrypt: () => { throw new Error('SCP 涂黑不可逆'); },
  }),

  def({
    id: 'uwu', name: 'UwU 化', category: '网络/迷因',
    description: '网络可爱化：r/l→w，末尾 uwu。',
    params: [],
    encrypt: S.uwuEncode, decrypt: S.uwuDecode,
    identifiable: false,
  }),

  def({
    id: 'small-caps', name: 'Small Caps 小型大写', category: '网络/迷因',
    description: 'Unicode 小型大写字母，Instagram/Discord 装饰字体。',
    params: [],
    encrypt: S.smallCapsEncode, decrypt: S.smallCapsDecode,
  }),

  def({
    id: 'meme-binary', name: '括号二进制迷因', category: '网络/迷因',
    description: '(01001000) 括号包裹 8 位二进制，编程迷因格式。',
    params: [],
    encrypt: S.memeBinaryEncode, decrypt: S.memeBinaryDecode,
  }),

  def({
    id: 'acrostic', name: '藏头诗 / 首字母', category: '古典替换',
    description: '每行首字母连读组成隐藏信息。GF 部分页面用此技巧。',
    params: [],
    encrypt: S.acrosticEncode, decrypt: S.acrosticDecode,
    identifiable: false,
  }),

  // ── 中文 / 多语言 · Unicode 码点密码 ──
  def({
    id: 'unicode-cp-decimal', name: 'Unicode 码点（十进制）', category: '中文/多语言',
    description: '将每个字符（中文简繁、日文假名、韩文、拉丁、标点等）转为 Unicode 十进制码点，空格分隔。编码层，可再接其他加密。',
    usage: '「你好」→「20320 22909」。解码按空格拆分数字后还原字符。支持 supplementary 字符（emoji 等）。',
    history: 'Unicode 标准为全球文字统一编号；CTF 与中文密码学常用码点层变换。',
    params: [],
    encrypt: U.unicodeCpDecimalEncode,
    decrypt: U.unicodeCpDecimalDecode,
    identifiable: false,
  }),

  def({
    id: 'unicode-cp-caesar', name: 'Unicode 码点凯撒', category: '中文/多语言',
    description: '在 Unicode 码点数字域做循环移位，密文输出仍为汉字/假名/韩文等字符。支持简繁中文、全角标点、日文、韩文及拉丁字母。',
    usage: '设置移位量（1-500）。加密：码点 + shift mod 域；解密：码点 - shift。域范围 U+0020–U+D7AF。',
    history: '中文古典密码的现代实现：先编号再移位，密文外观为「乱汉字」而非 Base64。',
    params: [{ name: 'shift', label: '码点移位量', type: 'number', default: 88, min: 1, max: 500 }],
    getIdentifyParams: () => {
      const preferred = [88, 13, 3, 25, 5, 8];
      const rest = Array.from({ length: 200 }, (_, i) => i + 1).filter((s) => !preferred.includes(s));
      return [...preferred.map((shift) => ({ shift })), ...rest.map((shift) => ({ shift }))];
    },
    encrypt: (t, p) => U.unicodeCpCaesar(t, Number(p.shift ?? 88)),
    decrypt: (t, p) => U.unicodeCpCaesar(t, Number(p.shift ?? 88), true),
  }),

  def({
    id: 'unicode-cp-vigenere', name: 'Unicode 码点维吉尼亚', category: '中文/多语言',
    description: '用密钥各字符的码点驱动移位，多表替换。密钥可为中文、日文、英文混合。',
    usage: '密钥如「密钥」「PASSWORD」。逐字扩展密钥流，每字移位量由 key[i] 码点导出。',
    params: [{ name: 'key', label: '密钥', type: 'string', default: '密钥' }],
    getIdentifyParams: () => [
      { key: '密钥' }, { key: '密码' }, { key: '中文' }, { key: 'KEY' }, { key: 'SECRET' },
      { key: 'PASSWORD' }, { key: 'CIPHER' }, { key: 'CRYPTO' }, { key: 'こんにちは' }, { key: '안녕' },
    ],
    encrypt: (t, p) => U.unicodeCpVigenere(t, p.key || '密钥'),
    decrypt: (t, p) => U.unicodeCpVigenere(t, p.key || '密钥', true),
  }),

  def({
    id: 'unicode-cp-affine', name: 'Unicode 码点仿射', category: '中文/多语言',
    description: '码点域仿射变换 E(x)=(ax+b) mod N，比凯撒更安全。a 需与域大小互质。',
    usage: '默认 a=5, b=7。解密需 a 的模逆元。',
    params: [
      { name: 'a', label: '乘数 a', type: 'number', default: 5, min: 1, max: 999 },
      { name: 'b', label: '加数 b', type: 'number', default: 7, min: 0, max: 999 },
    ],
    getIdentifyParams: () => [
      { a: 5, b: 7 }, { a: 7, b: 3 }, { a: 11, b: 17 }, { a: 13, b: 9 },
    ],
    encrypt: (t, p) => U.unicodeCpAffine(t, p.a ?? 5, p.b ?? 7),
    decrypt: (t, p) => U.unicodeCpAffine(t, p.a ?? 5, p.b ?? 7, true),
  }),
];

function encode(id, name, category, description, enc, dec) {
  return [def({
    id, name, category, description,
    usage: '输入文本自动转换，解码需格式正确。',
    params: [], encrypt: enc, decrypt: dec,
  })];
}

export const cipherMap = Object.fromEntries(registry.map((c) => [c.id, c]));

const exampleCache = buildExampleCache(registry);

export function getCipherMeta() {
  return registry.map((c) => enrichCipherMeta({
    id: c.id,
    name: c.name,
    category: c.category,
    description: c.description,
    usage: c.usage,
    history: c.history,
    params: c.params,
    reversible: c.reversible,
    identifiable: c.identifiable,
    langSupport: getLangSupport(c.id),
    requiresKey: cipherRequiresKey(c),
  }, exampleCache[c.id], c));
}

export function encrypt(id, text, params = {}) {
  const c = cipherMap[id];
  if (!c) throw new Error(`未知加密方式: ${id}`);
  assertTextLangSupported(id, text, c.name, c.category);
  return c.encrypt(text, params);
}

export function decrypt(id, text, params = {}) {
  const c = cipherMap[id];
  if (!c) throw new Error(`未知加密方式: ${id}`);
  assertTextLangSupported(id, text, c.name, c.category);
  return c.decrypt(text, params);
}

export { formatParams };

console.log(`[registry] ${registry.length} cipher types loaded`);
