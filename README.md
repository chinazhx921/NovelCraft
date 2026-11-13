# NovelCraft — 全网小说聚合与 TXT 阅读工具

NovelCraft 基于 React 19、TypeScript、Vite 和 Express，提供多书源搜索、目录抓取、在线阅读与 TXT 导出。

## 推荐部署方式：Cloudflare Workers（免费套餐可用）

**本项目不是纯静态网站。** 前端由 Vite 构建为 `dist/` 静态文件，搜索、目录和章节正文等功能依赖 Express `/api/*` 后端接口。只把 `dist` 上传到 Cloudflare Pages 会导致页面能打开，但搜索、目录抓取等接口不可用。

当前仓库已提供 Cloudflare Workers 入口和 Wrangler 配置：前端静态资源由 Workers Static Assets 托管，Express API 在同一个 Worker 中运行。前后端共用一个域名，无需配置 API 跨域地址。

### 一、部署前准备

1. 一个 Cloudflare 账号，并在账户中启用 Workers。
2. 一个 GitHub 账号，仓库为 [chinazhx921/NovelCraft](https://github.com/chinazhx921/NovelCraft)。
3. 本地命令行部署需要安装 Node.js 20 或更高版本（建议使用当前 LTS）和 npm。
4. （可选）Google Gemini API Key。未配置时，常规搜索、目录抓取和阅读仍可使用，Gemini 智能辅助功能不可用。

### 二、方式 A：命令行部署（推荐，步骤最明确）

在 Windows PowerShell、macOS Terminal 或 Linux Shell 中执行：

```bash
# 1. 克隆仓库
git clone https://github.com/chinazhx921/NovelCraft.git
cd NovelCraft

# 2. 安装依赖
npm install

# 3. 登录 Cloudflare（浏览器会弹出授权页面）
npx wrangler login

# 4. 本地预览 Cloudflare Workers 运行环境
npm run cf:dev
```

本地预览启动后，按终端显示的地址打开页面。建议先测试首页、搜索、打开小说目录和阅读章节。

确认正常后部署：

```bash
npm run deploy
```

该命令会先执行 `vite build` 生成前端 `dist/`，再由 Wrangler 将 Worker 与静态资源一起部署。部署成功后，终端会输出类似以下地址：

```text
https://novelcraft.<你的Cloudflare账户子域名>.workers.dev
```

直接打开该地址即可使用。

### 三、方式 B：Cloudflare 控制台连接 GitHub 自动部署

如果不想每次手动执行命令，可以在 Cloudflare 控制台配置 GitHub 自动部署：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Workers & Pages**，选择创建 Worker / 导入 Git 仓库（界面名称可能随控制台版本调整）。
3. 选择 GitHub，并授权访问 `chinazhx921/NovelCraft`。
4. 选择默认分支 `main`。
5. 构建配置填写：
   - Root directory：`/`（仓库根目录）
   - Build command：`npm run build`
   - Deploy command：`npx wrangler deploy`
   - Build output directory：留空（由仓库根目录的 `wrangler.jsonc` 和 Wrangler 管理 Worker 及静态资源，不要将项目配置成纯 Pages 静态站点）
6. 保存并启动部署。后续推送到 `main` 后，Cloudflare 会按连接配置自动构建和部署。

> 如果控制台只提供 Pages 静态站点创建流程，请不要选择仅上传 `dist` 的纯静态部署方式；本项目需要运行 Worker API。请改用 Workers 的 Git 集成或上面的 Wrangler 命令行方式。

### 四、配置 Gemini（可选）

如果需要启用 Gemini 智能辅助，不要把 API Key 写进源码、`wrangler.jsonc` 或前端环境变量。

命令行设置 Secret：

```bash
npx wrangler secret put GEMINI_API_KEY
```

按提示粘贴 Gemini API Key。设置后重新部署：

```bash
npm run deploy
```

本地使用时，可在项目根目录创建 `.dev.vars` 文件：

```dotenv
GEMINI_API_KEY=替换为你自己的密钥
```

`.dev.vars` 已加入 Git 忽略规则，请勿提交密钥文件。

### 五、部署完成后的检查

将下方域名替换为 Wrangler 输出的实际 Worker 域名：

```bash
# 1. 检查后端健康接口，应返回 JSON
curl https://你的-worker域名.workers.dev/api/health

# 2. 浏览器打开首页，检查静态资源是否正常加载
https://你的-worker域名.workers.dev/

# 3. 在页面中实际验证
# - 搜索小说
# - 打开搜索结果并加载章节目录
# - 点击章节进入阅读器
# - 翻页、刷新页面后检查阅读进度
# - 尝试导出 TXT
```

健康接口返回 `{"ok":true,"service":"NovelCraft API"}` 表示 API Worker 已响应。它不代表外部小说源一定可访问；具体搜索和抓取结果还受源站可用性、反爬策略及网络状况影响。

### 六、绑定自己的域名（可选）

1. 在 Cloudflare 控制台打开该 Worker。
2. 进入 **Settings / Domains & Routes**（菜单名称可能随版本变化）。
3. 添加 Custom Domain，填写已经接入 Cloudflare DNS 的域名，例如 `novel.example.com`。
4. 等待 Cloudflare 配置 DNS 和 HTTPS 证书后，用新域名访问。

### 七、更新和重新部署

命令行更新：

```bash
git pull origin main
npm install
npm run deploy
```

如果已启用 Cloudflare Git 自动部署，推送到 `main` 即可触发新部署。

## 本地开发（Node.js）

```bash
npm install
npm run dev
```

默认访问地址为 `http://localhost:3000`。本地开发由 Vite 提供前端热更新，Express 提供 `/api/*` 接口。

生产模式本地运行：

```bash
npm run build
NODE_ENV=production npm start
```

Windows PowerShell 可使用：

```powershell
npm run build
$env:NODE_ENV="production"
npm start
```

## Docker 部署

如果希望在自有 Linux VPS 或 NAS 上运行 Node.js 版本，可使用仓库提供的 Docker 配置（如仓库中包含 Dockerfile 和 compose 文件）：

```bash
docker compose up -d --build
```

## 常见问题排查

### 1. 首页能打开，但搜索按钮无结果 / 接口报错

- 确认部署目标是 **Cloudflare Workers**，不是只部署静态资源的 Pages 项目。
- 确认部署使用仓库根目录的 `wrangler.jsonc`。
- 检查 `/api/health` 是否返回 JSON。
- 在 Cloudflare Worker 的 Logs 中查看运行错误，并确认最新部署版本已生效。

### 2. 页面显示空白、样式丢失或 JS/CSS 404

- 确认构建命令为 `npm run build`。
- 确认 `dist/` 目录由 Vite 正常生成。
- 确认 Wrangler 部署时使用了仓库中的 Worker 配置，不要把输出目录误设为 `public` 或仓库根目录。
- 清除浏览器缓存后重新打开。

### 3. `/api/*` 返回 404

- 确认 Worker 的 `assets.run_worker_first` 配置包含 `/api/*`。
- 确认 Worker 入口为 `worker/index.ts`。
- 重新运行 `npm run deploy`。

### 4. 搜索或章节抓取失败

Cloudflare Worker 已成功响应，不代表目标小说站点一定允许抓取。源站可能出现域名失效、反爬、验证码、地区限制或超时。可更换书源或稍后重试；查看 Worker Logs 区分 Worker 运行异常和源站返回错误。

### 5. Gemini 功能不可用

确认已通过 `wrangler secret put GEMINI_API_KEY` 配置密钥，并在更新 Secret 后重新部署。没有密钥时，普通搜索、目录和阅读功能不依赖 Gemini。

### 6. Cloudflare 免费套餐说明

Workers、静态资源和 API 请求受 Cloudflare 当前免费套餐配额及运行时限制约束。高频并发抓取、大量章节连续下载或长时间外部请求可能触及资源限制；请按个人使用规模测试，避免将免费套餐理解为无限流量或无限计算。

## 技术与运行结构

- 前端：React 19 + TypeScript + Vite，构建产物位于 `dist/`。
- 后端：Express，提供小说搜索、目录抓取、章节正文等 `/api/*` 接口。
- Cloudflare：Workers 承载 Express API，Workers Static Assets 托管 Vite 构建产物。
- 运行时：Cloudflare Workers Node.js compatibility；Wrangler 配置启用 Node.js 兼容。
- Gemini：可选 Secret `GEMINI_API_KEY`。

## 参考文档

- [Cloudflare：Deploy an Express.js application on Workers](https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/)
- [Cloudflare：React + Vite on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare：Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare：Environment variables and secrets](https://developers.cloudflare.com/workers/configuration/environment-variables/)

## 免责声明

本项目用于个人阅读及技术学习。请遵守目标网站服务条款、相关法律法规和著作权规定，尊重作者及正版内容平台权益。

## 开源许可证

MIT License
