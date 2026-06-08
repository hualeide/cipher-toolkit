import crypto from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';

export function aesEncrypt(text, password, algorithm = 'aes-256-cbc') {
  const key = crypto.scryptSync(password || 'secret', 'salt', algorithm.includes('128') ? 16 : 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key.slice(0, algorithm.includes('128') ? 16 : 32), iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  if (algorithm.includes('gcm')) {
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${enc}`;
  }
  return `${iv.toString('hex')}:${enc}`;
}

export function aesDecrypt(text, password, algorithm = 'aes-256-cbc') {
  const key = crypto.scryptSync(password || 'secret', 'salt', algorithm.includes('128') ? 16 : 32);
  const parts = text.split(':');
  if (algorithm.includes('gcm')) {
    const [ivHex, tagHex, enc] = parts;
    const decipher = crypto.createDecipheriv(algorithm, key.slice(0, algorithm.includes('128') ? 16 : 32), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(enc, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  }
  const [ivHex, enc] = parts;
  const decipher = crypto.createDecipheriv(algorithm, key.slice(0, algorithm.includes('128') ? 16 : 32), Buffer.from(ivHex, 'hex'));
  let dec = decipher.update(enc, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

export function desEncrypt(text, password) {
  const key = crypto.createHash('md5').update(password || 'secret').digest().slice(0, 8);
  const iv = crypto.randomBytes(8);
  const cipher = crypto.createCipheriv('des-cbc', key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  return `${iv.toString('hex')}:${enc}`;
}

export function desDecrypt(text, password) {
  const key = crypto.createHash('md5').update(password || 'secret').digest().slice(0, 8);
  const [ivHex, enc] = text.split(':');
  const decipher = crypto.createDecipheriv('des-cbc', key, Buffer.from(ivHex, 'hex'));
  let dec = decipher.update(enc, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

export function tripleDesEncrypt(text, password) {
  const key = crypto.createHash('sha256').update(password || 'secret').digest().slice(0, 24);
  const iv = crypto.randomBytes(8);
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  return `${iv.toString('hex')}:${enc}`;
}

export function tripleDesDecrypt(text, password) {
  const key = crypto.createHash('sha256').update(password || 'secret').digest().slice(0, 24);
  const [ivHex, enc] = text.split(':');
  const decipher = crypto.createDecipheriv('des-ede3-cbc', key, Buffer.from(ivHex, 'hex'));
  let dec = decipher.update(enc, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

export function rc4(text, key, decrypt = false) {
  const k = key || 'key';
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + k.charCodeAt(i % k.length)) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }
  let i = 0; j = 0;
  let out = '';
  for (const ch of text) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    [s[i], s[j]] = [s[j], s[i]];
    const kst = s[(s[i] + s[j]) % 256];
    out += String.fromCharCode(ch.charCodeAt(0) ^ kst);
  }
  return out;
}

export function md5Hash(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

export function sha1Hash(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

export function sha256Hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function sha512Hash(text) {
  return crypto.createHash('sha512').update(text).digest('hex');
}

export function sha3Hash(text) {
  return crypto.createHash('sha3-256').update(text).digest('hex');
}

export function hmacSha256(text, key) {
  return crypto.createHmac('sha256', key || 'secret').update(text).digest('hex');
}

export function crc32(text) {
  let crc = 0xffffffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i);
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

export function gzipBase64Encode(text) {
  return gzipSync(Buffer.from(text, 'utf8')).toString('base64');
}

export function gzipBase64Decode(text) {
  return gunzipSync(Buffer.from(text.trim(), 'base64')).toString('utf8');
}

export function rsaGenerateKeyPair() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
}

export function rsaEncrypt(text, publicKeyPem) {
  if (!publicKeyPem) throw new Error('需要 RSA 公钥');
  return crypto.publicEncrypt(publicKeyPem, Buffer.from(text, 'utf8')).toString('base64');
}

export function rsaDecrypt(text, privateKeyPem) {
  if (!privateKeyPem) throw new Error('需要 RSA 私钥');
  return crypto.privateDecrypt(privateKeyPem, Buffer.from(text, 'base64')).toString('utf8');
}

export function pbkdf2Demo(text, password, iterations = 10000) {
  return crypto.pbkdf2Sync(text, password || 'salt', iterations, 32, 'sha256').toString('hex');
}

export function chachaEncrypt(text, password) {
  const key = crypto.scryptSync(password || 'secret', 'salt', 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('chacha20-poly1305', key, iv, { authTagLength: 16 });
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`;
}

export function chachaDecrypt(text, password) {
  const key = crypto.scryptSync(password || 'secret', 'salt', 32);
  const [ivHex, tagHex, enc] = text.split(':');
  const decipher = crypto.createDecipheriv('chacha20-poly1305', key, Buffer.from(ivHex, 'hex'), { authTagLength: 16 });
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec = decipher.update(enc, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

export function detectHashType(text) {
  const t = text.trim();
  if (/^[a-f0-9]{32}$/i.test(t)) return { type: 'md5', name: 'MD5 哈希', reversible: false };
  if (/^[a-f0-9]{40}$/i.test(t)) return { type: 'sha1', name: 'SHA-1 哈希', reversible: false };
  if (/^[a-f0-9]{64}$/i.test(t)) return { type: 'sha256', name: 'SHA-256 哈希', reversible: false };
  if (/^[a-f0-9]{128}$/i.test(t)) return { type: 'sha512', name: 'SHA-512 哈希', reversible: false };
  if (/^[a-f0-9]{8}$/i.test(t)) return { type: 'crc32', name: 'CRC32 校验', reversible: false };
  return null;
}
