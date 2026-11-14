import React, { useState, useEffect } from 'react';
import { Novel, Chapter, ReaderSettings } from '../types';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  Settings,
  Download,
  Loader2,
  Bookmark,
  BookmarkCheck,
  Type,
  Sun,
  Moon,
} from 'lucide-react';

interface NovelReaderProps {
  novel: Novel;
  initialChapterIndex: number;
  onBack: () => void;
  onSaveProgress: (novel: Novel, chapterIndex: number, chapterTitle: string) => void;
  onTriggerDownload: (novel: Novel) => void;
}

export const NovelReader: React.FC<NovelReaderProps> = ({
  novel,
  initialChapterIndex,
  onBack,
  onSaveProgress,
  onTriggerDownload,
}) => {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(initialChapterIndex);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [subpageCount, setSubpageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  const [settings, setSettings] = useState<ReaderSettings>(() => {
    try {
      const saved = localStorage.getItem('novelcraft_reader_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      theme: 'sepia',
      fontSize: 18,
      lineHeight: 1.8,
      fontFamily: 'serif',
      maxWidth: 'normal',
    };
  });

  const saveSettings = (newSettings: ReaderSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('novelcraft_reader_settings', JSON.stringify(newSettings));
    } catch {}
  };

  const chapters = novel.chapters || [];
  const currentChapter = chapters.find((c) => c.index === currentChapterIndex) || {
    index: currentChapterIndex,
    title: `第${currentChapterIndex}章`,
    url: '',
  };

  // Fetch chapter content when index changes
  useEffect(() => {
    let active = true;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      try {
        let res;
        if (currentChapter.url) {
          res = await fetch(
            `/api/chapter-content?url=${encodeURIComponent(currentChapter.url)}&chapterTitle=${encodeURIComponent(currentChapter.title)}`
          );
        } else {
          res = await fetch(
            `/api/chapter-content?bookId=${encodeURIComponent(novel.id)}&chapterIndex=${currentChapterIndex}&chapterTitle=${encodeURIComponent(currentChapter.title)}`
          );
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || '章节正文加载失败，源站可能超时或需要刷新');
        }

        const data = await res.json();
        if (active) {
          setChapterTitle(data.title || currentChapter.title);
          setChapterContent(data.content || '正文暂无内容');
          setSubpageCount(data.subpageCount || 1);

          // Save reading progress
          onSaveProgress(novel, currentChapterIndex, data.title || currentChapter.title);

          // Scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || '正文加载失败');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchContent();

    return () => {
      active = false;
    };
  }, [currentChapterIndex, novel, retryTick]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentChapterIndex > 1) {
        setCurrentChapterIndex((prev) => prev - 1);
      } else if (e.key === 'ArrowRight' && currentChapterIndex < chapters.length) {
        setCurrentChapterIndex((prev) => prev + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentChapterIndex, chapters.length]);

  const themeClass = `theme-${settings.theme}`;
  const fontClass =
    settings.fontFamily === 'serif'
      ? 'font-serif'
      : settings.fontFamily === 'kaiti'
      ? 'font-serif tracking-wide'
      : 'font-sans';

  const maxWidthClass =
    settings.maxWidth === 'compact'
      ? 'max-w-2xl'
      : settings.maxWidth === 'wide'
      ? 'max-w-4xl'
      : 'max-w-3xl';

  return (
    <div className={`min-h-screen transition-colors duration-200 ${themeClass}`}>
      {/* Top Floating Control Bar */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-inherit/90 border-b border-black/5 dark:border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回书库</span>
          </button>

          <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10" />

          <div className="text-xs truncate max-w-[200px] sm:max-w-xs">
            <span className="font-bold">{novel.title}</span>
            <span className="opacity-60 ml-1.5 hidden sm:inline">
              ({currentChapterIndex}/{chapters.length || 1})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Catalog Drawer Button */}
          <button
            onClick={() => setShowCatalog(!showCatalog)}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="查看目录"
          >
            <List className="w-4 h-4" />
          </button>

          {/* Reader Appearance Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="阅读排版偏好"
          >
            <Type className="w-4 h-4" />
          </button>

          {/* Download Book TXT Button */}
          <button
            onClick={() => onTriggerDownload(novel)}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-amber-700 dark:text-amber-400"
            title="下载全本/区间 TXT"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Reader Settings Drawer */}
      {showSettings && (
        <div className="border-b border-black/10 dark:border-white/10 px-4 py-4 bg-inherit shadow-inner animate-in slide-in-from-top-2">
          <div className="max-w-2xl mx-auto space-y-4 text-xs">
            {/* Themes */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium opacity-70">护眼背景:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'default', label: '柔白', bg: '#fafaf9', text: '#1c1917' },
                  { id: 'sepia', label: '羊皮纸', bg: '#f6eedb', text: '#382c1e' },
                  { id: 'parchment', label: '牛皮纸', bg: '#efe8dc', text: '#2b251f' },
                  { id: 'green', label: '青竹绿', bg: '#e9f1e8', text: '#1e2c1e' },
                  { id: 'dark', label: '暗夜', bg: '#171717', text: '#d4d4d4' },
                  { id: 'oled', label: '纯黑', bg: '#000000', text: '#a3a3a3' },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => saveSettings({ ...settings, theme: th.id as any })}
                    style={{ backgroundColor: th.bg, color: th.text }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      settings.theme === th.id
                        ? 'ring-2 ring-amber-500 shadow-sm border-transparent'
                        : 'border-black/10 dark:border-white/20'
                    }`}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size & Line Height */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-medium opacity-70">字号:</span>
                <button
                  onClick={() => saveSettings({ ...settings, fontSize: Math.max(14, settings.fontSize - 2) })}
                  className="px-2.5 py-1 rounded bg-black/5 dark:bg-white/10 font-mono"
                >
                  A-
                </button>
                <span className="font-mono tabular-nums px-1">{settings.fontSize}px</span>
                <button
                  onClick={() => saveSettings({ ...settings, fontSize: Math.min(28, settings.fontSize + 2) })}
                  className="px-2.5 py-1 rounded bg-black/5 dark:bg-white/10 font-mono"
                >
                  A+
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-medium opacity-70">字体:</span>
                <button
                  onClick={() => saveSettings({ ...settings, fontFamily: 'serif' })}
                  className={`px-2.5 py-1 rounded ${settings.fontFamily === 'serif' ? 'bg-amber-600 text-white' : 'bg-black/5 dark:bg-white/10'}`}
                >
                  宋体
                </button>
                <button
                  onClick={() => saveSettings({ ...settings, fontFamily: 'sans' })}
                  className={`px-2.5 py-1 rounded ${settings.fontFamily === 'sans' ? 'bg-amber-600 text-white' : 'bg-black/5 dark:bg-white/10'}`}
                >
                  黑体
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-medium opacity-70">版心:</span>
                <button
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      maxWidth:
                        settings.maxWidth === 'compact'
                          ? 'normal'
                          : settings.maxWidth === 'normal'
                          ? 'wide'
                          : 'compact',
                    })
                  }
                  className="px-2.5 py-1 rounded bg-black/5 dark:bg-white/10 capitalize"
                >
                  {settings.maxWidth === 'compact' ? '紧凑' : settings.maxWidth === 'normal' ? '标准' : '宽屏'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Drawer Sidebar */}
      {showCatalog && (
        <div className="fixed inset-y-0 left-0 z-40 w-72 sm:w-80 bg-inherit shadow-2xl border-r border-black/10 dark:border-white/10 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
            <h3 className="font-bold text-sm">目录 ({chapters.length}章)</h3>
            <button
              onClick={() => setShowCatalog(false)}
              className="p-1 rounded hover:bg-black/10 text-xs"
            >
              关闭
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2 space-y-1">
            {chapters.map((ch) => (
              <button
                key={ch.index}
                onClick={() => {
                  setCurrentChapterIndex(ch.index);
                  setShowCatalog(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-colors ${
                  ch.index === currentChapterIndex
                    ? 'bg-amber-600 text-white font-semibold'
                    : 'hover:bg-black/5 dark:hover:bg-white/10 opacity-80 hover:opacity-100'
                }`}
              >
                {ch.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Chapter Content Container */}
      <main className={`mx-auto px-5 sm:px-8 py-10 ${maxWidthClass} transition-all`}>
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3 opacity-60">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            <p className="text-sm">正在加载章节内容并执行净化排版...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-4">
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
            <button
              onClick={() => setRetryTick((t) => t + 1)}
              className="px-4 py-2 bg-amber-600 text-white text-xs rounded-lg shadow-sm"
            >
              重新抓取本章
            </button>
          </div>
        ) : (
          <article className="space-y-8">
            {/* Chapter Header */}
            <header className="text-center border-b border-black/10 dark:border-white/10 pb-6">
              <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight mb-2 ${fontClass}`}>
                {chapterTitle || currentChapter.title}
              </h1>
              <div className="text-xs opacity-60 flex items-center justify-center gap-2 flex-wrap">
                <span>{novel.title}</span>
                <span>·</span>
                <span>{novel.author}</span>
                <span>·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">网络原版 · 原文保真</span>
                {subpageCount > 1 && (
                  <>
                    <span>·</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium">
                      已智能拼接全章共 {subpageCount} 页 · 100% 完整原版
                    </span>
                  </>
                )}
              </div>
            </header>

            {/* Formatted Text Body */}
            <div
              className={`leading-relaxed whitespace-pre-wrap select-text text-justify ${fontClass}`}
              style={{
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
              }}
            >
              {chapterContent}
            </div>

            {/* Bottom Chapter Switcher Navigation */}
            <footer className="pt-12 pb-16 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-4">
              <button
                disabled={currentChapterIndex <= 1}
                onClick={() => setCurrentChapterIndex((prev) => Math.max(1, prev - 1))}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>上一章</span>
              </button>

              <button
                onClick={() => setShowCatalog(true)}
                className="text-xs opacity-70 hover:opacity-100 underline underline-offset-4"
              >
                第 {currentChapterIndex} / {chapters.length || 1} 章
              </button>

              <button
                disabled={chapters.length > 0 && currentChapterIndex >= chapters.length}
                onClick={() => setCurrentChapterIndex((prev) => prev + 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-sm"
              >
                <span>下一章</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </footer>
          </article>
        )}
      </main>
    </div>
  );
};
