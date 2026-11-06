/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Novel, Chapter, TxtFormatOptions } from './types';
import { Navbar } from './components/Navbar';
import { SearchHeader } from './components/SearchHeader';
import { NovelCard } from './components/NovelCard';
import { NovelDetailModal } from './components/NovelDetailModal';
import { DownloaderModal } from './components/DownloaderModal';
import { NovelReader } from './components/NovelReader';
import { Bookshelf } from './components/Bookshelf';
import { CustomUrlCrawler } from './components/CustomUrlCrawler';
import { GithubDeployModal } from './components/GithubDeployModal';
import { Loader2, BookOpen, Sparkles, AlertCircle, Compass } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'urlCrawler' | 'bookshelf' | 'deploy'>('search');
  const [books, setBooks] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSource, setActiveSource] = useState('aggregate');
  const [useAi, setUseAi] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  // Modals & Interactive Views
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [readerState, setReaderState] = useState<{ novel: Novel; chapterIndex: number } | null>(null);
  const [downloadBatch, setDownloadBatch] = useState<{
    novel: Novel;
    chapters: Chapter[];
    formatOptions: TxtFormatOptions;
  } | null>(null);

  // Bookshelf state persisted in localStorage
  const [bookshelf, setBookshelf] = useState<Novel[]>(() => {
    try {
      const saved = localStorage.getItem('novelcraft_bookshelf');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Dark mode
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('novelcraft_theme') === 'dark' ||
        (!('novelcraft_theme' in localStorage) &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('novelcraft_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('novelcraft_theme', 'light');
    }
  }, [isDark]);

  // Initial load: fetch sources and pre-seeded trending novels
  useEffect(() => {
    fetch('/api/sources')
      .then((res) => res.json())
      .then((data) => {
        setHasGeminiKey(Boolean(data.geminiEnabled));
        if (data.geminiEnabled) setUseAi(true);
      })
      .catch(() => {});

    // Initial search for trending books
    fetchBooks('');
  }, []);

  const fetchBooks = async (query: string, source = activeSource, aiProbe = useAi) => {
    setLoading(true);
    setSearchQuery(query);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('source', source);
      if (aiProbe) params.set('ai', 'true');

      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error('搜索抓取失败');
      const data = await res.json();
      setBooks(data.books || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBookshelf = (novel: Novel) => {
    setBookshelf((prev) => {
      const exists = prev.some((b) => b.id === novel.id || (b.title === novel.title && b.author === novel.author));
      let updated: Novel[];
      if (exists) {
        updated = prev.filter((b) => b.id !== novel.id && !(b.title === novel.title && b.author === novel.author));
      } else {
        updated = [
          {
            ...novel,
            addedAt: Date.now(),
            lastReadChapterIndex: novel.lastReadChapterIndex || 1,
            lastReadChapterTitle: novel.lastReadChapterTitle || '第一章',
          },
          ...prev,
        ];
      }
      try {
        localStorage.setItem('novelcraft_bookshelf', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleSaveProgress = (novel: Novel, chapterIndex: number, chapterTitle: string) => {
    setBookshelf((prev) => {
      const index = prev.findIndex((b) => b.id === novel.id || (b.title === novel.title && b.author === novel.author));
      let updated: Novel[];
      if (index >= 0) {
        updated = [...prev];
        updated[index] = {
          ...updated[index],
          lastReadChapterIndex: chapterIndex,
          lastReadChapterTitle: chapterTitle,
        };
      } else {
        // Auto add to shelf on reading
        updated = [
          {
            ...novel,
            addedAt: Date.now(),
            lastReadChapterIndex: chapterIndex,
            lastReadChapterTitle: chapterTitle,
          },
          ...prev,
        ];
      }
      try {
        localStorage.setItem('novelcraft_bookshelf', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const isBookmarked = (novel: Novel) =>
    bookshelf.some((b) => b.id === novel.id || (b.title === novel.title && b.author === novel.author));

  // If in active Reader mode
  if (readerState) {
    return (
      <NovelReader
        novel={readerState.novel}
        initialChapterIndex={readerState.chapterIndex}
        onBack={() => setReaderState(null)}
        onSaveProgress={handleSaveProgress}
        onTriggerDownload={(novel) => {
          setSelectedNovel(novel);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-sans transition-colors">
      {/* Universal Top Bar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        bookshelfCount={bookshelf.length}
      />

      {/* Main Tab Views */}
      <main className="flex-1 pb-16">
        {/* Tab 1: Novel Search & Discovery */}
        {activeTab === 'search' && (
          <div>
            <SearchHeader
              onSearch={(q, s, ai) => fetchBooks(q, s, ai)}
              isLoading={loading}
              activeSource={activeSource}
              onSourceChange={(s) => {
                setActiveSource(s);
                fetchBooks(searchQuery, s, useAi);
              }}
              useAi={useAi}
              onToggleAi={(val) => {
                setUseAi(val);
                if (searchQuery) fetchBooks(searchQuery, activeSource, val);
              }}
              hasGeminiKey={hasGeminiKey}
            />

            {/* Results Grid Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-600" />
                  <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                    {searchQuery ? `检索结果: “${searchQuery}”` : '全网热门推荐与经典佳作'}
                  </h2>
                </div>
                <span className="text-xs text-stone-500 font-mono">
                  共计 {books.length} 部小说
                </span>
              </div>

              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center text-stone-500 text-sm">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-3" />
                  <p>正在全网多节点抓取解析小说目录...</p>
                </div>
              ) : books.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <p className="text-stone-500 text-sm">
                    未检索到相关小说，您可以尝试输入书名关键词或使用“单链爬取”直接输入源站网址。
                  </p>
                  <button
                    onClick={() => setActiveTab('urlCrawler')}
                    className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    切换至单链爬虫
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {books.map((novel) => (
                    <NovelCard
                      key={novel.id}
                      novel={novel}
                      onSelect={(n) => setSelectedNovel(n)}
                      onRead={(n) => setReaderState({ novel: n, chapterIndex: 1 })}
                      onToggleBookshelf={handleToggleBookshelf}
                      isBookmarked={isBookmarked(novel)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Custom URL Direct Crawler */}
        {activeTab === 'urlCrawler' && (
          <CustomUrlCrawler
            onParsedBook={(novel) => {
              setSelectedNovel(novel);
            }}
          />
        )}

        {/* Tab 3: Bookshelf */}
        {activeTab === 'bookshelf' && (
          <Bookshelf
            books={bookshelf}
            onSelect={(n) => setSelectedNovel(n)}
            onRead={(n, chIdx) => setReaderState({ novel: n, chapterIndex: chIdx })}
            onRemove={(id) => handleToggleBookshelf({ id } as any)}
            onExplore={() => setActiveTab('search')}
          />
        )}

        {/* Tab 4: GitHub Deployment Guide */}
        {activeTab === 'deploy' && <GithubDeployModal />}
      </main>

      {/* Novel Detail & Catalog Modal */}
      {selectedNovel && (
        <NovelDetailModal
          novel={selectedNovel}
          onClose={() => setSelectedNovel(null)}
          onReadChapter={(n, idx) => {
            setSelectedNovel(null);
            setReaderState({ novel: n, chapterIndex: idx });
          }}
          onStartDownload={(n, chapters, formatOptions) => {
            setSelectedNovel(null);
            setDownloadBatch({ novel: n, chapters, formatOptions });
          }}
          onToggleBookshelf={handleToggleBookshelf}
          isBookmarked={isBookmarked(selectedNovel)}
        />
      )}

      {/* Downloader Modal */}
      {downloadBatch && (
        <DownloaderModal
          novel={downloadBatch.novel}
          chaptersToDownload={downloadBatch.chapters}
          formatOptions={downloadBatch.formatOptions}
          onClose={() => setDownloadBatch(null)}
          onOpenReader={(novel, idx) => {
            setDownloadBatch(null);
            setReaderState({ novel, chapterIndex: idx });
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-stone-800/80 py-6 text-center text-xs text-stone-500 dark:text-stone-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-stone-800 dark:text-stone-200">NovelCraft</span>
            <span>·</span>
            <span>全网小说聚合检索与纯净 TXT 导出工具</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('deploy')}
              className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              GitHub 开源部署文档
            </button>
            <span aria-hidden="true">·</span>
            <span>仅供个人文学阅读与网络爬虫技术学习交流使用</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
