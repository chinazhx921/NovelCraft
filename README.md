# NovelCraft - 全网小说聚合爬虫与 TXT 一键下载器

<p align="center">
  <strong>一款基于 React 19 + TypeScript + Vite + Express 的现代化全网网络小说聚合爬虫、沉浸式护眼阅读与 TXT 批量下载导出工具。</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-blue.svg" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-black.svg?logo=vercel" alt="Vercel" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

---

## 🌟 核心功能特性

- 🔍 **全网小说多源聚合搜索**：支持笔趣阁集群镜像、飘天文学及主流小说源并发实时检索，无惧单一书源失效。
- 📥 **点选一键批量下载为 TXT**：
  - 支持全本所有章节导出，或自定义章节区间（如 1~100 章）。
  - 自动生成规范的书名、作者、作品简介前言与目录索引。
  - 标准中文排版规范：段落全角首行空两格（`　　`），自动剔除防爬防盗乱码及广告。
  - 导出格式完美适配 Kindle、掌阅、微信读书、墨水屏阅读器及手机端阅读软件。
- 🌐 **万能单链爬取引擎**：直接粘贴任意网络小说的目录页或章节 URL，引擎全自动自适应 GBK / GB2312 / UTF-8 编码并提取目录。
- 📖 **沉浸式护眼在线阅读**：
  - 6 种护眼阅读主题：柔白、羊皮纸、复古牛皮纸、青竹绿、暗夜、纯黑 OLED。
  - 支持自定义字号、宋体/黑体切换、阅读进度持久化记忆。
- 🤖 **Gemini 智能辅助**：源站反爬或出现缺章时，可启用 AI 语义重构与智能正文修补。
- 🚀 **零门槛云端一键部署**：完美适配 Vercel Serverless 全栈无服务器部署、Docker 容器化及 Linux VPS。

---

## 🚀 Vercel 完整部署指南（推荐 · 零运维免费上线）

本项目前端为 Vite 静态构建，后端接口适配为 Vercel Serverless Functions。按照以下步骤，5 分钟即可将本程序免费部署到全球高速 CDN。

### 第一步：确保本地包含 Vercel 配置文件

确认项目根目录中存在以下两个文件（仓库已预置）：

#### 1. 根目录 `vercel.json`
```json
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
```

#### 2. `api/index.ts` 文件
```typescript
import app from '../server.ts';

export default app;
```

---

### 第二步：将最新代码推送到 GitHub

在本地项目根目录打开终端，执行以下命令同步到 GitHub：

```bash
# 1. 暂存所有新增及修改文件
git add .

# 2. 提交更新
git commit -m "feat: configure vercel serverless deployment"

# 3. 推送到 GitHub 仓库主分支
git push origin main
```
*(如果您的默认主分支为 `master`，请将最后一行命令替换为 `git push origin master`)*

---

### 第三步：在 Vercel 控制台导入项目

1. **登录 Vercel**：
   - 打开 [https://vercel.com](https://vercel.com)
   - 点击右上角 **Log In**，选择 **Continue with GitHub** 授权登录。

2. **新建项目**：
   - 进入控制台后，点击右上角 **Add New...** -> 选择 **Project**。
   - 或直接打开导入链接：[https://vercel.com/new](https://vercel.com/new)。

3. **导入 GitHub 仓库**：
   - 在 **Import Git Repository** 列表中找到您的 NovelCraft 仓库。
   - 点击该仓库右侧的 **Import** 按钮。

4. **确认构建与输出设置（Configure Project）**：
   - **Framework Preset**：确保选择 **Vite**（Vercel 会自动检测识别）。
   - **Root Directory**：保持默认 `./`。
   - **Build Command**：`npm run build`
   - **Output Directory**：`dist`
   - **Install Command**：`npm install`

5. **配置环境变量（可选）**：
   - 展开页面下方的 **Environment Variables** 栏目：
     - **Key**：`GEMINI_API_KEY`
     - **Value**：填入您的 Google Gemini API 密钥 *(选填，填入可启用智能章节修复功能；不填不影响常规小说爬取)*
   - 点击 **Add** 添加。

6. **点击部署**：
   - 点击页面最下方的 **Deploy** 按钮。
   - 等待约 30 ~ 60 秒，页面显示 **Congratulations!** 即代表部署完成！
   - 点击分配好的系统域名（如 `https://your-repo-name.vercel.app`）即可在公网随时使用。

---

### 第四步：后续自动持续集成（CI/CD）

- 部署完成后，只要您在本地修改代码并 `git push` 到 GitHub，Vercel 会自动侦测变动并无缝完成热更新重新发布，无需手动重新上传。

---

## 🐳 Docker 极速本地或 VPS 部署

如果您有自己的 Linux 服务器或群晖 NAS，也支持 Docker 容器化运行：

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/novelcraft.git
cd novelcraft

# 2. 一键启动容器
docker compose up -d --build

# 3. 访问服务
# 浏览器打开 http://localhost:3000 即可使用
```

---

## 🛠️ 本地开发运行

```bash
# 1. 安装依赖包
npm install

# 2. 复制环境配置（可选）
cp .env.example .env

# 3. 启动开发服务器
npm run dev

# 浏览器访问 http://localhost:3000
```

---

## 📖 常见问题与说明 (FAQ)

### 1. 批量下载超长篇小说时提示超时怎么办？
- Vercel 免费版对 Serverless Function 单次请求有 10 秒限制。
- NovelCraft 的批量下载在客户端实现了流式并发控制，单章爬取耗时通常仅为 200~800ms，不会导致函数超时。
- 如需一次性下载数千章的完本超长篇小说，建议在下载弹窗中使用**“自定义区间”**功能，分卷（如每次下载 100~200 章）导出，速度最快且最稳定。

### 2. 如何绑定我自己的个性化独立域名？
1. 在 Vercel 项目主页点击顶部 **Settings** -> 左侧 **Domains**。
2. 输入您购买的域名（例如 `novel.yourdomain.com`），点击 **Add**。
3. 在您的域名 DNS 解析服务商处，添加一条 `CNAME` 解析记录指向 `cname.vercel-dns.com` 即可，Vercel 会全自动申请并配置免费 SSL 证书。

---

## 📜 开源免责声明 (Disclaimer)

- 本项目仅供前端技术研究、网络爬虫技术交流与个人文学阅读使用。
- 程序中爬取检索的所有小说版权均归原作者及正版版权所有方所有，请支持正版文学作品。

---

## 📄 开源许可证
本项目基于 [MIT License](LICENSE) 开源发布。
