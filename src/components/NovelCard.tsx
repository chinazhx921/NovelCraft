import React, { useState } from 'react';
import { Novel } from '../types';
import { BookOpen, Download, Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react';

interface NovelCardProps {
  novel: Novel;
  onSelect: (novel: Novel) => void;
  onRead: (novel: Novel) => void;
  onToggleBookshelf: (novel: Novel) => void;
  isBookmarked: boolean;
}

export const NovelCard: React.FC<NovelCardProps> = ({
  novel,
  onSelect,
  onRead,
  onToggleBookshelf,
  isBookmarked,
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="group relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 sm:p-5 hover:border-amber-400 dark:hover:border-amber-700/80 transition-all hover:shadow-md flex flex-col justify-between">
      <div className="flex gap-4">
        {/* Book Cover with graceful fallback */}
        <div className="relative w-24 h-32 sm:w-28 sm:h-36 shrink-0 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 shadow-sm border border-stone-200/60 dark:border-stone-700/60">
          {!imageError && novel.cover ? (
            <img
              src={novel.cover}
              alt={novel.title}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-amber-700 to-stone-900 text-amber-50">
              <BookOpen className="w-6 h-6 mb-1 text-amber-300/80" />
              <span className="text-xs font-serif font-bold line-clamp-2 leading-tight">
                {novel.title}
              </span>
            </div>
          )}
        </div>

        {/* Book Meta & Intro */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              onClick={() => onSelect(novel)}
              className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-stone-100 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer transition-colors line-clamp-1"
            >
              {novel.title}
            </h3>

            <button
              onClick={() => onToggleBookshelf(novel)}
              title={isBookmarked ? '移出书架' : '加入书架'}
              className="text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 p-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              {isBookmarked ? (
                <BookmarkCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Unboxed Metadata with typographic separators */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mt-1 mb-2">
            <span className="font-medium text-stone-800 dark:text-stone-200">{novel.author}</span>
            <span aria-hidden="true">·</span>
            <span>{novel.category || '网络小说'}</span>
            <span aria-hidden="true">·</span>
            <span className={novel.status === '完结' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
              {novel.status || '连载中'}
            </span>
            {novel.wordCount && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{novel.wordCount}</span>
              </>
            )}
          </div>

          {/* Intro Synopsis */}
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed mb-3">
            {novel.intro || '暂无作品简介。'}
          </p>

          {/* Latest Chapter Link */}
          {novel.latestChapter && (
            <div className="text-xs text-stone-500 dark:text-stone-400 truncate flex items-center gap-1">
              <span className="text-stone-400 shrink-0">最新:</span>
              <span className="truncate hover:text-stone-700 dark:hover:text-stone-300">
                {novel.latestChapter}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2">
        <div className="text-[11px] text-stone-400 truncate max-w-[130px] sm:max-w-[180px]">
          来源: {novel.sourceName || '聚合书源'}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRead(novel)}
            className="px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>阅读</span>
          </button>

          <button
            onClick={() => onSelect(novel)}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>目录与下载</span>
          </button>
        </div>
      </div>
    </div>
  );
};
