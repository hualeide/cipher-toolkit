# 安全政策

## 支持的版本

| 版本   | 支持 |
|--------|------|
| 1.0.x  | ✅   |

## 报告漏洞

本工具为**教育/演示**用途，现代算法使用默认参数，**不适合保护真实敏感数据**。

若发现可导致远程代码执行、未授权访问或敏感信息泄露的安全问题，请通过 GitHub [Security Advisories](https://github.com/hualeide/cipher-toolkit/security/advisories/new) 私下报告，勿公开 Issue。

一般性加固建议（速率限制、Helmet、上传大小）欢迎直接提 PR。

## 已知限制

- API 默认无鉴权，部署到公网请自行加反向代理/防火墙
- 文件上传限制 32MB（`multer`），仅内存处理
- 哈希/对称/非对称算法为 Node `crypto` 演示实现，非 FIPS 审计版本
