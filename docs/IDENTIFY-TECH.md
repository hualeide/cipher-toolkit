# 智能识别：技术说明

本文说明 **密码学工具箱** 自动识别模块的核心算法：穷举解密、**可读性 / 自然度评分**、往返校验（verified）、以及可选的 **LLM 重排序**。实现代码位于 `backend/src/services/`。

---

## 总体流程

```mermaid
flowchart LR
  A[输入密文] --> B[形态检测与早停]
  B --> C[穷举各算法参数]
  C --> D[scoreDecryptCandidate]
  D --> E[compareIdentifyHits 排序]
  E --> F{LLM 重排开启?}
  F -->|是| G[rerankIdentifyCandidates]
  F -->|否| H[finalizeIdentifyResults]
  G --> H
  H --> I[Top-N 结果 + 置信度]
```

1. **早停**：Base64 / Hex / 摩斯形态等优先走专用分支，减少误报。
2. **穷举**：对凯撒 1–26 移位、维吉尼亚密钥候选、ROT 族等生成解密结果。
3. **打分**：每个候选计算 `score`、`readable`、`verified`。
4. **排序**：同 verified 结果按语料匹配、词典覆盖率、可读分差排序。
5. **LLM（可选）**：对 Top verified 候选做自然语言可读性二次评估并融合分数。
6. **输出**：置信度、与次优差距、是否已校验等元数据。

---

## 可读性与自然度评分

识别不依赖单一「使用率」指标，而是多层评分叠加。下表为各模块职责：

| 模块 | 文件 | 作用 |
|------|------|------|
| 英文可读性 | `engine.js` → `scorePlaintext` | 字母频率、词典词、英文 IC、空格与标点 |
| 多语言可读性 | `unicodeCipher.js` → `scorePlaintextMultilingual` | CJK / 假名 / 韩文常用字覆盖 |
| **中文自然度** | `zhFreqCorpus.js` → `scoreZhNaturalness` | 字频 log + 2/3-gram 语料概率 + 生僻字惩罚 |
| **英文词典覆盖率** | `engine.js` → `scoreEnglishLexicon` | 凯撒多移位消歧（如 `ATTACK AT DAWN` vs 误报） |
| 综合可读分 | `identifyScore.js` → `scoreReadableText` | 上述分数加权合并 |
| 语料命中 | `exampleCorpus` / `bibleCorpus` / `classicCorpus` | 名言、和合本、四大名著精确或 tier 匹配 |

### 中文自然度算法（`scoreZhNaturalness`）

语料来源：**四大名著句库**、**示例句库**、**口语 slang 文件**、现代短句（如「康神开播了」），启动时构建：

- 单字频率 `charFreq`
- 二字组 `bigramFreq`、三字组 `trigramFreq`

对候选明文计算：

1. 各汉字 log 概率均值（拉普拉斯平滑 `SMOOTH=0.5`）
2. 2-gram / 3-gram 对数概率加成
3. 扩展区 / 生僻 CJK 字符惩罚
4. 映射到 **0–100** 自然度分

短句纯中文解密若自然度过低，会降权或取消 `verified`，抑制「乱移位汉字」误报。

### 英文词典覆盖率（`scoreEnglishLexicon`）

对纯英文凯撒类候选：

- 词典命中词 +1，长未知词（≥4 字母）−0.65
- 覆盖率 = 加权命中 / 词数，范围 0–1
- 在 `scoreDecryptCandidate` 中：`score += lex × 28`，并对未知长词额外扣分
- 在 `compareIdentifyHits` 中：verified 且结果不同时，优先词典覆盖率更高者

用于解决 `EXXEGO EX HEAR`（含 `hear`）压过 `ATTACK AT DAWN` 类问题。

### 候选打分（`scoreDecryptCandidate`）

主要规则摘要：

| 条件 | 效果 |
|------|------|
| 解密可读分 − 输入可读分 ≥ 20 | +12 加成 |
| 标点数量保持或增加 | +10 |
| 摩斯形态输入 | +18 |
| `verifyRoundtrip` 成功 | 标记 verified，并按算法族加减权 |
| 乱码 trivial 变换（upside-down 等）对 Unicode 密文 | 大幅降权 |
| 纯英文凯撒 + 低词典覆盖 | 限制 verified |

**verified** 含义：用同一算法与参数将解密结果 **再加密** 能还原原密文（JWT、摩斯等有特例处理）。流密码 RC4/XOR 等「任意明文可往返」的算法需结合可读分才可信。

### 排序（`compareIdentifyHits`）

优先级大致为：

1. 已是明文 > 加密结果
2. verified > 未 verified
3. 混排自然句 > 纯拉丁乱码
4. 语料 tier（和合本 / 名著 / 示例）
5. 英文词典覆盖率（凯撒族）
6. readable 分差 ≥ 10
7. 原始 score

---

## 可选：LLM 重排序

> 代码：`backend/src/services/identifyLlmRerank.js`  
> 默认 **关闭**，不影响离线识别与 CI。

### 何时启用

| 方式 | 说明 |
|------|------|
| 环境变量 | `IDENTIFY_LLM_RERANK=1` 且配置 `OPENAI_API_KEY` |
| API 请求体 | `POST /api/ciphers/identify` 传 `"llmRerank": true` |

### 工作流程

