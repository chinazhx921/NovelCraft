# NovelCraft — 全网小说聚合与 TXT 阅读工具

NovelCraft 基于 React 19、TypeScript、Vite 和 Express，提供多书源搜索、目录抓取、在线阅读与 TXT 导出。

## 推荐部署方式：通过 GitHub 关联 Cloudflare Workers 自动部署（免费套餐可用）

**推荐直接在 Cloudflare 控制台关联本 GitHub 仓库。** 以后只要向 GitHub 的 `main` 分支推送代码，Cloudflare 就会自动构建并部署，不需要每次下载源码或手动上传文件。

**重要：请选择 Cloudflare Workers 的 GitHub 集成，不要创建纯静态 Cloudflare Pages 项目。** NovelCraft 除了 React 前端，还依赖 Express `/api/*` 后端；只发布 `dist/` 静态文件会导致搜索、目录和章节接口不可用。

### 一、在 Cloudflare 中关联 GitHub 仓库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 打开 **Workers & Pages**。
3. 点击 **Create application**。
4. 选择 **GitHub**（不要选择仅静态资源的 Pages 上传流程）。
5. 首次连接时，按提示授权 Cloudflare Workers & Pages GitHub App。
6. 在 GitHub 仓库列表中选择 **`chinazhx921/NovelCraft`**。
   - 如果列表中看不到仓库，进入 GitHub → Settings → Applications → Installed GitHub Apps → Cloudflare Workers & Pages → Configure。
   - 将 Repository access 设置为 **Only select repositories**，并勾选 `NovelCraft`；保存后返回 Cloudflare 刷新仓库列表。
7. 选择生产分支 **`main`**，继续配置项目。

### 二、构建与部署参数（请按此填写）

仓库已包含 `wrangler.jsonc`，Cloudflare 会使用该文件中的 Worker 入口和静态资源配置。创建项目时，设置如下：

| Cloudflare 配置项 | 填写内容 |
|---|---|
| Project / Worker name | `novelcraft` |
| Git repository | `chinazhx921/NovelCraft` |
| Production branch | `main` |
| Root directory | `/`（仓库根目录） |
| Build command | `npm run build` |
| Deploy command | `npx --yes wrangler@4.68.0 deploy` |
| Preview command（如可设置） | 保持 Cloudflare 默认值（`npx wrangler preview`） |

其他未列出的选项保持默认即可。**Worker 名称必须是 `novelcraft`**，要与仓库 `wrangler.jsonc` 中的 `name` 完全一致，否则构建部署可能失败。

如果控制台自动识别出框架并建议创建配置文件或修改 Wrangler 配置，请不要覆盖仓库现有的 `wrangler.jsonc`；以本仓库已经提交的 Worker 配置为准。

确认配置后点击 **Save and Deploy**，等待 Cloudflare 安装依赖、执行 `npm run build` 并运行 Wrangler 部署命令。

### 三、查看部署结果

构建成功后，在 Cloudflare **Workers & Pages → novelcraft → Deployments** 查看部署状态和访问地址。默认地址通常类似：

```text
https://novelcraft.<你的Cloudflare账户子域名>.workers.dev
```

打开该地址测试首页和 API。先访问：

```text
https://novelcraft.<你的Cloudflare账户子域名>.workers.dev/api/health
```

正常时应返回：

```json
{
  "ok": true,
  "service": "NovelCraft API"
}
```

再在网页中依次验证小说搜索、打开小说详情并加载目录、点击章节阅读、翻页及 TXT 导出。健康接口正常只说明 Worker API 已响应；第三方小说源能否抓取还取决于源站状态和反爬策略。

### 四、启用 GitHub 自动部署

完成首次部署后，Cloudflare 已关联 GitHub 仓库：

- 推送到 `main`：自动触发生产构建和部署。
- 其他分支或 Pull Request：可在 Worker 的 **Settings → Builds** 中启用 Preview builds；预览构建不会替换生产版本。
- 每次构建结果可在 Cloudflare Deployments 查看，也可查看 GitHub 对应提交或 PR 的检查状态。

以后更新项目只需在 GitHub 修改并提交代码到 `main`，不需要再手动上传 `dist`，也不需要本地执行 Wrangler 部署命令。

### 五、配置失败时先检查这些项目

1. **Worker 名称**：Cloudflare 项目名称必须为 `novelcraft`，与 `wrangler.jsonc` 一致。
2. **分支**：生产分支选择 `main`。
3. **Root directory**：必须是仓库根目录 `/`，不能指向 `src` 或 `dist`。
4. **Build command**：填写 `npm run build`。
5. **Deploy command**：填写 `npx --yes wrangler@4.68.0 deploy`。
6. **项目类型**：必须是 Workers 项目，不能只把 `dist` 当作静态 Pages 站点发布。
7. **运行日志**：在 Cloudflare Worker 的 Deployments / Builds 中打开失败构建日志，确认是依赖安装、Vite 构建还是 Wrangler 部署阶段报错。

### 六、命令行备用部署方式

如果暂时不使用 GitHub 自动部署，也可以在本地执行：

```bash
git clone https://github.com/chinazhx921/NovelCraft.git
cd NovelCraft
npm install
npx --yes wrangler@4.68.0 login
npm run cf:dev
```

本地预览正常后执行：

```bash
npm run deploy
```

该方式需要本地安装 Node.js 20.19+ 或 22.12+。如果已关联 GitHub 自动部署，日常更新无需使用此方式。

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
