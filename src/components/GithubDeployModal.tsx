import React, { useState, useEffect } from 'react';
import { Github, Copy, Check, Terminal, Container, Cloud, FileCode, ExternalLink, Download } from 'lucide-react';

export const GithubDeployModal: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deployInfo, setDeployInfo] = useState<{
    dockerfile: string;
    dockerCompose: string;
    githubAction: string;
    readme: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'quickstart' | 'docker' | 'actions' | 'vps'>('quickstart');

  useEffect(() => {
    fetch('/api/github-deploy-info')
      .then((res) => res.json())
      .then((data) => setDeployInfo(data))
      .catch((err) => console.error('Fetch deploy info err:', err));
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadDeployFiles = () => {
    if (!deployInfo) return;
    const content = `# NovelCraft GitHub 部署配置文件集合
# 包含 Dockerfile, docker-compose.yml, github-action.yml, README.md

=== Dockerfile ===
${deployInfo.dockerfile}

=== docker-compose.yml ===
${deployInfo.dockerCompose}

=== .github/workflows/deploy.yml ===
${deployInfo.githubAction}

=== README.md ===
${deployInfo.readme}
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'novelcraft_github_deploy_configs.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
          <Github className="w-6 h-6" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
          部署到 GitHub 与云端服务器
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-xl mx-auto">
          本项目已完全模块化设计，支持 100% 托管至 GitHub 开源仓库，并一键部署到 Docker、Vercel、Railway 或个人 Linux 服务器。
        </p>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={handleDownloadDeployFiles}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出全套 GitHub 部署配置文件</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('quickstart')}
          className={`pb-3 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'quickstart'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-stone-300'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>三步推送到 GitHub</span>
        </button>

        <button
          onClick={() => setActiveTab('docker')}
          className={`pb-3 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'docker'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-stone-300'
          }`}
        >
          <Container className="w-4 h-4" />
          <span>Docker 极速容器化</span>
        </button>

        <button
          onClick={() => setActiveTab('actions')}
          className={`pb-3 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'actions'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-stone-300'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>GitHub Actions 自动化 CI/CD</span>
        </button>

        <button
          onClick={() => setActiveTab('vps')}
          className={`pb-3 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'vps'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-stone-300'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Vercel / Railway / VPS</span>
        </button>
      </div>

      {/* Tab 1: Quickstart */}
      {activeTab === 'quickstart' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-mono">
                1
              </span>
              在 GitHub 上新建仓库 (Create Repository)
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              登录您的 GitHub 账号，访问{' '}
              <a
                href="https://github.com/new"
                target="_blank"
                rel="noreferrer"
                className="text-amber-600 underline font-mono inline-flex items-center gap-1"
              >
                github.com/new <ExternalLink className="w-3 h-3" />
              </a>
              ，创建一个名为 <code className="bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-400">novelcraft</code> 的新公开或私有仓库。
            </p>
          </div>

          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-mono">
                  2
                </span>
                推送本地代码到 GitHub
              </h3>
              <button
                onClick={() =>
                  handleCopy(
                    `git init\ngit add .\ngit commit -m "feat: NovelCraft novel crawler and txt downloader"\ngit branch -M main\ngit remote add origin https://github.com/YOUR_USERNAME/novelcraft.git\ngit push -u origin main`,
                    'git-push'
                  )
                }
                className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center gap-1"
              >
                {copiedKey === 'git-push' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>复制代码</span>
              </button>
            </div>
            <pre className="bg-stone-950 text-stone-200 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-stone-800">
              <code>{`# 1. 初始化 Git 仓库并添加全部文件
git init
git add .
git commit -m "feat: NovelCraft novel crawler and txt downloader"

# 2. 绑定远程仓库分支 (将 YOUR_USERNAME 替换为您的 GitHub 用户名)
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/novelcraft.git

# 3. 推送至 GitHub
git push -u origin main`}</code>
            </pre>
          </div>

          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-mono">
                3
              </span>
              本地或在线测试运行
            </h3>
            <pre className="bg-stone-950 text-stone-200 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-stone-800">
              <code>{`npm install
npm run dev
# 浏览器直接打开 http://localhost:3000 即可使用全网小说爬取与 TXT 下载`}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Tab 2: Docker */}
      {activeTab === 'docker' && deployInfo && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                1. 生产级多阶段构建 Dockerfile
              </h3>
              <button
                onClick={() => handleCopy(deployInfo.dockerfile, 'dockerfile')}
                className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center gap-1"
              >
                {copiedKey === 'dockerfile' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>复制 Dockerfile</span>
              </button>
            </div>
            <pre className="bg-stone-950 text-stone-200 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-stone-800">
              <code>{deployInfo.dockerfile}</code>
            </pre>
          </div>

          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                2. 一键编排 docker-compose.yml
              </h3>
              <button
                onClick={() => handleCopy(deployInfo.dockerCompose, 'compose')}
                className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center gap-1"
              >
                {copiedKey === 'compose' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>复制 docker-compose.yml</span>
              </button>
            </div>
            <pre className="bg-stone-950 text-stone-200 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-stone-800">
              <code>{deployInfo.dockerCompose}</code>
            </pre>
            <div className="text-xs text-stone-500">
              运行命令: <code className="font-mono bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded">docker compose up -d --build</code>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Actions */}
      {activeTab === 'actions' && deployInfo && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                .github/workflows/deploy.yml (持续集成与自动化构建)
              </h3>
              <button
                onClick={() => handleCopy(deployInfo.githubAction, 'action')}
                className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center gap-1"
              >
                {copiedKey === 'action' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>复制流水线配置</span>
              </button>
            </div>
            <pre className="bg-stone-950 text-stone-200 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-stone-800">
              <code>{deployInfo.githubAction}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Tab 4: Cloud & VPS */}
      {activeTab === 'vps' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-amber-600" />
                  Vercel 部署 (Serverless 全栈)
                </h3>
                <span className="text-[11px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded font-medium">
                  推荐 · 零运维
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                代码中已内置配置好 <code className="font-mono bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded text-amber-600">vercel.json</code> 与 <code className="font-mono bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded text-amber-600">/api/index.ts</code> Serverless 入口：
              </p>
              <ol className="text-xs text-stone-600 dark:text-stone-400 space-y-1.5 list-decimal list-inside">
                <li>访问 <a href="https://vercel.com/new" target="_blank" rel="noreferrer" className="text-amber-600 underline">vercel.com/new</a>，授权登录 GitHub。</li>
                <li>找到您的 NovelCraft 仓库，点击 <strong>Import</strong>。</li>
                <li><strong>Framework Preset</strong> 保持选择 <strong>Vite</strong>。</li>
                <li><strong>Build Command</strong> 确认为 <code className="font-mono bg-stone-100 dark:bg-stone-800 px-1 rounded">npm run build</code>。</li>
                <li><strong>Output Directory</strong> 确认为 <code className="font-mono bg-stone-100 dark:bg-stone-800 px-1 rounded">dist</code>。</li>
                <li>在 <strong>Environment Variables</strong> 填入 <code className="font-mono bg-stone-100 dark:bg-stone-800 px-1 rounded">GEMINI_API_KEY</code>（可选）。</li>
                <li>点击 <strong>Deploy</strong>，1 分钟内即可获得免费分配的全球 CDN HTTPS 域名！</li>
              </ol>
            </div>

            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-600" />
                Linux VPS 云主机 PM2 守护
              </h3>
              <pre className="bg-stone-950 text-stone-200 p-3 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed">
                <code>{`# 在服务器上执行:
git clone <your-repo>
cd novelcraft
npm install
npm run build
npm install -g pm2
pm2 start "npx tsx server.ts" --name novelcraft`}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
