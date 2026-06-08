# 识别压测与基准

## 快速自测（CI 每次运行）

| 套件 | 规模 | 结果 |
|------|------|------|
| `npm run test:e2e` | Playwright **7** 用例（导航/识别/加解密/组合链） | CI 每次运行 |
| `test-identify-roundtrip.js` | 78 算法 × 10 轮，置信度 ≥95 | **780/780** |
| `test-identify.js` | 28 条手工/CTF 用例 | **28/28** |
| `test-identify-zh-slang.js` | 口语库 33969 条抽样 | **6/6** |
| `test-identify-zh-samples.js` | 中文句 × 可识别算法（`ZH_SAMPLES=5` 抽样） | **173/173** |
| `test-identify-polish.js` | 打磨用例（含英文凯撒消歧） | 通过 |
| `test-identify-confidence.js` | 置信度间隔 | 通过 |
| `test-chinese-all.js` | 全算法中文 | **85/85** |

运行：`npm test`

## 演示与算法说明

- 粘贴即用样例与 API 演示：[docs/DEMO.md](./docs/DEMO.md)
- 识别评分、自然度语料、LLM 重排原理：[docs/IDENTIFY-TECH.md](./docs/IDENTIFY-TECH.md)

## 和合本全文压测（慢）

```bash
node backend/scripts/parse-bible-zh.mjs   # 首次
node backend/test-identify-bible-zh.js    # 30556 节 × 15 核心算法
```

环境变量：

| 变量 | 默认 | 说明 |
|------|------|------|
| `MIN_CONFIDENCE` | 90 | 最低置信度 |
| `BIBLE_LIMIT` | 0 | 限制节数（0=全文） |
| `BIBLE_CIPHER` | 空 | 只测单一算法 |
| `PROGRESS_EVERY` | 2000 | 进度间隔 |

**核心 15 算法**：码点凯撒/维吉尼亚/仿射、凯撒/ROT13/ROT-all、Atbash/仿射、维吉尼亚/Beaufort/Autokey/Gronsfeld/Running-key、摩斯、GF 凯撒/维吉尼亚。

### 历史结果（2026-06，MIN_CONFIDENCE=90）

| 进度 | 通过率 |
|------|--------|
| 5000 次 | 100.00% |
| 10000 次 | 100.00% |
| 15000 次 | 99.99% |
| 20000 次 | 99.99% |

全文 30556×15 压测耗时约 1–2 小时；完整总计见 `backend/bible-full-run.log`。

## 四大名著（bootstrap）

`test-identify-classic-zh.js`：bootstrap 80 句 **99.58%**。全文需 `node backend/scripts/fetch-classics-zh.mjs`（需网络）。

## 已知弱项

- `autokey` / `gronsfeld` 长密钥中文场景识别率低于凯撒/维吉尼亚
- 纯编码层（hex/base64）与加密链组合需手动链解密

改进识别请附带 failing 密文与 `npm test` 用例，见 [CONTRIBUTING.md](./CONTRIBUTING.md)。
