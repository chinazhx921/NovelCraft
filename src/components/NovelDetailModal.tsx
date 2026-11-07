import React, { useState, useEffect } from 'react';
import { Novel, Chapter, TxtFormatOptions } from '../types';
import { X, Download, BookOpen, Loader2, ArrowUpDown, Search, CheckCircle2, Bookmark, BookmarkCheck, FileText, Settings2 } from 'lucide-react';

interface NovelDetailModalProps {
  novel: Novel | null;
  onClose: () => void;
  onReadChapter: (novel: Novel, chapterIndex: number) => void;
  onStartDownload: (novel: Novel, selectedChapters: Chapter[], formatOptions: TxtFormatOptions) => void;
  onToggleBookshelf: (novel: Novel) => void;
  isBookmarked: boolean;
}

export const NovelDetailModal: React.FC<NovelDetailModalProps> = ({
  novel,
  onClose,
  onReadChapter,
  onStartDownload,
  onToggleBookshelf,
  isBookmarked,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isReversed, setIsReversed] = useState(false);

  // Range and download options
  const [downloadScope, setDownloadScope] = useState<'all' | 'custom'>('all');
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(100);
  const [showConfig, setShowConfig] = useState(false);

  const [formatOptions, setFormatOptions] = useState<TxtFormatOptions>({
    includeTitleIntro: true,
    includeCatalog: true,
    indentParagraphs: true,
    dividerStyle: 'equals',
    encoding: 'utf-8',
  });

  useEffect(() => {
    if (!novel) return;

    // Reset state
    setError(null);
    setSearchFilter('');
    setIsReversed(false);

    // If chapters already loaded in novel object
    if (novel.chapters && novel.chapters.length > 0) {
      setChapters(novel.chapters);
      setRangeStart(1);
      setRangeEnd(Math.min(100, novel.chapters.length));
      return;
    }

    // Otherwise fetch book detail
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const queryParams = novel.sourceUrl
          ? `url=${encodeURIComponent(novel.sourceUrl)}`
          : `id=${encodeURIComponent(novel.id)}`;

        const res = await fetch(`/api/book-detail?${queryParams}`);
        if (!res.ok) {
          throw new Error('获取小说目录失败，源站可能超时');
        }
        const data = await res.json();
        if (data.book && data.book.chapters) {
          setChapters(data.book.chapters);
          setRangeStart(1);
          setRangeEnd(Math.min(100, data.book.chapters.length));
        } else {
          throw new Error('未解析到有效章节目录');
        }
      } catch (err: any) {
        setError(err.message || '获取目录失败');
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [novel]);

  if (!novel) return null;

  const filteredChapters = chapters.filter((c) =>
    c.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const displayChapters = isReversed ? [...filteredChapters].reverse() : filteredChapters;

  const handleStartDownloadClick = () => {
    let targetList: Chapter[] = [];
    if (downloadScope === 'all') {
      targetList = chapters;
    } else {
      const s = Math.max(1, rangeStart);
      const e = Math.min(chapters.length, rangeEnd);
      targetList = chapters.filter((c) => c.index >= s && c.index <= e);
    }

    if (targetList.length === 0) {
      alert('请选择有效的下载章节范围');
      return;
    }

    onStartDownload(novel, targetList, formatOptions);
  };

  const setQuickRange = (count: number) => {
    setDownloadScope('custom');
    setRangeStart(1);
    setRangeEnd(Math.min(count, chapters.length));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 truncate">
            <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100 truncate">
              {novel.title}
            </h2>
            <span className="text-xs text-stone-500 dark:text-stone-400 shrink-0">
              {novel.author}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleBookshelf(novel)}
              className="p-2 text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
              title={isBookmarked ? '从书架移除' : '加入我的书架'}
            >
              {isBookmarked ? (
                <BookmarkCheck className="w-4 h-4 text-amber-600" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Top Novel Summary Card */}
          <div className="flex flex-col sm:flex-row gap-5 p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-800">
            <div className="w-24 h-32 shrink-0 rounded-lg overflow-hidden bg-stone-200 dark:bg-stone-700 shadow-sm mx-auto sm:mx-0">
              <img
                src={novel.cover}
                alt={novel.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-2">
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  作者: {novel.author}
                </span>
                <span aria-hidden="true">·</span>
                <span>分类: {novel.category || '通俗网络文学'}</span>
                <span aria-hidden="true">·</span>
                <span>状态: {novel.status || '连载中'}</span>
                <span aria-hidden="true">·</span>
                <span>
                  共 <strong className="text-amber-600 dark:text-amber-400">{chapters.length}</strong> 章
                </span>
              </div>

              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed max-h-24 overflow-y-auto pr-1">
                {novel.intro || '暂无详细简介。'}
              </p>

              {/* Action shortcuts */}
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-stone-200/60 dark:border-stone-700/60">
                <button
                  onClick={() => onReadChapter(novel, 1)}
                  className="px-3.5 py-1.5 text-xs font-medium text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-600 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>从第一章开始阅读</span>
                </button>

                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="px-3.5 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-700/60 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>{showConfig ? '收起下载排版设置' : '自定义 TXT 排版格式'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* TXT Format Customization Drawer */}
          {showConfig && (
            <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 space-y-3">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                TXT 小说导出排版定制
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <label className="flex items-center gap-2 text-stone-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formatOptions.includeTitleIntro}
                    onChange={(e) =>
                      setFormatOptions({ ...formatOptions, includeTitleIntro: e.target.checked })
                    }
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>包含书名与作品简介</span>
                </label>

                <label className="flex items-center gap-2 text-stone-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formatOptions.includeCatalog}
                    onChange={(e) =>
                      setFormatOptions({ ...formatOptions, includeCatalog: e.target.checked })
                    }
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>文首生成完整目录索引</span>
                </label>

                <label className="flex items-center gap-2 text-stone-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formatOptions.indentParagraphs}
                    onChange={(e) =>
                      setFormatOptions({ ...formatOptions, indentParagraphs: e.target.checked })
                    }
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>段落标准全角空两格（　　）</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <span className="text-stone-500">分隔线:</span>
                  <select
                    value={formatOptions.dividerStyle}
                    onChange={(e: any) =>
                      setFormatOptions({ ...formatOptions, dividerStyle: e.target.value })
                    }
                    className="bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded px-2 py-1 text-xs"
                  >
                    <option value="equals">等号线条 (=== 第X章 ===)</option>
                    <option value="dashes">破折线条 (--- 第X章 ---)</option>
                    <option value="stars">星号线条 (*** 第X章 ***)</option>
                    <option value="simple">无修饰纯标题</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Download Scope & Controls Bar */}
          <div className="p-4 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-auto flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 text-xs">
                <button
                  type="button"
                  onClick={() => setDownloadScope('all')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    downloadScope === 'all'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  全本所有章节 ({chapters.length}章)
                </button>
                <button
                  type="button"
                  onClick={() => setDownloadScope('custom')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    downloadScope === 'custom'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  自定义区间
                </button>
              </div>

              {downloadScope === 'custom' && (
                <div className="flex items-center gap-2 text-xs">
                  <span>从第</span>
                  <input
                    type="number"
                    min={1}
                    max={chapters.length || 1}
                    value={rangeStart}
                    onChange={(e) => setRangeStart(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded text-center"
                  />
                  <span>章 到 第</span>
                  <input
                    type="number"
                    min={1}
                    max={chapters.length || 1}
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded text-center"
                  />
                  <span>章</span>

                  <div className="hidden lg:flex items-center gap-1 ml-2 text-stone-400">
                    <span>快捷:</span>
                    <button
                      onClick={() => setQuickRange(50)}
                      className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-700 rounded hover:text-stone-900 dark:hover:text-white"
                    >
                      前50章
                    </button>
                    <button
                      onClick={() => setQuickRange(100)}
                      className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-700 rounded hover:text-stone-900 dark:hover:text-white"
                    >
                      前100章
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleStartDownloadClick}
              disabled={loading || chapters.length === 0}
              className="w-full md:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>
                {downloadScope === 'all'
                  ? `一键导出全本 TXT (${chapters.length}章)`
                  : `导出选定区间 TXT (${Math.max(0, Math.min(chapters.length, rangeEnd) - Math.max(1, rangeStart) + 1)}章)`}
              </span>
            </button>
          </div>

          {/* Chapter Directory Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  完整章节目录
                </h3>
                <span className="text-xs text-stone-500">
                  ({filteredChapters.length} 章节)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Search in Chapter list */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="在章节中搜索..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Reverse Sort Toggle */}
                <button
                  onClick={() => setIsReversed(!isReversed)}
                  className="px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 bg-stone-100 dark:bg-stone-800 rounded-lg transition-colors flex items-center gap-1"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{isReversed ? '倒序' : '正序'}</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-stone-500 text-sm">
                <Loader2 className="w-6 h-6 animate-spin text-amber-600 mb-2" />
                <span>正在抓取最新小说目录...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs text-center border border-red-200 dark:border-red-800">
                {error}
              </div>
            ) : displayChapters.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-xs">
                没有找到匹配的章节
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
                {displayChapters.map((chapter) => (
                  <button
                    key={chapter.index}
                    onClick={() => onReadChapter(novel, chapter.index)}
                    className="text-left px-3 py-2 rounded-lg text-xs bg-stone-50 hover:bg-amber-50 dark:bg-stone-800/40 dark:hover:bg-amber-950/30 border border-stone-200/50 dark:border-stone-700/50 text-stone-700 dark:text-stone-300 hover:text-amber-800 dark:hover:text-amber-300 transition-colors truncate group flex items-center justify-between"
                  >
                    <span className="truncate">{chapter.title}</span>
                    <span className="text-[10px] text-stone-400 group-hover:text-amber-600 shrink-0 ml-1">
                      阅读
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
