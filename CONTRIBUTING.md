# 贡献指南

感谢考虑为本项目贡献！密码学工具箱面向密码爱好者与 CTF/ARG 学习者，欢迎算法修复、识别改进、文档与测试。

## 开始之前

1. 阅读 [README.md](./README.md) 与 [DEPLOY.md](./DEPLOY.md)
2. Fork 仓库并创建分支（如 `fix/morse-trad`、`feat/cipher-xxx`）
3. 本地安装：`npm run install:all`

## 开发

```bash
npm run dev          # 前端 5173 + 后端 3001
npm test             # 全模块自测（必跑）
```

### 新增算法

1. 在 `backend/src/ciphers/` 实现编解码
2. 注册到 `registry.js`，补充 `cipherDetails.js` / `cipherExamples.js`
3. 若需识别：更新 `identifier.js` / `identifyScore.js`
4. 在 `test-identify-roundtrip.js` 或对应测试中覆盖
5. 运行 `node backend/scripts/gen-readme.mjs` 更新 README 算法表

### 识别改进

- 优先写/改测试用例（`test-identify*.js`）
- 中文语料压测：`node backend/test-identify-bible-zh.js`（慢，可选 `BIBLE_LIMIT=500`）
- 勿为单条用例破坏全局排序；参考 `ID_ALIASES` 与 verified 逻辑

### 前端

- 组件在 `frontend/src/`，风格与现有页面一致
- i18n：`frontend/src/i18n/locales/*.js`

## 提交规范

- 提交信息用英文或中文均可，说明 **为什么** 改
- 一个 PR 聚焦一件事（一个 bug 或一个功能）
- **必须** `npm test` 全绿后再提 PR

## Pull Request

- 描述问题、方案、测试方式
- 若改识别逻辑，贴 before/after 识别结果
- 大功能请先开 Issue 讨论

## 报告问题

使用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.yml)，附上密文样例、期望算法、实际识别结果。

## 许可

贡献代码以 [MIT License](./LICENSE) 发布。
