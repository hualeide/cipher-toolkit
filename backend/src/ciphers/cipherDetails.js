import * as S from './specialCiphers.js';
import { isPlaceholder, finalizeExamples } from './cipherExamples.js';
import { getLangSupport } from './langSupport.js';
import { pickCorpusPlaintext, isExamplePlaceholder } from './exampleCorpus.js';

function resolveExamplePlain(cipherId, detailPlain, generatedPlain) {
  if (getLangSupport(cipherId)?.includes('zh')) {
    return pickCorpusPlaintext(cipherId);
  }
  if (isExamplePlaceholder(detailPlain)) return generatedPlain || '';
  return detailPlain || generatedPlain || '';
}

export const CIPHER_DETAILS = {
  caesar: {
    difficulty: '入门',
    howItWorks: '凯撒密码将字母固定移位 n 位（A→D 表示移位 3）。本工具扩展支持中文简繁、日文假名、韩文及全角字符：在 Unicode 码点域同步移位，空格与 ASCII 标点保持不变。下方示例从诗词/名言句库轮选一句中文演示。',
    steps: ['确定移位量 n（1-25）', '英文字母：(x + n) mod 26', '中日韩字符：码点 + n', '解密时反向移位'],
    formula: 'E(x) = (x + n) mod 26；E(cp) = cp + n',
    origin: 'Julius Caesar，《高卢战记》',
    seeAlso: ['rot13', 'gf-caesar3', 'unicode-cp-caesar'],
  },
  rot13: {
    difficulty: '入门',
    howItWorks: '移位 13 的凯撒密码。纯英文时加密解密相同；含中文/日文/韩文时整段在 Unicode 码点域同步 ±13 移位。示例为句库名言。',
    seeAlso: ['caesar', 'rot47'],
  },
  rot47: {
    difficulty: '入门',
    howItWorks: '对 ASCII 可打印字符 (33–126) 循环移位 47 位，可处理字母、数字和符号。',
    examplePlain: 'Hello!',
    seeAlso: ['rot13', 'caesar'],
  },
  'rot-all': {
    difficulty: '入门',
    howItWorks: '同时对字母、数字及 CJK/假名/韩文字符做相同移位，适合混合文本。示例为句库名言。',
    seeAlso: ['caesar', 'rot13', 'unicode-cp-caesar'],
  },
  affine: {
    difficulty: '中等',
    howItWorks: '仿射密码 E(x)=(ax+b) mod 26，a 须与 26 互质。含中文时自动切换为 Unicode 码点域仿射变换。示例为句库名言。',
    steps: ['选择互质乘数 a', '设置加数 b', '逐字符变换', '解密需 a 的模逆'],
    formula: 'E(x) = (ax + b) mod 26 / N',
    seeAlso: ['caesar', 'unicode-cp-affine'],
  },
  gronsfeld: {
    difficulty: '中等',
    howItWorks: 'Gronsfeld 以数字密钥驱动移位，每位数字决定当前字符移位量。支持字母与中日韩字符。示例为句库名言。',
    seeAlso: ['vigenere', 'caesar', 'unicode-cp-caesar'],
  },
  beaufort: {
    difficulty: '中等',
    howItWorks: 'Beaufort 用密钥字母减去明文字母（与维吉尼亚方向相反）。中文密钥同样有效。示例为句库名言。',
    seeAlso: ['vigenere', 'unicode-cp-vigenere'],
  },
  autokey: {
    difficulty: '困难',
    howItWorks: 'Autokey 用起始密钥后，以明文/密文自身扩展密钥流，比固定密钥更安全。支持多语言字符。示例为句库名言。',
    seeAlso: ['vigenere', 'unicode-cp-vigenere'],
  },
  'running-key': {
    difficulty: '困难',
    howItWorks: '用书页文本作为无限长密钥的维吉尼亚变体。密钥可为中文、英文等任意字符。示例为句库名言。',
    seeAlso: ['vigenere', 'autokey'],
  },
  'gf-caesar3': {
    difficulty: '入门',
    howItWorks: '《怪诞小镇》Journal 3 和剧集结尾最常出现的密码。本质是凯撒密码移位 3：加密时每个字母向前移 3 位，解密时向后移 3 位。Stan 密码本第一页就教这个。',
    steps: ['看到密文全是字母', '每个字母在字母表中后退 3 位', 'D→A, E→B, …', '《Journal 3》大量 cryptogram 用此法'],
    examplePlain: 'MEET ME',
    exampleCipher: 'PHHW PH',
    formula: 'D(x) = (x - 3) mod 26',
    origin: 'Gravity Falls (2012-2016), Journal 3',
    seeAlso: ['caesar', 'atbash', 'gf-a1z26', 'unicode-cp-caesar'],
    trivia: '经典台词 cryptogram「TRUST NO ONE」在其他条目中用 Atbash 出现。',
  },
  'gf-a1z26': {
    difficulty: '入门',
    howItWorks: 'A1Z26 把 A=1, B=2, … Z=26，用数字序列代替字母。怪诞小镇书中常见「10-15-21-18-14-1-12」这类形式，解码为 JOURNAL。',
    steps: ['按分隔符（- 或空格）拆分数字', '1-26 映射回 A-Z', '0 或 00 常表示空格', '合并得到明文'],
    examplePlain: 'JOURNAL',
    exampleCipher: '10-15-21-18-14-1-12',
    origin: 'Gravity Falls 数字 cryptogram',
    seeAlso: ['decimal', 'gf-caesar3'],
  },
  'gf-author': {
    difficulty: '中等',
    howItWorks: '《Author》即 Ford Pines 在 Journal 中使用的符号替换：26 个独特符号各对应 A-Z。每个符号旁标 1-26 数字，与 A1Z26 等价但外观为「象形符号」。本工具用 Unicode 符号集模拟，便于学习原理。',
    steps: ['找到 Journal 中的符号对照轮盘', '每个符号查表得字母', '从左到右读出英文', '注意部分版本有镜像书写'],
    examplePlain: 'GRAVITY',
    exampleCipher: '（符号序列，见加密页）',
    origin: 'Gravity Falls Journal 3, Ford Pines',
    seeAlso: ['gf-bill', 'pigpen', 'gf-a1z26'],
    trivia: '官方字体 CipherFontA 来自 thisisnotawebsitedotcom.com。',
  },
  'gf-bill': {
    difficulty: '中等',
    howItWorks: 'Bill Cipher（三角恶魔）使用另一套符号字母表，与 Author 符号不同但原理相同。出现在《Dipper and Mabel Guide》等衍生书中。',
    steps: ['识别 Bill 风格符号', '对照 Bill 符号表', '逐符号转字母', '结合凯撒/Atbash 做多层解密'],
    examplePlain: 'WEIRD',
    origin: 'Gravity Falls, Bill Cipher',
    seeAlso: ['gf-author', 'gf-caesar3'],
  },
  'gf-vigenere-pines': {
    difficulty: '困难',
    howItWorks: 'Blendin 信件等剧情使用维吉尼亚密码，密钥常为 PINES。多表凯撒：密钥字母循环决定每位的移位量。',
    steps: ['确认密文为字母', '密钥 PINES 循环', '密文字母 - 密钥字母 mod 26', '得到英文句子'],
    examplePlain: 'DIPPER',
    exampleCipher: 'TQRRIH',
    origin: 'Gravity Falls S2, Vigenère keyword PINES',
    seeAlso: ['vigenere', 'gf-caesar3', 'unicode-cp-vigenere'],
  },
  atbash: {
    difficulty: '入门',
    howItWorks: 'Atbash 将字母表首尾对称：A↔Z, B↔Y。加密与解密操作相同。中文等字符在各 Unicode 块内做对称反射（如 CJK 区首尾互换）。示例为句库名言。',
    steps: ['A 换 Z，B 换 Y', '或序号 x 变为 25-x', 'CJK 在块内对称映射', '标点与空格通常保留'],
    formula: 'E(x) = 25 - x',
    origin: '希伯来字母 Atbash，怪诞小镇常用',
    seeAlso: ['gf-caesar3', 'caesar', 'unicode-cp-caesar'],
  },
  pigpen: {
    difficulty: '中等',
    howItWorks: '猪圈密码（Masonic/Pigpen）用九宫格+点标记 26 字母。每格分有无点两种，形成独特几何外观。欧美谜题、少年侦探类作品常见。',
    steps: ['画 3×3 无点格 + 3×3 有点格', '按字母顺序填入', '明文变格坐标如 A1、B2', '解密反向查表'],
    examplePlain: 'HELLO',
    exampleCipher: 'C2 D3 E3 F1 F3',
    origin: '18 世纪 Masonic cipher',
    seeAlso: ['polybius', 'gf-author'],
  },
  vigenere: {
    difficulty: '中等',
    howItWorks: '维吉尼亚用 repeating 密钥实现多表凯撒。密钥可为英文或中文，逐字驱动移位。同一明文字符在不同位置可能变为不同密文。示例为句库名言。',
    steps: ['准备密钥（如 KEY 或「密钥」）', '明文第 i 字符 + 密钥第 i 字符', '解密时相减/反向移位', '密钥循环使用'],
    formula: 'C_i = (P_i + K_i) mod 26 / 码点域',
    origin: '1553 Blaise de Vigenère',
    seeAlso: ['beaufort', 'gf-vigenere-pines', 'unicode-cp-vigenere'],
  },
  base64: {
    difficulty: '入门',
    howItWorks: 'Base64 把二进制每 6 位映射为 A-Z a-z 0-9 + / 共 64 字符，末尾用 = 填充。网络传输、JWT、邮件附件无处不在。',
    steps: ['文本转 UTF-8 字节', '6 位一组转 Base64 字符', '不足 4 字符时用 = 填充', '解码反向操作'],
    examplePlain: 'hello',
    exampleCipher: 'aGVsbG8=',
    origin: 'RFC 4648',
    seeAlso: ['hex', 'base32'],
  },
  zalgo: {
    difficulty: '入门',
    howItWorks: 'Zalgo/Cursed Text 在字符上叠加大量 Unicode 组合附加符（combining marks），制造「文字崩溃」视觉效果。Discord、Tumblr 迷因常用。',
    steps: ['保留原字符', '随机添加 ̀ ́ ̂ 等组合符', '解码时 normalize 并剥离附加符'],
    examplePlain: 'hello',
    origin: '2004 Zalgo  creepypasta  meme',
    seeAlso: ['discord-spoiler', 'fullwidth'],
  },
  'discord-spoiler': {
    difficulty: '入门',
    howItWorks: 'Discord 用 ||文字|| 标记剧透，客户端渲染为模糊块。本质是包裹语法，不是密码，但常作「隐藏信息」玩法。',
    steps: ['每个词用 || 包裹', '发送后点击才可见', '去掉 || 即解密'],
    examplePlain: 'spoiler',
    exampleCipher: '||spoiler||',
    origin: 'Discord Markdown',
    seeAlso: ['zalgo'],
  },
  brainfuck: {
    difficulty: '困难',
    howItWorks: 'Brainfuck 极简 esolang：> < + - . , [ ] 八种指令操作 tape。CTF 和程序员迷因中偶见把短文本编成 BF 程序。',
    steps: ['> 移指针', '+/- 增减单元', '. 输出字符', '[ ] 循环直到单元为 0'],
    examplePlain: 'A',
    origin: '1993 Urban Müller',
    seeAlso: ['ook'],
  },
  emoji: {
    difficulty: '入门',
    howItWorks: 'Emoji 替换：A→🔴, B→🟠… 每个字母对应固定 emoji，社交媒体藏信息用。',
    steps: ['查 emoji 字母表', '逐字符替换', '解密反向映射'],
    examplePlain: 'AB',
    origin: '网络迷因 / 社交藏信',
    seeAlso: ['nato', 'leet'],
  },
  'periodic-table': {
    difficulty: '中等',
    howItWorks: '用化学元素符号拼单词：H-He-L-L-O 等形式。Science 迷因、Break Bad 风格 puzzle 常见。',
    steps: ['A→H, B→He, C→Li… 按序对应前 26 元素', '用 - 连接', '解密拆分元素符号'],
    examplePlain: 'HELLO',
    exampleCipher: 'H-He-Li-Be-B',
    origin: 'STEM 网络文化',
    seeAlso: ['a1z26'],
  },
  leet: {
    difficulty: '入门',
    howItWorks: 'Leet (1337) 用数字/符号替字母：a→4, e→3, o→0。黑客文化、游戏 ID 标志。',
    examplePlain: 'elite',
    exampleCipher: '3lit3',
    origin: '1980s BBS 文化',
    seeAlso: ['keyboard-shift', 'uwu'],
  },
  'aes-256-cbc': {
    difficulty: '高级',
    howItWorks: 'AES-256 使用 256 位密钥，CBC 模式每块 XOR 前一密文块。现代 TLS、磁盘加密标准。',
    steps: ['从密码派生密钥', '随机 IV', 'CBC 加密', '输出 IV:密文 hex'],
    formula: 'AES-CBC(K, IV, P)',
    origin: 'NIST 2001',
    seeAlso: ['aes-256-gcm', 'chacha20'],
  },
  'unicode-cp-caesar': {
    difficulty: '中等',
    howItWorks: '每个字符先取 Unicode 码点（如「你」= U+4F60 = 20320），在固定域 U+0020–U+D7AF 内做凯撒移位，再映射回字符。密文外观为汉字/假名/韩文混杂，而非数字串。示例为句库名言。',
    steps: ['逐字符读取 Unicode 码点', '码点 + shift（mod 域大小）', 'fromCodePoint 输出密文字符', '解密时反向移位'],
    formula: 'E(cp) = (cp + k) mod N + BASE',
    origin: '中文密码学 / CTF 常见码点变换',
    seeAlso: ['unicode-cp-vigenere', 'unicode-cp-decimal', 'caesar'],
    trivia: '简繁体、日文假名、韩文音节、全角标点均在同一域内运算，emoji 等 supplementary 字符原样保留。',
  },
  'unicode-cp-vigenere': {
    difficulty: '中等',
    howItWorks: '密钥字符的码点决定每个位置的移位量，相当于多表码点凯撒。密钥可以是中文「密钥」或英文 KEY。示例为句库名言。',
    steps: ['扩展密钥至明文长度', 'key[i] 码点导出 shift', '逐字移位', '解密用同一密钥反向'],
    formula: 'E(cp_i) = cp_i + f(key_i) mod N',
    origin: '维吉尼亚密码的 Unicode 扩展',
    seeAlso: ['unicode-cp-caesar', 'vigenere'],
  },
  'unicode-cp-decimal': {
    difficulty: '入门',
    howItWorks: '编码层：每个字符转为十进制 Unicode 码点，空格分隔。可目视检查或再接凯撒等数字加密。示例为句库名言。',
    steps: ['逐字 codePointAt', '十进制拼接', '解码按空格拆分', 'fromCodePoint 还原'],
    seeAlso: ['decimal', 'unicode-cp-caesar', 'hex'],
  },
  'unicode-cp-affine': {
    difficulty: '困难',
    howItWorks: '码点域仿射密码 E(x)=(ax+b) mod N，a 需与域互质。比凯撒更安全，适合中文密文。',
    formula: 'E(x) = (ax + b) mod N',
    seeAlso: ['unicode-cp-caesar', 'affine'],
  },
  playfair: {
    difficulty: '中等',
    howItWorks: 'Playfair 用 5×5 密钥方阵（I/J 合并）对字母两两成对加密：同行则左右移，同列则上下移，否则取矩形对角。比单表替换更安全，一战二战电报常用。',
    steps: ['密钥去重填方阵', '明文两两分组，重复字母间插 X', '按行列规则取密文对', '解密反向并去掉填充 X'],
    examplePlain: 'HELLO',
    exampleCipher: 'GYIZSC',
    origin: 'Charles Wheatstone, 1854',
    seeAlso: ['four-square', 'bifid', 'vigenere'],
  },
  bifid: {
    difficulty: '中等',
    howItWorks: 'Bifid（双分）用 5×5 Polybius 方阵：每个字母记为 (行,列)，先写出全部行坐标再写全部列坐标，按对重组成新坐标取字母。行列混排破坏单表频率特征。',
    steps: ['密钥构建 5×5 方阵', '明文→行列坐标序列', '前半行坐标+后半列坐标合并', '每对坐标映射回字母'],
    examplePlain: 'HELLO',
    exampleCipher: 'FHYCZ',
    origin: 'Félix Delastelle, 1901',
    seeAlso: ['trifid', 'playfair', 'polybius'],
  },
  trifid: {
    difficulty: '困难',
    howItWorks: 'Trifid（三分）将 Bifid 扩展到 3×3×3 立方体：27 字符（A-Z + 句点），每字用 (层,行,列) 三元坐标。加密时先串全部层、再串行、再串列，每三位重组为新坐标。比 Bifid 更密。',
    steps: ['密钥填充 3×3×3 立方体', '明文→层/行/列坐标', '层序列+行序列+列序列拼接', '每三位坐标→密文字母'],
    examplePlain: 'HELLO',
    exampleCipher: 'FFBFE',
    origin: 'Félix Delastelle, 1902',
    seeAlso: ['bifid', 'four-square'],
  },
  'four-square': {
    difficulty: '中等',
    howItWorks: 'Four-square 用四个 5×5 方阵：左上、右下为密钥表，右上、左下为标准字母表。明文对 (P₁,P₂) 分别取自左上与右下，密文对取自右上「P₁ 行 ∩ P₂ 列」与左下「P₂ 行 ∩ P₁ 列」。双密钥比 Playfair 更安全。',
    steps: ['key1 建左上方阵，key2 建右下方阵', '明文按 Playfair 规则两两分组', '查四格交叉取密文对', '解密在右上/左下查回左上/右下'],
    examplePlain: 'HELLO',
    exampleCipher: 'MCNZMU',
    origin: 'Félix Delastelle, 1902',
    seeAlso: ['playfair', 'bifid', 'trifid'],
  },
  jwt: {
    difficulty: '入门',
    howItWorks: 'JWT（JSON Web Token）是 header.payload.signature 三段 Base64URL，用点连接。Header 声明算法；Payload 为 JSON 声明（如 sub、exp）；Signature 用密钥对前两段签名。本工具仅解码展示，不验证签名。',
    steps: ['识别 eyJ 开头三段式', 'Base64URL 解码 header/payload', 'JSON 格式化展示', '签名段仅显示，不验签'],
    examplePlain: '{"sub":"user123","name":"Test"}',
    exampleCipher: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.xxx',
    origin: 'RFC 7519',
    seeAlso: ['base64', 'gzip-base64'],
    trivia: '常见于 OAuth、API 鉴权；勿把未验签 payload 当信任依据。',
  },
};

