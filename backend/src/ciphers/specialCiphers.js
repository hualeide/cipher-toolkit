/** 怪诞小镇 / 网红 / 流行文化密码 */

const AUTHOR_SYMBOLS = '⌈⌉⌊⌋⟨⟩⟪⟫∀∂∃∅∇∈∉∋∏∑−∓∞∟∠∡∢∧∨'.split('');
const BILL_SYMBOLS = '☉☽☾♁♃♄♅♆♇⚡⚠☢☣☯☮✦✧✩✪✫✬✭✮✯✰✱✲'.split('');
/** 猪圈密码：A–Z 大写字母 + Pigpen 字体显示为几何符号；仍兼容旧格坐标 A1/B2 */
const PIGPEN_LEGACY = {
  A: 'A1', B: 'A2', C: 'A3', D: 'B1', E: 'B2', F: 'B3', G: 'C1', H: 'C2', I: 'C3',
  J: 'D1', K: 'D2', L: 'D3', M: 'E1', N: 'E2', O: 'E3', P: 'F1', Q: 'F2', R: 'F3',
  S: 'G1', T: 'G2', U: 'G3', V: 'H1', W: 'H2', X: 'H3', Y: 'I1', Z: 'I2',
};
const PIGPEN_LEGACY_REV = Object.fromEntries(Object.entries(PIGPEN_LEGACY).map(([k, v]) => [v, k]));

export function pigpenEncode(text) {
  return text.toUpperCase().split('').map((c) => (/[A-Z]/.test(c) ? c : c)).join('');
}

export function pigpenDecode(text) {
  const raw = text.trim();
  if (/[A-I][1-3]|[D-G][1-3]|[A-Z]\d/i.test(raw)) {
    return raw.toUpperCase().split(/\s+/).map((p) => PIGPEN_LEGACY_REV[p] || p).join('');
  }
  return text.toUpperCase().split('').map((c) => (/[A-Z]/.test(c) ? c : c)).join('');
}
const EMOJI = [
  '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪', '🔶',
  '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '⭐', '🌙', '🌈', '🔥',
  '💧', '🌿', '🍀', '🎵', '🎶', '🎼',
];

const PERIODIC = {
  A: 'H', B: 'He', C: 'Li', D: 'Be', E: 'B', F: 'C', G: 'N', H: 'O', I: 'F', J: 'Ne',
  K: 'Na', L: 'Mg', M: 'Al', N: 'Si', O: 'P', P: 'S', Q: 'Cl', R: 'Ar', S: 'K', T: 'Ca',
  U: 'Sc', V: 'Ti', W: 'V', X: 'Cr', Y: 'Mn', Z: 'Fe',
};
const PERIODIC_REV = Object.fromEntries(Object.entries(PERIODIC).map(([k, v]) => [v.toLowerCase(), k]));

function alphaMap(symbols, text, decrypt) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (!decrypt) {
    return text.toUpperCase().split('').map((c) => {
      const i = alpha.indexOf(c);
      return i >= 0 ? symbols[i] : c;
    }).join('');
  }
  const rev = Object.fromEntries(symbols.map((s, i) => [s, alpha[i]]));
  return [...text].map((c) => rev[c] || c).join('');
}

export function gfAuthorEncode(t) { return alphaMap(AUTHOR_SYMBOLS, t, false); }
export function gfAuthorDecode(t) { return alphaMap(AUTHOR_SYMBOLS, t, true); }
export function gfBillEncode(t) { return alphaMap(BILL_SYMBOLS, t, false); }
export function gfBillDecode(t) { return alphaMap(BILL_SYMBOLS, t, true); }

export function a1z26Encode(text, sep = '-') {
  return text.toUpperCase().split('').map((c) => {
    if (c === ' ') return '0';
    const n = c.charCodeAt(0) - 64;
    return n >= 1 && n <= 26 ? String(n) : c;
  }).join(sep);
}

export function a1z26Decode(text) {
  return text.replace(/[^0-9]/g, ' ').trim().split(/\s+/).map((n) => {
    const num = Number(n);
    if (num === 0) return ' ';
    return num >= 1 && num <= 26 ? String.fromCharCode(num + 64) : n;
  }).join('');
}

export function zalgoEncode(text, intensity = 3) {
  const marks = ['\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0307', '\u0308', '\u0310'];
  return [...text].map((ch) => {
    if (!/\S/.test(ch)) return ch;
    let s = ch;
    for (let i = 0; i < intensity; i++) {
      s += marks[Math.floor(Math.random() * marks.length)];
    }
    return s;
  }).join('');
}

export function zalgoDecode(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function discordSpoilerEncode(text) {
  return text.split(/(\s+)/).map((w) => (/^\s+$/.test(w) ? w : `||${w}||`)).join('');
}

export function discordSpoilerDecode(text) {
  return text.replace(/\|\|([^|]+)\|\|/g, '$1');
}

export function brainfuckEncode(text) {
  let out = '++> ';
  for (const ch of text) {
    const n = ch.charCodeAt(0);
    out += '+'.repeat(n) + '.[-]';
  }
  return out.trim();
}

export function brainfuckDecode(text) {
  if (!/^[\[\]+-><\s.]+$/.test(text.trim())) return text;
  const tape = Array(30000).fill(0);
  let p = 0;
  let i = 0;
  let out = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '>') p++;
    else if (c === '<') p--;
    else if (c === '+') tape[p]++;
    else if (c === '-') tape[p]--;
    else if (c === '.') out += String.fromCharCode(tape[p] % 256);
    else if (c === '[') {
      if (tape[p] === 0) {
        let d = 1; i++;
        while (d && i < text.length) {
          if (text[i] === '[') d++;
          if (text[i] === ']') d--;
          i++;
        }
        continue;
      }
    } else if (c === ']') {
      if (tape[p] !== 0) {
        let d = 1; i--;
        while (d && i >= 0) {
          if (text[i] === ']') d++;
          if (text[i] === '[') d--;
          i--;
        }
      }
    }
    i++;
  }
  return out || text;
}

