# Windows 桌面版（.exe）

无需安装 Node / Docker，**双击运行**，自动打开浏览器使用全部功能（识别、加解密、多媒体等）。

---

## 使用者

**推荐**：下载 Release 里的 `CipherToolkit-win64.zip`，解压后双击 **`CipherToolkit.cmd`**（有黑色窗口，状态清晰）。

也可直接双击 `CipherToolkit.exe`（v1.0.3+ 会自动弹出 cmd 窗口）。

1. 等待黑窗口出现「已就绪」
2. 浏览器应自动打开 `http://127.0.0.1:3001`（若未打开，手动访问该地址）
3. **关闭黑窗口**即停止服务

> 若仍无窗口：看解压目录里的 `desktop.log`；或确认 3001 端口未被占用。

> 首次运行可能触发 Windows SmartScreen，选「仍要运行」即可（未签名 exe 常见）。

防火墙若提示，允许 **本地** 访问即可。

---

## 开发者：自己打包 exe

**必须在 Windows 上**执行（因 `sharp` 图片库需 Windows 原生二进制）：

```powershell
.\scripts\build-win.ps1
# 或
npm run build:win
```

产物：`release/CipherToolkit.exe`（约 80–120MB，内嵌 Node + 后端 + 前端静态文件）。

### 本地调试（不打包）

```bash
npm run install:all
npm run build --prefix frontend
npm run start:desktop
```

---

## 技术说明

| 项 | 说明 |
|----|------|
| 打包工具 | [caxa](https://github.com/leafac/caxa) — 内嵌 Node 运行时与资源 |
| 入口 | `scripts/desktop-launcher.mjs` |
| 端口 | 默认 `3001`，仅监听 `127.0.0.1` |
| 环境变量 | 可选 `PORT`、`NO_BROWSER=1`（不自动开浏览器） |

与 Docker / `npm run start:prod` 相同：单进程托管 API + `frontend/dist`。

---

## 分发建议

- 压缩为 `CipherToolkit-win64.zip` 上传 GitHub **Releases**
- README 中注明：Windows 10/11 64 位，无需 Node
- 多媒体/识别功能与 Web 版一致；**勿用于生产级保密**