export function enrichCipherMeta(cipher, generated = null, registryCipher = null) {
  const d = CIPHER_DETAILS[cipher.id] || {};
  const gen = generated || {};
  const examplePlain = resolveExamplePlain(cipher.id, d.examplePlain, gen.examplePlain);
  const useDetailCipher = d.exampleCipher && !isPlaceholder(d.exampleCipher)
    && examplePlain === (d.examplePlain || '');
  const genForSync = getLangSupport(cipher.id)?.includes('zh')
    ? { ...gen, examplePlain, exampleCipher: '' }
    : gen;

  const synced = registryCipher
    ? finalizeExamples(registryCipher, examplePlain, genForSync)
    : {
      examplePlain: examplePlain || gen.examplePlain || '',
      exampleCipher: useDetailCipher ? d.exampleCipher : (gen.exampleCipher || d.exampleCipher || ''),
      exampleParams: gen.exampleParams || d.exampleParams || '',
    };

  return {
    ...cipher,
    difficulty: d.difficulty || guessDifficulty(cipher),
    howItWorks: d.howItWorks || cipher.description,
    steps: d.steps || ['选择算法', '设置参数（如有）', '输入文本', '执行加解密'],
    examplePlain: synced.examplePlain,
    exampleCipher: useDetailCipher ? d.exampleCipher : synced.exampleCipher,
    exampleParams: synced.exampleParams || d.exampleParams || '',
    formula: d.formula || '',
    origin: d.origin || cipher.history || cipher.category,
    seeAlso: d.seeAlso || [],
    trivia: d.trivia || '',
  };
}

function guessDifficulty(c) {
  if (c.category === '哈希/摘要' || c.category === '非对称加密') return '高级';
  if (c.category === '对称加密') return '困难';
  if (c.category === '影视/流行文化') return '中等';
  if (c.params?.length > 1) return '中等';
  return '入门';
}

export function getDefaultDetail(id, name, category, description) {
  return enrichCipherMeta({ id, name, category, description, params: [] });
}
