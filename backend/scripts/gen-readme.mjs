import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registry } from '../src/ciphers/registry.js';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../README.md');
const order = ['中文/多语言', '古典替换', '多表替换', '换位密码', '编码/表示', '文本变换', '对称加密', '哈希/摘要', '非对称加密', '影视/流行文化', '网络/迷因'];
const byCat = {};
for (const c of registry) (byCat[c.category] ??= []).push(c);

let algos = '';
for (const cat of order) {
  const list = byCat[cat];
  if (!list) continue;
  algos += `### ${cat}（${list.length}）\n\n| 算法 | 简介 |\n|------|------|\n`;
  for (const c of list) {
    const d = c.description.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    algos += `| **${c.name}** \`${c.id}\` | ${d} |\n`;
  }
  algos += '\n';
}

const md = `# 密码学工具箱 (Cipher Toolkit)

> **面向密码爱好者的学习与实验平台** — 无需安装专业软件，在浏览器里即可加解密、自动识别、组合链解密、分析密文统计，并动手玩中文码点密码、古典密码与现代算法。适合 CTF 入门、历史密码学课程、ARG 解谜与自学。

整合 **${registry.length}** 种加密/编码/变换方式的全栈 Web 工具，**中文识别**是本项目核心能力之一（和合本/名著语料压测、码点凯撒优先、摩斯繁简电报码等）。

**在线仓库**：[github.com/hualeide/cipher-toolkit](https://github.com/hualeide/cipher-toolkit) · **Pages 预览（仅 UI）**：[hualeide.github.io/cipher-toolkit](https://hualeide.github.io/cipher-toolkit/)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/hualeide/cipher-toolkit)

> **完整功能**需运行后端。最快上手：克隆后执行 \`.\install.ps1\`（Windows）或 \`./install.sh\`（Linux/macOS），详见 **[DEPLOY.md](./DEPLOY.md)**。

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
- **Recipe**：保存/导出 JSON/分享链接 \`#recipe=…\`，本地可存 30 条

### 多媒体实验室
- 幻影坦克、图片融入、图层融合、格式互转、超分、降噪
- **LSB 藏文**：PNG 最低位嵌入文本，可配合加密后再藏

---

## 全部算法一览（${registry.length}）

${algos}
---

## 命令行工具

\`\`\`bash
# 文件加解密
node backend/scripts/cipher-file.mjs -i plain.txt -o out.bin --cipher unicode-cp-caesar --encrypt --shift 88

# 格式转换（便于拼 arg / 管道）
node backend/scripts/cipher-format.mjs -f text -t hex "你好"
\`\`\`

---

## 技术栈

- **后端**: Node.js + Express
- **前端**: React + Vite

## 快速开始

### 一键安装（推荐）

\`\`\`powershell
# Windows
git clone https://github.com/hualeide/cipher-toolkit.git
cd cipher-toolkit
.\\install.ps1
\`\`\`

\`\`\`bash
# Linux / macOS
git clone https://github.com/hualeide/cipher-toolkit.git
cd cipher-toolkit
chmod +x install.sh && ./install.sh
\`\`\`

### 手动启动

\`\`\`bash
npm run install:all
npm run dev          # 开发：前端 5173 + 后端 3001
npm run start:prod   # 生产：单端口 3001（前后端同源）
docker compose up --build   # Docker 全栈
\`\`\`

| 模式 | 地址 |
|------|------|
| 开发 | http://localhost:5173 |
| 生产 / Docker | http://localhost:3001 |
| API 健康检查 | http://localhost:3001/api/health |

**部署文档**：[DEPLOY.md](./DEPLOY.md)（Render 一键云部署、Pages + 外部 API、环境变量、FAQ）

## API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/ciphers | 列出所有加密方式 |
| POST | /api/ciphers/encrypt | \`{ id, text, params }\` |
| POST | /api/ciphers/decrypt | \`{ id, text, params }\` |
| POST | /api/ciphers/identify | \`{ text }\` 智能识别 |
| POST | /api/ciphers/analyze | \`{ text }\` 密文统计 |
| POST | /api/ciphers/auto-chain | 自动组合解密 |
| POST | /api/ciphers/chain-decrypt | 手动链解密 |
| POST | /api/ciphers/file | 文件加解密（multipart） |
| POST | /api/media/stego/embed | 图片 LSB 藏文 |
| POST | /api/media/stego/extract | 图片 LSB 提取 |

## 测试

\`\`\`bash
npm test
# 和合本压测（慢）: node backend/test-identify-bible-zh.js
\`\`\`

含 10 轮全算法识别回环（严格档置信度 ≥95）、文本分析、多语言、文件/LSB 等自测。

---

## 部署方式

| 方式 | 命令 / 链接 | 说明 |
|------|-------------|------|
| **本地一键** | \`install.ps1\` / \`install.sh\` | 装依赖并可选启动 |
| **Docker** | \`docker compose up --build\` | 推荐服务器部署 |
| **Render 云** | [Deploy to Render](https://render.com/deploy?repo=https://github.com/hualeide/cipher-toolkit) | 免费公网 demo |
| **GitHub Pages** | [在线预览](https://hualeide.github.io/cipher-toolkit/) | 仅静态 UI，需配 \`VITE_API_BASE\` |

完整步骤、环境变量与 FAQ → **[DEPLOY.md](./DEPLOY.md)**

---

## 免责声明

本工具仅供**教育、研究与娱乐**。请勿用于非法用途。现代算法演示默认参数不适合保护真实敏感数据；生产环境请使用经审计的密码库与密钥管理。

## 许可

见仓库 LICENSE（如未单独声明，以仓库默认为准）。
`;

writeFileSync(out, md, 'utf8');
console.log('Wrote', out, 'with', registry.length, 'ciphers');
