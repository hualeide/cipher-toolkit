# 功能演示与样例

本文档提供可在 **自动识别 / 加解密 / 组合解密** 页面直接粘贴的样例，以及对应 API 调用方式。在线体验需运行完整后端（Docker 或 `npm run dev`），GitHub Pages 仅静态预览无识别能力。

---

## 快速体验（Web UI）

| 步骤 | 操作 |
|------|------|
| 1 | 启动：`docker run -d -p 3001:3001 ghcr.io/hualeide/cipher-toolkit:latest` 或 `npm run dev` |
| 2 | 打开 **自动识别**，粘贴下方密文或点击样例 chip |
| 3 | 查看左侧识别结果与右侧 **熵 / IC / 频率 / Kasiski** 统计 |
| 4 | 点击 **前往加解密** 可带参数跳转对应算法 |

---

## 自动识别样例

| 场景 | 粘贴内容 | 期望算法 | 解密结果 |
|------|----------|----------|----------|
| 英文凯撒 | `KHOOR` | 凯撒密码 shift=3 | `HELLO` |
| Base64 | `aGVsbG8=` | Base64 | `hello` |
| 摩斯电码 | `.... . .-.. .-.. ---` | 摩斯电码 | `HELLO` |
| 中文凯撒 | `侸姕乮疤` | 凯撒密码（Unicode 码点域） | `你好世界` |
| 混排句 | （见下方生成） | 凯撒 shift=3 | `Hello，世界！2024` |
| 英文口令 | `ATTACK AT DAWN` 凯撒 shift=5 密文 | 凯撒 + 词典消歧 | `ATTACK AT DAWN` |

**混排句密文生成**（本地）：

```bash
node -e "import { encrypt } from './backend/src/ciphers/registry.js'; console.log(encrypt('caesar','Hello，世界！2024',{shift:3}))"
```

更多结构化样例见 [`demo-samples.json`](./demo-samples.json)，可用于脚本回归或教学。

---

## 加解密页演示

1. 左侧列表选 **维吉尼亚密码**，密钥填 `KEY`
2. 明文框输入 `MEET AT DAWN`，右侧自动出密文
3. 或仅在密文框粘贴密文，左侧自动还原明文
4. 每侧均有 **粘贴 / 复制** 按钮

**中文码点维吉尼亚**：选 `Unicode 码点维吉尼亚`，密钥 `中文`，明文 `我爱中国`。

---

## 组合解密演示

粘贴多层密文，系统自动尝试解密链：

```
aGVsbG8=          → 单层 Base64 → hello
（凯撒后再 Base64 的样例可在加解密页逐层加密后粘贴测试）
```

---

## API 演示

### 识别（同步，默认无 LLM）

```bash
curl -s -X POST http://localhost:3001/api/ciphers/identify \
  -H "Content-Type: application/json" \
  -d '{"text":"KHOOR","limit":5}' | jq '.matches[0] | {name, result, confidence, verified}'
```

### 识别 + LLM 重排（需配置 API Key，见 [IDENTIFY-TECH.md](./IDENTIFY-TECH.md)）

```bash
curl -s -X POST http://localhost:3001/api/ciphers/identify \
  -H "Content-Type: application/json" \
  -d '{"text":"KHOOR","limit":5,"llmRerank":true}' | jq '.matches[] | {name, result, score, llmScore}'
```

### 密文统计

```bash
curl -s -X POST http://localhost:3001/api/ciphers/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"KHOOR"}' | jq '{entropy, indexOfCoincidence, hints}'
```

### 加解密

```bash
curl -s -X POST http://localhost:3001/api/ciphers/encrypt \
  -H "Content-Type: application/json" \
  -d '{"id":"caesar","text":"HELLO","params":{"shift":3}}'
```

完整端点见 [`openapi.yaml`](./openapi.yaml) 或运行时 `GET /api/openapi.yaml`。

---

## 压测与演示脚本

| 命令 | 说明 |
|------|------|
| `npm test` | 全模块自测（识别 / 多语言 / 媒体等） |
| `npm run test:e2e` | Playwright 7 项 UI 回归 |
| `node backend/test-identify-zh-samples.js` | 中文句 × 算法识别率统计 |
| `ZH_SAMPLES=5 node backend/test-identify-zh-samples.js` | 抽样加速（约 173 用例） |
| `node backend/test-identify-polish.js` | 识别打磨用例（含英文凯撒消歧） |

压测说明见 [BENCHMARKS.md](../BENCHMARKS.md)。

---

## 向老师 / 答辩怎么介绍

**推荐说法**（详见 [IDENTIFY-TECH.md § 常见误解](./IDENTIFY-TECH.md#常见误解对外介绍时请避免)）：

1. 项目是什么：**多算法密码学 Web 工具箱**（加解密、自动识别、组合链、密文统计）。
2. 识别怎么做：**穷举算法参数 → 规则打分（含中文语料自然度）→ 加密往返验证 → 排序输出**。
3. LLM：**可选插件**，只在多个候选都像明文时帮忙重排；**默认关闭**，演示可不提或强调「可关」。
4. 创新点落在：**中文场景识别工程 + 集成完整度 + 压测文档**，而非新密码或 LLM 算法。

**避免说法**：「大模型解密」「没有 LLM 就乱码」「语序排序」「LLM 加解密创新」。

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [IDENTIFY-TECH.md](./IDENTIFY-TECH.md) | 识别评分、自然度算法、LLM 重排原理 |
| [BENCHMARKS.md](../BENCHMARKS.md) | 通过率与和合本压测 |
| [DEPLOY.md](../DEPLOY.md) | Docker / Render / 环境变量 |
