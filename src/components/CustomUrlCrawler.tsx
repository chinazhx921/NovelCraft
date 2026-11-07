import React, { useState } from 'react';
import { Globe, ArrowRight, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Novel } from '../types';

interface CustomUrlCrawlerProps {
  onParsedBook: (novel: Novel) => void;
}

const SAMPLE_URLS = [
  { name: '母上攻略全本（489章完整版）', url: 'https://www.baishuwu.com/info/188122/' },
  { name: '飘天文学斗破苍穹全本源', url: 'https://www.piaotia.com/html/0/706/index.html' },
  { name: '新笔趣阁在线文学源', url: 'https://www.xbiquge.la/15/15338/' },
];

export const CustomUrlCrawler: React.FC<CustomUrlCrawlerProps> = ({ onParsedBook }) => {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCrawl = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/book-detail?url=${encodeURIComponent(targetUrl.trim())}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status} 抓取异常`);
      }

      const data = await res.json();
      if (!data.book || !data.book.title) {
        throw new Error('未能从该网址提取到小说标题或章节列表');
      }

      const parsed: Novel = {
        id: 'crawled-' + Math.random().toString(36).substring(2, 9),
        title: data.book.title,
        author: data.book.author || '网络作者',
        category: '自定义网络抓取',
        status: '连载/完结',
        wordCount: `${data.book.totalChapters || 0} 章节`,
        cover: data.book.cover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
        intro: data.book.intro || '通过单链万能爬虫抓取解析的小说',
        sourceName: '万能单链爬虫',
        sourceUrl: targetUrl.trim(),
        chapters: data.book.chapters || [],
        totalChapters: data.book.totalChapters || 0,
      };

      onParsedBook(parsed);
    } catch (err: any) {
      setError(err.message || '抓取失败，请检查网址格式或目标网站反爬策略');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-stone-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
          <Globe className="w-6 h-6" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
          万能网络文章 / 小说单链转阅读模式
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-xl mx-auto leading-relaxed">
          直接粘贴任意小说站点的目录页或单章链接（支持 Yandex/谷歌/必应搜索到的任意小说网址）。系统将自动嗅探编码、多页拼接全文、剔除广告并转入纯净阅读或打包导出全本 TXT。
        </p>
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              小说/文章目标网址 (URL)
            </label>
            <a
              href="https://yandex.eu/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              <span>在 Yandex.eu 搜索小说链接 ↗</span>
            </a>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="例如: https://www.baishuwu.com/info/188122/ 或任意小说章节链接"
              className="flex-1 px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <button
              onClick={() => handleCrawl(urlInput)}
              disabled={loading || !urlInput.trim()}
              className="px-5 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white font-medium text-xs sm:text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>全网智能探测解析中...</span>
                </>
              ) : (
                <>
                  <span>立即解析转阅读</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Sample Links */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-stone-500">
          <span className="font-medium text-stone-700 dark:text-stone-300">快速测试示例:</span>
          {SAMPLE_URLS.map((sample) => (
            <button
              key={sample.name}
              type="button"
              onClick={() => {
                setUrlInput(sample.url);
                handleCrawl(sample.url);
              }}
              className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors"
            >
              {sample.name}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">抓取探测提示:</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Feature Highlights */}
        <div className="pt-4 border-t border-stone-100 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-stone-600 dark:text-stone-400">
          <div>
            <span className="font-semibold text-stone-900 dark:text-stone-200 block mb-1">
              • 智能多页无缝拼接
            </span>
            自动识别多子页章节（_1.html、下一页继续阅读等），100% 还原完整正文，绝不截断。
          </div>
          <div>
            <span className="font-semibold text-stone-900 dark:text-stone-200 block mb-1">
              • 目录自然数严格重排
            </span>
            自动抓取分页目录下拉菜单，按第1章至第N章顺序排列，剔除顶部预览干扰。
          </div>
          <div>
            <span className="font-semibold text-stone-900 dark:text-stone-200 block mb-1">
              • 全网 100% 真实原文保真
            </span>
            直接从目标网页提取文字，杜绝 AI 自主编造或补写，保证原版真实阅读体验。
          </div>
        </div>
      </div>
    </div>
  );
};
