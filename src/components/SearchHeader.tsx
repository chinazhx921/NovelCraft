import React, { useState } from 'react';
import { Search, Sparkles, SlidersHorizontal, Loader2, ArrowRight } from 'lucide-react';

interface SearchHeaderProps {
  onSearch: (query: string, source: string) => void;
  isLoading: boolean;
  activeSource: string;
  onSourceChange: (source: string) => void;
}

const HOT_KEYWORDS = [
  '母上攻略',
  '少妇白洁',
  '少年阿宾',
  '金鳞岂是池中物',
  '凡人修仙传',
  '斗破苍穹',
  '剑来',
  '雪中悍刀行',
  '遮天',
  '极品家丁',
  '诡秘之主',
];

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  onSearch,
  isLoading,
  activeSource,
  onSourceChange,
}) => {
  const [keyword, setKeyword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      onSearch(keyword.trim(), activeSource);
    }
  };

  const handleHotClick = (tag: string) => {
    setKeyword(tag);
    onSearch(tag, activeSource);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pt-8 pb-4">
      {/* Title & Editorial Description */}
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 dark:text-stone-50 tracking-tight mb-2">
          全网小说聚合检索与 TXT 下载
        </h1>
        <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed">
          并发采集网络各大书源目录与最新章节，正文全自动去广告、净化排版，点选任意作品一键打包导出纯文本 TXT。
        </p>
      </div>

      {/* Main Search Bar Form */}
      <form onSubmit={handleSubmit} className="relative mb-3">
        <div className="relative flex items-center shadow-sm rounded-xl overflow-hidden border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:border-amber-500 transition-all">
          <div className="pl-4 text-stone-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入小说名，或直接粘贴任意网页/小说网址（支持 Yandex/必应搜索到的链接）..."
            className="w-full py-3.5 pl-3 pr-28 text-stone-900 dark:text-stone-100 bg-transparent placeholder-stone-400 text-sm sm:text-base focus:outline-none"
          />

          <div className="absolute right-1.5 flex items-center gap-1.5">
            <button
              type="submit"
              disabled={isLoading || !keyword.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>抓取中...</span>
                </>
              ) : (
                <>
                  <span>{/^(https?:\/\/|[a-z0-9.-]+\.[a-z]{2,}\/)/i.test(keyword.trim()) ? '直接转阅读' : '搜索抓取'}</span>
                  <ArrowRight className="w-4 h-4 hidden sm:inline" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm pt-1">
        {/* Source Segmented Control */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-lg">
          <button
            type="button"
            onClick={() => onSourceChange('aggregate')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSource === 'aggregate'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            聚合全网源
          </button>
          <button
            type="button"
            onClick={() => onSourceChange('ethic')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSource === 'ethic'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            伦理/百书屋
          </button>
          <button
            type="button"
            onClick={() => onSourceChange('bqg')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSource === 'bqg'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            笔趣阁节点
          </button>
          <button
            type="button"
            onClick={() => onSourceChange('ptwxz')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSource === 'ptwxz'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            飘天文学
          </button>
        </div>

        {/* Search Engine Assistance Helper for Banned/Niche Novels */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={keyword.trim() ? `https://yandex.eu/search/?text=${encodeURIComponent(keyword.trim() + ' 小说 章节列表 目录')}` : 'https://yandex.eu/'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium transition-colors"
            title="遇到冷门/敏感小说无法直接搜出时，可在 Yandex 搜索后复制网址粘贴到本站直接转阅读"
          >
            <span>在 Yandex.eu 搜索</span>
            <span className="text-[10px] opacity-70">↗</span>
          </a>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>网络搜寻原版 · 拒绝AI补写 · 100%原文保真</span>
          </div>
        </div>
      </div>

      {/* Trending Fast Keywords (Clean unboxed tags) */}
      <div className="flex items-center flex-wrap gap-2 pt-3 text-xs text-stone-500 dark:text-stone-400">
        <span className="font-medium text-stone-700 dark:text-stone-300">热门搜索:</span>
        {HOT_KEYWORDS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleHotClick(tag)}
            className="hover:text-amber-600 dark:hover:text-amber-400 underline-offset-4 hover:underline transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};
