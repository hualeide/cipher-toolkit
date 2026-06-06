# 部署指南

密码学工具箱是 **React 前端 + Node.js Express 后端** 全栈应用。GitHub Pages 只能托管静态页面，**完整功能（加解密、识别、多媒体）必须运行后端**。

---

## 方式对比

| 方式 | 难度 | 适用场景 |
|------|------|----------|
| [**GitHub Packages 一键 Docker**](#github-packages-一键-docker) | ⭐ | **只需 Docker，不用 clone** |
| [一键脚本](#本地一键安装) | ⭐ | 本机试用、改源码 |
| [Docker](#docker-推荐) | ⭐⭐ | 服务器/VPS、环境一致 |
| [Render 云部署](#render-一键部署) | ⭐ | 免费公网 demo（有休眠） |
| [GitHub Pages + 外部 API](#github-pages--外部后端) | ⭐⭐⭐ | 静态 CDN + 自建 API |
| [开发模式](#开发模式) | ⭐ | 改代码、跑测试 |

---

## 环境要求

- **Node.js 22+**（本地 / Docker 构建）
- **npm 10+**
- Docker（可选，推荐生产）
- 磁盘约 500MB（含 `node_modules` 与 `sharp` 原生依赖）

---

## GitHub Packages 一键 Docker

CI 每次推送到 `master` 会自动构建并发布 Docker 镜像到 **GitHub Packages**（仓库右侧「Packages / 包裹」可见）。

### 一行启动（推荐）

```bash
docker run -d -p 3001:3001 --name cipher-toolkit --restart unless-stopped ghcr.io/hualeide/cipher-toolkit:latest
```

浏览器打开 **http://localhost:3001**。

### 或使用 compose / 脚本

```bash
# 仅需 docker-compose.ghcr.yml（可从仓库 raw 下载）
docker compose -f docker-compose.ghcr.yml up -d

# 或 clone 后
./run-docker.sh      # Linux/macOS
.\run-docker.ps1     # Windows
```

### 镜像地址

| 标签 | 说明 |
|------|------|
| `ghcr.io/hualeide/cipher-toolkit:latest` | 最新 master |
| `ghcr.io/hualeide/cipher-toolkit:<sha>` | 某次提交 |
| `ghcr.io/hualeide/cipher-toolkit:v1.0.0` | 打 tag 发布 |

Package 页面：https://github.com/hualeide/cipher-toolkit/pkgs/container/cipher-toolkit

> 若 `docker pull` 报 403，在 Package 设置中将可见性设为 **Public**（公开仓库通常默认可拉取）。

---

### Windows

```powershell
git clone https://github.com/hualeide/cipher-toolkit.git
cd cipher-toolkit
.\install.ps1
```

### Linux / macOS

```bash
git clone https://github.com/hualeide/cipher-toolkit.git
cd cipher-toolkit
chmod +x install.sh
./install.sh
```

脚本会安装依赖并提示选择启动方式：

- **dev** — 热重载开发（前端 5173 + 后端 3001）
- **prod** — 构建前端并由后端统一托管（单端口 3001）
- **docker** — Docker Compose 全栈

也可手动：

```bash
npm run install:all
npm run dev          # 开发
npm run start:prod   # 生产单端口
docker compose up --build   # Docker
```

**生产单端口访问**：http://localhost:3001（前后端同源，无需配置 API 地址）

---

## Docker（推荐）

```bash
git clone https://github.com/hualeide/cipher-toolkit.git
cd cipher-toolkit
docker compose up --build -d
```

- 端口：**3001**
- 健康检查：`GET /api/health`
- 环境变量见 `docker-compose.yml`（`SERVE_FRONTEND=1` 开启静态托管）

停止：`docker compose down`

---

## Render 一键部署

1. 点击 README 中的 **Deploy to Render** 按钮，或 [直接打开](https://render.com/deploy?repo=https://github.com/hualeide/cipher-toolkit)
2. 登录 Render，确认仓库与 `render.yaml` 蓝图
3. 创建 Web Service（Free 档即可）
4. 部署完成后访问 Render 分配的 URL（如 `https://cipher-toolkit-xxxx.onrender.com`）

仓库已包含 `render.yaml`：使用 Dockerfile 构建，健康检查 `/api/health`。

> Free 实例约 15 分钟无访问会休眠，首次打开需等待冷启动。

---

## GitHub Pages + 外部后端

当前 Pages 地址：https://hualeide.github.io/cipher-toolkit/

Pages **仅有 UI**，需单独部署后端并关联：

1. 按上文 [Docker](#docker-推荐) 或 [Render](#render-一键部署) 部署后端，得到公网 URL（如 `https://cipher-toolkit.onrender.com`）
2. 打开 GitHub 仓库 → **Settings → Secrets and variables → Actions**
3. 新建 Secret：`VITE_API_BASE` = 后端根 URL（无末尾斜杠）
4. **Actions → Deploy GitHub Pages → Run workflow** 重新构建

构建后 Pages 前端会请求该 API。注意后端需开启 CORS（项目默认已 `cors()` 全开）。

若前后端同域部署（Docker / Render 单服务），**不需要** `VITE_API_BASE`。

---

## 开发模式

```bash
npm run install:all
npm run dev
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:3001 |
| 健康检查 | http://localhost:3001/api/health |

Vite 将 `/api` 代理到 3001，无需额外配置。

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 后端监听端口 |
| `SERVE_FRONTEND` | 未设置 | 设为 `1` 时托管 `frontend/dist` |
| `VITE_API_BASE` | 空 | 仅 **构建前端** 时用，指向外部 API（Pages 场景） |
| `BASE_PATH` | `/` | 仅构建时用，Pages 为 `/cipher-toolkit/` |

---

## 常见问题

**Q: Pages 打开后算法列表加载失败？**  
A: Pages 无后端。请本地/Docker/Render 部署，或配置 `VITE_API_BASE`。

**Q: `sharp` 安装失败？**  
A: 需 Node 22+ 与可用网络；Windows 可试 `npm install --prefix backend --build-from-source=sharp`。

**Q: 如何只跑 CLI 不启 Web？**  
A: `node backend/scripts/cipher-file.mjs --help`

**Q: 如何跑测试？**  
A: 仓库根目录 `npm test`

---

## 架构示意

```
浏览器
  ├─ 开发: localhost:5173 ──proxy /api──▶ Express :3001
  ├─ 生产/Docker: localhost:3001 ──同源 /api──▶ Express
  └─ Pages: hualeide.github.io/... ──fetch──▶ 外部 API（需 VITE_API_BASE）
```
