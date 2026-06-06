# 密码学工具箱 (Cipher Toolkit)

> **面向密码爱好者的学习与实验平台** — 无需安装专业软件，在浏览器里即可加解密、自动识别、组合链解密、分析密文统计，并动手玩中文码点密码、古典密码与现代算法。适合 CTF 入门、历史密码学课程、ARG 解谜与自学。

整合 **98** 种加密/编码/变换方式的全栈 Web 工具，**中文识别**是本项目核心能力之一（和合本/名著语料压测、码点凯撒优先、摩斯繁简电报码等）。

**在线仓库**：[github.com/hualeide/cipher-toolkit](https://github.com/hualeide/cipher-toolkit)

---

## 你能用它做什么

| 场景 | 功能 |
|------|------|
| **学习古典密码** | 凯撒/维吉尼亚/Playfair/Bifid/Trifid 等，带百科原理与名言示例 |
| **中文加解密** | Unicode 码点凯撒/维吉尼亚/仿射，简繁体、日韩文同域运算 |
| **CTF / ARG** | 智能识别 + 组合解密 + Recipe 分享（类 CyberChef） |
| **现代密码入门** | AES / ChaCha20 / RSA / 哈希族（演示用，非生产 HSM） |
| **迷因与流行文化** | 怪诞小镇 Journal 密码、Brainfuck、SCP 涂黑等 |
| **文件与隐写** | CLI/API 文件加解密、格式转换、PNG LSB 藏文 |

---

## 核心功能

### 加解密 & 百科
- 每种算法含**原理、步骤、历史、示例**（名言/诗词句库，非占位符）
- 加解密页与百科双向联动，支持**中/英/日/韩**界面

### 智能识别（中文优先）
- 穷举 + **可读性评分** + **往返校验**（verified）
- 乱汉字密文优先 **Unicode 码点凯撒**，抑制 upside-down/RC4 等误报
- 摩斯中文模式：标准电报码 + **繁简映射**（和合本繁体经节）

### 密文分析
| 指标 | 原理 |
|------|------|
| **熵** | 字符分布均匀度；高熵常见于压缩/加密/哈希 |
| **IC** | 重合指数；英文单表≈0.067，维吉尼亚≈0.038 |
| **频率** | 单表替换保留语言字母轮廓 |
| **Kasiski** | 重复 n-gram 间距公约数 → 密钥长度候选 |

### 组合解密 & Recipe
- **自动链**：逐层识别（如 Base64 → ROT13 → 凯撒）
- **手动链**：自选步骤顺序
- **Recipe**：保存/导出 JSON/分享链接 `#recipe=…`，本地可存 30 条

### 多媒体实验室
- 幻影坦克、图片融入、图层融合、格式互转、超分、降噪
- **LSB 藏文**：PNG 最低位嵌入文本，可配合加密后再藏

---

## 全部算法一览（98）

### 中文/多语言（4）

| 算法 | 简介 |
|------|------|
| **Unicode 码点（十进制）** `unicode-cp-decimal` | 将每个字符（中文简繁、日文假名、韩文、拉丁、标点等）转为 Unicode 十进制码点，空格分隔。编码层，可再接其他加密。 |
| **Unicode 码点凯撒** `unicode-cp-caesar` | 在 Unicode 码点数字域做循环移位，密文输出仍为汉字/假名/韩文等字符。支持简繁中文、全角标点、日文、韩文及拉丁字母。 |
| **Unicode 码点维吉尼亚** `unicode-cp-vigenere` | 用密钥各字符的码点驱动移位，多表替换。密钥可为中文、日文、英文混合。 |
| **Unicode 码点仿射** `unicode-cp-affine` | 码点域仿射变换 E(x)=(ax+b) mod N，比凯撒更安全。a 需与域大小互质。 |

### 古典替换（17）

| 算法 | 简介 |
|------|------|
| **凯撒密码** `caesar` | 将字母表中的每个字母向后移动固定位数。中文、日文、韩文及标点会在 Unicode 码点域同步移位。 |
| **ROT13** `rot13` | 移位 13 的凯撒密码。含中文/日文/韩文时在 Unicode 码点域同步移位 13。 |
| **ROT47** `rot47` | 对 ASCII 可打印字符 (33-126) 循环移位 47 位，可处理字母、数字和符号。 |
| **ROT5 (数字)** `rot5` | 仅对数字 0-9 循环移位 5 位，字母不变。 |
| **ROT18** `rot18` | ROT13 + ROT5 组合，同时处理字母和数字。 |
| **全字符 ROT** `rot-all` | 同时对字母和数字进行相同移位量的循环移位。 |
| **Atbash 密码** `atbash` | A↔Z, B↔Y, C↔X 首尾对称替换，源自希伯来字母表。 |
| **仿射密码** `affine` | 公式 E(x) = (ax + b) mod 26。a 必须与 26 互质。 |
| **关键字替换密码** `keyword-sub` | 用关键字构建替换字母表：先写密钥不重复字母，再补全剩余字母。 |
| **Playfair 密码** `playfair` | 5×5 密钥方阵对字母对 digraph 加密：同行左右移、同列上下移、否则矩形对角。比单表替换更安全，一战二战电报常用。 |
| **Hill 密码** `hill` | 线性代数矩阵加密，每两个字母为一组向量乘以 2×2 矩阵 mod 26。 |
| **Bifid 密码** `bifid` | 双分密码：5×5 Polybius 方阵，字母→(行,列) 坐标，行列序列混排后重配对取密文。破坏单表频率，Felix Delastelle 1901。 |
| **Trifid 密码** `trifid` | 三分密码：3×3×3 立方体（A-Z + 句点），每字用层/行/列三元坐标；层、行、列序列分别拼接后三位一组重组。Bifid 的三维加强版。 |
| **Four-square 密码** `four-square` | 四格密码：四个 5×5 方阵（两密钥表+两标准表），明文对取自左上/右下，密文对由右上/左下交叉行列生成。双密钥 Playfair 变体，1902。 |
| **Enigma 简化版** `enigma-simple` | 模拟 Enigma 转子替换（Educational 简化，非历史精确）。 |
| **猪圈密码 (Pigpen)** `pigpen` | Masonic 九宫格几何密码，每字母对应格位置如 A1、B2。 |
| **藏头诗 / 首字母** `acrostic` | 每行首字母连读组成隐藏信息。GF 部分页面用此技巧。 |

### 多表替换（5）

| 算法 | 简介 |
|------|------|
| **维吉尼亚密码** `vigenere` | 使用 repeating 密钥的多表凯撒密码。明文与密钥均支持中文、日文、韩文及英文混合。 |
| **Beaufort 密码** `beaufort` | 密钥字母减去明文字母 mod 26，与维吉尼亚方向相反。支持多语言明文与中文等密钥。 |
| **Autokey 密码** `autokey` | 密钥启动后，用明文/密文自身扩展密钥流。起始密钥可为中文、日文、韩文或英文。 |
| **Gronsfeld 密码** `gronsfeld` | 维吉尼亚的数字变体，每位数字决定移位量。 |
| **Running Key 密码** `running-key` | 用书页文本作为无限长密钥的维吉尼亚变体。 |

### 换位密码（3）

| 算法 | 简介 |
|------|------|
| **栅栏密码** `rail-fence` | 将文本按锯齿形写入多行后按行读出，属于换位密码。 |
| **列移位密码** `columnar` | 按密钥字母顺序重排列，明文写入网格后按列读出。 |
| **Skytale 木棍密码** `scytale` | 古希腊 Spartans 使用的 transposition 密码，纸条缠绕木棍读写。 |

### 编码/表示（26）

| 算法 | 简介 |
|------|------|
| **摩斯电码** `morse` | 国际摩斯（A–Z/0–9）；中文模式用标准电报码（四位数字发码，约七千字）。 |
| **二进制编码** `binary` | 每字符 8 位二进制，空格分隔。 |
| **十六进制** `hex` | 每字节两位十六进制。 |
| **八进制** `octal` | ASCII 八进制表示。 |
| **Base64** `base64` | RFC 4648，HTTP/邮件常用编码。 |
| **Base32** `base32` | Base32 字母数字编码。 |
| **URL 编码** `url` | Percent-encoding，%XX 形式。 |
| **HTML 实体** `html-entities` | &amp; &lt; 等 HTML 转义。 |
| **Unicode 转义** `unicode-escape` | \uXXXX JavaScript 风格。 |
| **Quoted-Printable** `quoted-printable` | 邮件 MIME 编码，=XX 表示非 ASCII。 |
| **Ascii85** `ascii85` | Adobe Base85，<~ ~> 包裹。 |
| **Bacon 密码** `bacon` | Francis Bacon 用 a/b 双字母组表示 5 位。 |
| **Tap Code** `tap-code` | 5×5 网格坐标，监狱通信用。 |
| **Polybius 方阵** `polybius` | 5×5 坐标 (行,列) 表字母。 |
| **NATO 音标** `nato` | Alpha Bravo Charlie 军事拼读。 |
| **盲文映射** `braille` | 字母到 Unicode 盲文字符。 |
| **全角字符** `fullwidth` | 半角 ASCII 转全角 Unicode。 |
| **零宽隐写** `zero-width` | 零宽字符编码隐藏信息。 |
| **Gzip+Base64** `gzip-base64` | 先 gzip 压缩再 Base64 编码。 |
| **格式转换** `format-convert` | text / hex / base64 / binary 互转，便于组合链拼接。 |
| **JWT 解析** `jwt` | JSON Web Token：header.payload.signature 三段 Base64URL，用于 API/OAuth 鉴权。本工具解码 header 与 payload JSON，不验证签名。 |
| **手机键盘码** `phone-keypad` | 电话键盘数字对应字母（简化版）。 |
| **十进制 ASCII** `decimal` | 每个字符用十进制 ASCII 码表示，空格分隔。 |
| **Base58** `base58` | Bitcoin 常用编码，去掉了易混淆字符 0OIl。 |
| **UUEncode** `uuencode` | Unix 传统编码，每行 45 字节。 |
| **A1Z26 数字密码** `a1z26` | 通用 A1Z26：A=1 … Z=26，CTF 与 ARG 常见。 |

### 文本变换（9）

| 算法 | 简介 |
|------|------|
| **文本反转** `reverse` | 字符顺序完全颠倒。 |
| **大小写互换** `swap-case` | 大写变小写，小写变大写。 |
| **Leet Speak** `leet` | a→4, e→3, o→0 等黑客文字。 |
| **Pig Latin** `pig-latin` | 英语 Pig Latin 变形。 |
| **倒置文字** `upside-down` | Unicode 倒置字符 + 反转。 |
| **Bubble 数学字母** `bubble` | Unicode 数学双线字母。 |
| **奇偶拆分** `even-odd-split` | 偶数位在前、奇数位在后。 |
| **QWERTY 键盘移位** `keyboard-shift` | 字母替换为键盘同行右移键位。 |
| **JCUKEN 俄键盘移位** `jcuken` | 俄语 JCUKEN 键盘布局移位替换。 |

### 对称加密（9）

| 算法 | 简介 |
|------|------|
| **XOR 异或** `xor` | 逐字节异或，简单对称加密。 |
| **RC4 流密码** `rc4` | 经典流密码，SSL/TLS 曾广泛使用（已弃用）。 |
| **AES-256-CBC** `aes-256-cbc` | 高级加密标准 AES，256 位密钥 CBC 模式，现代最常用对称加密之一。 |
| **AES-128-CBC** `aes-128-cbc` | AES 128 位 CBC 模式。 |
| **AES-256-GCM** `aes-256-gcm` | AES-GCM 认证加密模式，提供完整性校验。 |
| **DES** `des` | 数据加密标准，56 位密钥，已被认为不安全。 |
| **3DES (Triple DES)** `3des` | 三重 DES，密钥长度 168 位有效。 |
| **一次性密码本 (OTP)** `otp` | 理论上不可破解的加密，密钥与明文等长且只用一次。 |
| **ChaCha20-Poly1305** `chacha20` | 现代流密码 AEAD，TLS 1.3 支持。 |

### 哈希/摘要（9）

| 算法 | 简介 |
|------|------|
| **MD5 哈希** `md5` | 128 位消息摘要，已不推荐用于安全场景。单向，不可逆。 |
| **SHA-1** `sha1` | 160 位安全哈希算法，已逐步淘汰。 |
| **SHA-256** `sha256` | 256 位 SHA-2 系列，比特币、TLS 广泛使用。 |
| **SHA-512** `sha512` | 512 位 SHA-2 系列哈希。 |
| **SHA3-256** `sha3-256` | Keccak 算法标准，SHA-3 系列。 |
| **HMAC-SHA256** `hmac-sha256` | 带密钥的消息认证码，验证消息完整性。 |
| **CRC32 校验** `crc32` | 循环冗余校验，用于错误检测。 |
| **PBKDF2 密钥派生** `pbkdf2` | 从密码派生密钥，用于密码存储。 |
| **Adler-32 校验** `adler32` | zlib 使用的快速校验和。 |

### 非对称加密（1）

| 算法 | 简介 |
|------|------|
| **RSA 非对称加密** `rsa` | RSA 公钥加密、私钥解密，现代 HTTPS 基础。 |

### 影视/流行文化（5）

| 算法 | 简介 |
|------|------|
| **怪诞小镇 凯撒-3** `gf-caesar3` | Gravity Falls 最常用的 Caesar-3：每个字母在字母表中移动 3 位。Journal 3 大量 cryptogram 使用此法。 |
| **怪诞小镇 A1Z26** `gf-a1z26` | A=1, B=2 … Z=26 数字替字母。书中如「10-15-21-18-14-1-12」= JOURNAL。 |
| **怪诞小镇 Author 符号** `gf-author` | Ford Pines (The Author) 在 Journal 使用的 26 符号替换。本工具用 Unicode 符号集模拟官方 CipherFont 原理。 |
| **怪诞小镇 Bill 符号** `gf-bill` | Bill Cipher 专用符号字母表，与 Author 符号不同。出现在衍生读物与 ARG。 |
| **怪诞小镇 维吉尼亚 (PINES)** `gf-vigenere-pines` | Blendin 信件等剧情的维吉尼亚密码，固定密钥 PINES。 |

### 网络/迷因（10）

| 算法 | 简介 |
|------|------|
| **Zalgo 崩坏文本** `zalgo` | 叠加 Unicode 组合符制造「被诅咒」视觉效果，Discord/Tumblr 迷因。 |
| **Discord 剧透块** `discord-spoiler` | \|\|文字\|\| Discord Markdown 剧透语法。 |
| **Brainfuck** `brainfuck` | 极简 esolang，八种指令。CTF/程序员梗常用。 |
| **Ook! (Brainfuck 方言)** `ook` | Ook. Ook? Ook! 三种词组成，语义等同 Brainfuck。 |
| **Emoji 字母替换** `emoji` | A→🔴, B→🟠 … 社交藏信息玩法。 |
| **元素周期表密码** `periodic-table` | 用化学元素符号拼单词，STEM 梗。 |
| **SCP 涂黑** `scp-redact` | SCP 基金会风格 ███ 涂黑，不可逆。 |
| **UwU 化** `uwu` | 网络可爱化：r/l→w，末尾 uwu。 |
| **Small Caps 小型大写** `small-caps` | Unicode 小型大写字母，Instagram/Discord 装饰字体。 |
| **括号二进制迷因** `meme-binary` | (01001000) 括号包裹 8 位二进制，编程迷因格式。 |


---

## 命令行工具

```bash
# 文件加解密
node backend/scripts/cipher-file.mjs -i plain.txt -o out.bin --cipher unicode-cp-caesar --encrypt --shift 88

# 格式转换（便于拼 arg / 管道）
node backend/scripts/cipher-format.mjs -f text -t hex "你好"
```

---

## 技术栈

- **后端**: Node.js + Express
- **前端**: React + Vite

## 启动

```bash
npm run install:all
npm run dev
```

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001

## API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/ciphers | 列出所有加密方式 |
| POST | /api/ciphers/encrypt | `{ id, text, params }` |
| POST | /api/ciphers/decrypt | `{ id, text, params }` |
| POST | /api/ciphers/identify | `{ text }` 智能识别 |
| POST | /api/ciphers/analyze | `{ text }` 密文统计 |
| POST | /api/ciphers/auto-chain | 自动组合解密 |
| POST | /api/ciphers/chain-decrypt | 手动链解密 |
| POST | /api/ciphers/file | 文件加解密（multipart） |
| POST | /api/media/stego/embed | 图片 LSB 藏文 |
| POST | /api/media/stego/extract | 图片 LSB 提取 |

## 测试

```bash
npm test
# 和合本压测（慢）: node backend/test-identify-bible-zh.js
```

含 10 轮全算法识别回环（严格档置信度 ≥95）、文本分析、多语言、文件/LSB 等自测。

---

## 免责声明

本工具仅供**教育、研究与娱乐**。请勿用于非法用途。现代算法演示默认参数不适合保护真实敏感数据；生产环境请使用经审计的密码库与密钥管理。

## 许可

见仓库 LICENSE（如未单独声明，以仓库默认为准）。
