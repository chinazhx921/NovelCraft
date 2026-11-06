import React, { useState } from 'react';
import { Globe, ArrowRight, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Novel } from '../types';

interface CustomUrlCrawlerProps {
  onParsedBook: (novel: Novel) => void;
}

const SAMPLE_URLS = [
  { name: '笔趣阁测试书目', url: 'https://www.bqgka.com/book/1234/' },
  { name: '新笔趣阁仙侠源', url: 'https://www.xbiquge.la/15/15338/' },
  { name: '飘天文学镜像', url: 'https://www.ptwxz.com/html/10/10442/' },
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
          万能网络小说单链爬虫
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-xl mx-auto">
          无需配置复杂规则，直接粘贴任意小说站点的目录页（或第一章链接），爬虫引擎将全自动探测编码、提取目录并提供一键导出 TXT 功能。
        </p>
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
            小说目标网址 (URL)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="例如: https://www.bqgka.com/book/xxxx/ 或 https://www.xbiquge.la/..."
              className="flex-1 px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <button
              onClick={() => handleCrawl(urlInput)}
              disabled={loading || !urlInput.trim()}
              className="px-5 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white font-medium text-xs sm:text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>智能探测解析中...</span>
                </>
              ) : (
                <>
                  <span>立即爬取全书</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">爬取探测提示:</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Feature Highlights */}
        <div className="pt-4 border-t border-stone-100 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-stone-600 dark:text-stone-400">
          <div>
            <span className="font-semibold text-stone-900 dark:text-stone-200 block mb-1">
              • 智能编码自适应
            </span>
            内置 GBK、GB2312、UTF-8 字符集无损自动转码，告别网页乱码问题。
          </div>
          <div>
            <span className="font-semibold text-stone-900 dark:text-stone-200 block mb-1">
              • 强力去广告引擎
            </span>
            自动剥离弹窗 JS 代码、推荐引流、伪装防盗段落，还原纯净文学排版。
          </div>
          <div>
            <span className="font-semibold text-stone-900 dark:text-stone-200 block mb-1">
              • 断点续传与防流控
            </span>
            支持并发线程控制、智能延时缓冲与错误单章自动重试机制。
          </div>
        </div>
      </div>
    </div>
  );
};