export function ookDecode(text) {
  const map = { 'Ook.': '>', 'Ook?': '<', 'Ook!': '+', 'Ook. Ook!': '-', 'Ook! Ook!': '.', 'Ook! Ook?': ',', 'Ook? Ook!': '[', 'Ook? Ook?': ']' };
  let bf = text;
  for (const [k, v] of Object.entries(map)) bf = bf.split(k).join(v);
  return brainfuckDecode(bf);
}

export function emojiCipherEncode(text) {
  return [...text.toUpperCase()].map((c) => {
    const i = c.codePointAt(0) - 65;
    return i >= 0 && i < 26 ? EMOJI[i] : c;
  }).join('');
}

export function emojiCipherDecode(text) {
  const rev = Object.fromEntries(EMOJI.map((e, i) => [e, String.fromCharCode(65 + i)]));
  let out = '';
  let i = 0;
  const chars = [...text];
  while (i < chars.length) {
    let matched = false;
    for (const e of EMOJI) {
      const parts = [...e];
      if (chars.slice(i, i + parts.length).join('') === e) {
        out += rev[e];
        i += parts.length;
        matched = true;
        break;
      }
    }
    if (!matched) { out += chars[i]; i += 1; }
  }
  return out;
}

export function periodicEncode(text) {
  return text.toUpperCase().split('').map((c) => PERIODIC[c] || c).join('-');
}

export function periodicDecode(text) {
  const parts = text.split(/[-,\s]+/);
  return parts.map((p) => PERIODIC_REV[p.toLowerCase()] || p).join('');
}

export function scpRedactEncode(text, char = '█') {
  return text.split('').map((c) => (/[a-zA-Z0-9]/.test(c) ? char : c)).join('');
}

export function scpRedactDecode() {
  throw new Error('SCP 涂黑不可逆');
}

export function uwuEncode(text) {
  return text.replace(/[rl]/gi, (m) => (m === m.toUpperCase() ? 'W' : 'w'))
    .replace(/n([aeiou])/gi, 'ny$1')
    .replace(/ove/gi, 'uv')
    + ' uwu';
}

export function uwuDecode(text) {
  return text.replace(/\s*uwu\s*$/i, '')
    .replace(/ny([aeiou])/gi, 'n$1')
    .replace(/uv/gi, 'ove')
    .replace(/w/g, 'l');
}

export function smallCapsEncode(text) {
  const offset = 0x1D00 - 97;
  return text.toLowerCase().replace(/[a-z]/g, (c) => {
    const code = c.charCodeAt(0);
    return code >= 97 && code <= 122 ? String.fromCodePoint(code + offset) : c;
  });
}

export function smallCapsDecode(text) {
  const offset = 0x1D00 - 97;
  return [...text].map((ch) => {
    const c = ch.codePointAt(0);
    if (c >= 0x1D00 && c <= 0x1D1A) return String.fromCharCode(c - offset);
    return ch;
  }).join('');
}

/** 26 字母 ↔ 双旗方向（本工具专用双射表，便于 CTF/密码吧练习） */
const SEMAPHORE_TABLE = {
  A: '↖↖', B: '↖↑', C: '↖↗', D: '↖←', E: '↖●', F: '↖→', G: '↖↙', H: '↖↓', I: '↖↘',
  J: '↑↖', K: '↑↑', L: '↑↗', M: '↑←', N: '↑●', O: '↑→', P: '↑↙', Q: '↑↓', R: '↑↘',
  S: '↗↖', T: '↗↑', U: '↗↗', V: '↗←', W: '↗●', X: '↗→', Y: '↗↙', Z: '↗↓',
};
const SEMAPHORE_REV = Object.fromEntries(
  Object.entries(SEMAPHORE_TABLE).map(([k, v]) => [v, k]),
);

export function semaphoreEncode(text) {
  return text.toUpperCase().split('').map((c) => SEMAPHORE_TABLE[c] || c).join(' ');
}

export function semaphoreDecode(text) {
  return text.trim().split(/\s+/).map((token) => {
    const sig = [...token.replace(/\s/g, '')].join('');
    return SEMAPHORE_REV[sig] || token;
  }).join('');
}

export function memeBinaryEncode(text) {
  return [...text].map((c) => `(${c.charCodeAt(0).toString(2).padStart(8, '0')})`).join(' ');
}

export function memeBinaryDecode(text) {
  return text.match(/\((\d+)\)/g)?.map((m) => String.fromCharCode(parseInt(m.slice(1, -1), 2))).join('') || text;
}

export function acrosticDecode(text) {
  return text.split(/\n/).map((line) => line.trim()[0] || '').join('');
}

export function acrosticEncode(text) {
  return text.split('').map((c) => `${c}${' '.repeat(20)}`).join('\n');
}