1. 同步识别得到已排序候选列表
2. 取 Top **5** 个 **verified** 且结果互异的候选组成 pool
3. 调用 Chat Completions（默认 `gpt-4o-mini`），要求返回 JSON：`{"1":0.92,"2":0.15,...}` 表示各候选「像正确解密的自然度」
4. **融合分数**：`score = round(base × 0.6 + llmScore × 100 × 0.4)`
5. 按 `compareIdentifyHits` 重新排序
6. 相同密文+候选池 **内存缓存**，避免重复计费

### 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `IDENTIFY_LLM_RERANK` | 未设置 | 设为 `1` 启用 |
| `OPENAI_API_KEY` | — | API 密钥（必填） |
| `IDENTIFY_LLM_BASE_URL` | `https://api.openai.com/v1` | 兼容 OpenAI 协议的中转 |
| `IDENTIFY_LLM_MODEL` | `gpt-4o-mini` | 模型名 |

示例见仓库根目录 [`.env.example`](../.env.example)。

### 设计原则

- **LLM 只做重排，不做穷举**：算法层仍负责候选生成与 verified 校验，避免幻觉直接当解密结果。
- **失败静默降级**：无 Key、HTTP 错误或 JSON 解析失败时返回原排序。
- **成本可控**：仅多候选且 verified≥2 时调用；pool 上限 5；有缓存。

---

## 常见误解（对外介绍时请避免）

向别人（老师、学长、答辩）介绍时，最容易说歪的几句话及**正确说法**如下。

### 误解 1：「用大模型做加解密 / 解密靠 LLM」

| | |
|---|---|
| **不对** | LLM 不参与加密、不参与穷举密钥、不生成解密结果。 |
| **实际** | 加解密由 `registry.js` 里各算法的数学/编码规则完成；识别由穷举 + 规则打分 + `verifyRoundtrip` 完成。 |
| **LLM 唯一作用** | 在**已有多个通过往返校验的候选明文**之间，按「像不像人话」**重新排序**。 |

### 误解 2：「没有 LLM 就只能出乱码 / 大模型负责语序排序」

| | |
|---|---|
| **不对** | 关闭 LLM（默认）时识别照常工作；压测、CI、E2E 均不依赖 LLM。 |
| **实际** | 「像不像正确明文」主要靠 **字频/2-3gram 自然度**、**英文词典覆盖率**、**语料命中**、**字母 IC/频率** 等规则；乱码候选会被降权或取消 verified。 |
| **和 Embedding 的区别** | 训练时的 **位置编码 / Embedding** 是模型内部表示，与本项目的「密文→候选明文→打分排序」是**不同问题**；不能混为一谈。 |

### 误解 3：「LLM 把乱序句子排成通顺句」

| | |
|---|---|
| **不对** | 本项目不做 NLP 语序恢复、不做「把打乱词序的句子重排」。 |
| **实际** | 凯撒/维吉尼亚等是在**字符或码点**上替换/移位；识别是在多种**算法假设**下各解出一版字符串，再比较哪一版更像自然语言。 |

### 误解 4：「这是 LLM 创新 / 密码学新算法」

| | |
|---|---|
| **不对** | 可选 LLM 层是常见的 **rerank** 思路，权重固定为 60% 规则 + 40% LLM，属于工程插件。 |
| **实际亮点** | **98 种算法集成**、**中文 Unicode 码点密码**、**识别侧语料自然度与 verified 工程**、可复现压测与文档——定位是 **CTF/ARG/密码学学习工具**，不是新密码体制或 LLM 论文。 |

### 一句话定位（推荐口径）

> **密码学工具箱**：多算法加解密与自动识别的 Web 集成平台；识别核心为 **穷举 + 规则自然度评分 + 加密往返验证**；LLM 为**可选**的候选重排，默认关闭。

### 和 CyberChef 等的区别（简要）

| 维度 | 本仓库 |
|------|--------|
| 侧重 | 中文/多语言码点密码、识别排序、百科与压测 |
| 识别 | 自带打分与 verified，非仅列出所有解码尝试 |
| LLM | 可选，非必需 |

---

## 项目边界（客观说明）

适合用来展示的能力：

- 全栈工程（React + Express + Docker + CI + E2E）
- 密码学**教学/CTF**向的多算法集成与 UI
- 中文识别启发式（语料、自然度、误报抑制）与可跑通的测试/文档

不适合夸大的方面：

- **不是**生产级密码库；演示用 AES/RSA 等勿用于真实保密
- **不是** LLM 或密码学方向的学术 novelty；LLM 层可整段关掉不影响主功能
- 部分全量测试套件仍有已知弱项（见 [BENCHMARKS.md](../BENCHMARKS.md)）

---

## 置信度与前端展示

`finalizeIdentifyResults` 根据：

- 最高与次高 score 差距（`scoreGap`）
- verified 比例
- readable 水平

划分 `confidenceLevel`：`high` / `medium` / `low`，并映射为 0–100 的 `confidence` 百分比。差距小且多候选接近时标记低置信，提示用户查看「其他可能」。

---

## 扩展与贡献

| 目标 | 建议 |
|------|------|
| 新算法识别 | 在 `registry.js` 注册并实现 `getIdentifyParams` 穷举参数 |
| 中文误报 | 向 `zhFreqCorpus.js` / slang 语料加句；或 `test-identify-polish.js` 加用例 |
| 英文凯撒 | 扩充 `engine.js` `WORD_SET`；调整 `scoreEnglishLexicon` 权重 |
| LLM 提示词 | 修改 `identifyLlmRerank.js` 中 `buildPrompt`，PR 请附 A/B 样例 |

提交 PR 前请运行 `npm test` 与 `npm run test:e2e`，详见 [CONTRIBUTING.md](../CONTRIBUTING.md)。
