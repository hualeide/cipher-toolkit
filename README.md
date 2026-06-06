# 密码学工具箱 (Cipher Toolkit)

整合 **97** 种加密/编码方式的 full-stack Web 工具。

## 功能

### 加解密 & 百科
- **97 种算法**：古典（凯撒/维吉尼亚/Playfair/Bifid/Trifid/Four-square）、编码（Base64/JWT）、现代加密、怪诞小镇专题等
- 百科含**原理、步骤、示例、来源**；加解密页双向联动，支持中英日韩

### 智能识别
- 穷举解密 + **可读性评分** + **往返校验**（verified）
- **置信度**：综合分数、与次优差距、中文加成；严格档回环测试 ≥95

### 密文分析（识别/组合解密侧栏）
| 指标 | 原理 |
|------|------|
| **熵** | 字符分布均匀度；高熵常见于压缩/加密/哈希 |
| **IC** | 重合指数；英文单表≈0.067，多表（维吉尼亚）≈0.038 |
| **频率** | 单表替换会保留语言字母轮廓 |
| **Kasiski** | 重复 n-gram 间距公约数 → 维吉尼亚密钥长度候选 |

### 组合解密
- **自动链**：逐层识别拼接（如 Base64 → ROT13 → 凯撒）
- **手动链**：自选步骤顺序，逐步剥离多层密文
- **Recipe**：保存/导出 JSON/分享链接 `#recipe=…`（类 CyberChef），本地可存 30 条

### 多媒体实验室
- 幻影坦克、图片融入、图层融合、格式互转、超分、降噪

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

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/ciphers | 列出所有加密方式 |
| POST | /api/ciphers/encrypt | `{ id, text, params }` |
| POST | /api/ciphers/decrypt | `{ id, text, params }` |
| POST | /api/ciphers/identify | `{ text }` 智能识别 |
| POST | /api/ciphers/analyze | `{ text }` 密文统计分析 |
| POST | /api/ciphers/auto-chain | `{ text }` 自动组合解密 |
| POST | /api/ciphers/chain-decrypt | `{ text, steps }` 手动链解密 |

## 测试

```bash
npm test
```

含 10 轮全算法识别回环（严格档置信度 ≥95）、文本分析、多语言等自测。
