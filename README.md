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
🚀 NovelCraft 部署到 Vercel 完整指南
本项目采用 Vite + React 19（前端静态构建）+ Express / Node.js（后端爬虫 API） 的全栈架构。在 Vercel 上部署时，前端会自动部署到全球边缘 CDN，后端爬虫接口会自动转换为 Vercel Serverless Functions 无服务器函数运行。
目录
确认必备配置文件
同步最新配置到 GitHub
在 Vercel 中导入并部署
配置环境变量（可选）
常见问题与排查 (FAQ)
1. 确认必备配置文件
为确保 Vercel 正确识别前后端路由，项目根目录下需要包含以下两个关键文件（项目中已为您预置完毕）：
① 根目录配置文件：vercel.json
JSON
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
② Serverless 函数入口：api/index.ts
TypeScript
import app from '../server.ts';

export default app;
2. 同步最新配置到 GitHub
如果刚才新添加了 vercel.json 和 api/index.ts，请在本地终端执行以下命令推送到 GitHub：
Bash
# 1. 检查修改状态
git status

# 2. 暂存所有新增配置
git add vercel.json api/index.ts server.ts

# 3. 提交变更
git commit -m "chore: add vercel serverless configuration"

# 4. 推送到 GitHub 远程仓库
git push origin main
3. 在 Vercel 中导入并部署
登录 Vercel：打开 https://vercel.com，使用您的 GitHub 账号直接登录。
新建项目：
登录后点击右上角 Add New... -> 选择 Project。
或直接访问导入页面：https://vercel.com/new。
导入 GitHub 仓库：
在 Import Git Repository 列表中，找到您的 novelcraft 仓库。
点击该仓库右侧的 Import 按钮。
配置项目参数（Configure Project）：
Project Name：可保持默认或自定义（例如 novelcraft-app）。
Framework Preset：选择 Vite（Vercel 通常会自动识别）。
Root Directory：保持默认 ./（根目录）。
Build and Output Settings：
Build Command：npm run build
Output Directory：dist
Install Command：npm install
(通常保持默认开启状态即可)
4. 配置环境变量（可选）
在点击 Deploy 前，展开下方 Environment Variables 选项：
变量名 (Key)	示例值 (Value)	说明
GEMINI_API_KEY	AIzaSy...	(可选) 填入您的 Google Gemini API 密钥。如果配置，可在源站遇反爬拦截时启用 AI 智能正文修补与检索；不填也不影响常规书源爬取。
NODE_ENV	production	(可选) 生产环境标识。
设置完成后，点击最下方的 Deploy 按钮。
5. 验证与访问
构建部署过程：
Vercel 会自动拉取代码、执行 npm install 与 npm run build。
整个过程大约耗时 30 ~ 60 秒。
部署成功：
页面会弹出 Congratulations! 礼花效果，并提供分配好的免费 HTTPS 域名（例如：https://novelcraft-xxx.vercel.app）。
功能验证：
打开分配的网址，测试在搜索框输入《诡秘之主》或《三体》进行检索。
点击小说卡片，进入章节目录。
点击 一键导出全本 TXT，检查是否能够正常并发下载并自动保存 .txt 文件。
5. 常见问题与排查 (FAQ)
Q1：为什么点击搜索或下载提示 504 Gateway Timeout？
原因：Vercel 免费用户（Hobby 计划）的 Serverless Function 单次请求超时时间上限为 10 秒（Pro 用户为 60 秒）。
优化建议：NovelCraft 已针对此特性做了解耦优化——TXT 批量下载采用前端分批并发请求章节，单章爬取通常在 200800ms 内完成，不会触发超时。全本下载时建议选择每次 50100 章批量导出。
Q2：如何绑定我自己的个性化独立域名？
进入 Vercel 该项目的控制台（Dashboard）。
点击 Settings -> Domains。
输入您的域名（如 novel.yourdomain.com），根据提示在您的域名 DNS 控制台添加一条 CNAME 解析记录指向 cname.vercel-dns.com 即可，Vercel 会自动签发 SSL 证书。
Q3：后续代码更新如何自动生效？
Vercel 与 GitHub 深度集成。您之后只需在本地修改代码并 git push 到 main 分支，Vercel 就会通过 Webhook 自动触发重新构建并无缝更新上线。
