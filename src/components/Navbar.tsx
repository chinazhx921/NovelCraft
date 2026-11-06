import React from 'react';
import { BookOpen, Github, Moon, Sun, BookmarkCheck, Globe, DownloadCloud } from 'lucide-react';

interface NavbarProps {
  activeTab: 'search' | 'urlCrawler' | 'bookshelf' | 'deploy';
  onSelectTab: (tab: 'search' | 'urlCrawler' | 'bookshelf' | 'deploy') => void;
  isDark: boolean;
  onToggleTheme: () => void;
  bookshelfCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  isDark,
  onToggleTheme,
  bookshelfCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => onSelectTab('search')}
          className="flex items-center gap-2.5 text-left text-lg font-bold tracking-tight text-stone-900 dark:text-stone-50 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-sm">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="font-serif">NovelCraft</span>
          <span className="text-xs font-normal text-stone-500 dark:text-stone-400 hidden sm:inline">全网小说爬虫与下载</span>
        </button>

        {/* Zone 2: Navigation Links (Single-line, concise) */}
        <nav className="flex items-center gap-1 sm:gap-4 text-sm font-medium text-stone-600 dark:text-stone-300">
          <button
            onClick={() => onSelectTab('search')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'search'
                ? 'text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-stone-800/80'
                : 'hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            全网检索
          </button>

          <button
            onClick={() => onSelectTab('urlCrawler')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'urlCrawler'
                ? 'text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-stone-800/80'
                : 'hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>单链爬取</span>
          </button>

          <button
            onClick={() => onSelectTab('bookshelf')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'bookshelf'
                ? 'text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-stone-800/80'
                : 'hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>我的书架</span>
            {bookshelfCount > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 bg-amber-600 text-white rounded-full font-mono">
                {bookshelfCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('deploy')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'deploy'
                ? 'text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-stone-800/80'
                : 'hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub部署</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action & Theme Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onToggleTheme}
            aria-label="切换浅色与深色模式"
            className="p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => onSelectTab('deploy')}
            className="hidden md:flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-stone-900 dark:bg-stone-100 dark:text-stone-900 rounded-lg hover:bg-stone-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0 shadow-sm"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>开源部署指南</span>
          </button>
        </div>
      </div>
    </header>
  );
};
