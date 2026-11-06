# NovelCraft GitHub 部署配置文件集合
# 包含 Dockerfile, docker-compose.yml, github-action.yml, README.md

=== Dockerfile ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]

=== docker-compose.yml ===
version: '3.8'
services:
  novelcraft:
    build: .
    container_name: novelcraft-app
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    restart: unless-stopped

=== .github/workflows/deploy.yml ===
name: Build & Deploy NovelCraft

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - name: Install dependencies
        run: npm install
      - name: Build Project
        run: npm run build
      - name: Test Build Artifacts
        run: ls -la dist/

=== README.md ===
# NovelCraft - 全网小说聚合爬虫与TXT一键下载器

> 一款基于 React 19 + TypeScript + Node.js + Cheerio 的现代化网络小说爬虫与全本 TXT 下载工具。
> 支持多源并发搜索、智能去广告排版、在线无干扰阅读与一键生成标准 TXT 小说文件。

---

## 🌟 核心功能特性

- 🔍 **全网小说多源聚合搜索**：支持同时检索主流小说书源与热门镜像站点。
- ⚡ **智能正文净化排版**：自动剔除防盗链防爬虫文字、弹窗广告代码、乱码，标准全角首行缩进（　　）。
- 📥 **全本/区间批量下载为 TXT**：
  - 支持一键导出全本或自定义章节范围（例如 1~100 章）。
  - 内置目录索引生成、章节分隔线美化。
  - 支持 UTF-8 与 GBK 编码导出（完美适配 Kindle / 掌阅 / 墨水屏阅读器）。
- 📖 **沉浸式护眼阅读器**：提供羊皮纸、牛皮纸、护眼绿、深色黑曜等多种阅读主题，支持字号行距实时微调与阅读进度记忆。
- 🤖 **Gemini AI 智能探针**：当部分冷门源遭遇反爬时，可由 AI 辅助进行正文修复与语义检索。
- 🚀 **开箱即用部署**：支持 GitHub 一键托管、Docker 极速容器化、Vercel/Node VPS 部署。

---

## 🛠️ 本地运行开发

```bash
# 1. 克隆代码仓库
git clone https://github.com/your-username/novelcraft.git
cd novelcraft

# 2. 安装依赖包
npm install

# 3. 复制环境变量
cp .env.example .env
# 可选填入 GEMINI_API_KEY

# 4. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

---

## 🐳 Docker 极速部署

```bash
# 构建并运行
docker compose up -d --build
# 访问 http://localhost:3000
```

---

## 📜 开源许可
MIT License
