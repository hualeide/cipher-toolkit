# Changelog

本文件记录 notable 变更。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [Unreleased]

### Added

- 文档：[docs/DEMO.md](./docs/DEMO.md) 功能演示与 API 样例
- 文档：[docs/IDENTIFY-TECH.md](./docs/IDENTIFY-TECH.md) 识别自然度评分与 LLM 重排说明
- [docs/demo-samples.json](./docs/demo-samples.json) 结构化演示数据
- [.env.example](./.env.example) 环境变量模板（含 LLM）

### Changed

- 识别：中文自然度（字频/2-3gram）、英文词典消歧、可选 LLM 重排
- 前端 UI 打磨：暗色默认、无跳动加载、算法名标题、「自然语言」标签、复制粘贴按钮

## [1.0.1] - 2026-06-06

### Added

- 社区文档：CONTRIBUTING、SECURITY、BENCHMARKS、OpenAPI
- GitHub Issue/PR 模板、Dependabot、CI 前端构建与 Docker 冒烟
- README 界面截图与文档索引
- 运行时 `/api/openapi.yaml` 端点

### Fixed

- i18n 算法数量 97 → 98
- 识别测试：中文维吉尼亚接受 `unicode-cp-vigenere`

## [1.0.0] - 2026-06-06

### Added

- 98 种加密/编码/变换算法，含中文 Unicode 码点密码族
- 中文优先智能识别（可读性评分 + verified 往返校验）
- Recipe 组合链保存/分享、密文统计分析（熵/IC/Kasiski）
- 多媒体实验室（幻影坦克、LSB 藏文、格式互转等）
- 文件加解密 CLI（`cipher-file.mjs`）与格式转换 CLI（`cipher-format.mjs`）
- 多语言 UI（中/英/日/韩）
- GitHub Pages 在线预览、Docker 镜像（GitHub Packages）
- 一键安装脚本（`install.ps1` / `install.sh` / `run-docker.*`）
- Render 蓝图部署（`render.yaml`）
- 部署文档 [DEPLOY.md](./DEPLOY.md)

### Fixed

- 中文密文识别：码点凯撒优先，抑制 upside-down/RC4 误报
- 摩斯中文：繁简映射 + 电报码
- 识别测试：纯中文维吉尼亚接受 `unicode-cp-vigenere`

[1.0.1]: https://github.com/hualeide/cipher-toolkit/releases/tag/v1.0.1
[1.0.0]: https://github.com/hualeide/cipher-toolkit/releases/tag/v1.0.0
