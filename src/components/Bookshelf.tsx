import React from 'react';
import { Novel } from '../types';
import { BookOpen, Download, Trash2, BookmarkCheck, ArrowRight } from 'lucide-react';

interface BookshelfProps {
  books: Novel[];
  onSelect: (novel: Novel) => void;
  onRead: (novel: Novel, chapterIndex: number) => void;
  onRemove: (novelId: string) => void;
  onExplore: () => void;
}

export const Bookshelf: React.FC<BookshelfProps> = ({
  books,
  onSelect,
  onRead,
  onRemove,
  onExplore,
}) => {
  if (books.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-stone-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200/60 dark:border-stone-700">
          <BookmarkCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
          您的书架还是空的
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto mb-6">
          在全网检索中点击喜欢的作品，加入书架以便随时跟踪阅读进度，或一键批量导出 TXT 小说文件。
        </p>
        <button
          onClick={onExplore}
          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-sm inline-flex items-center gap-2"
        >
          <span>去探索全网热门小说</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
            我的追更书架
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            本地持久化保存，记录上次阅读进度，支持随时增量导出 TXT
          </p>
        </div>
        <span className="text-xs font-mono text-stone-500">
          共 {books.length} 本藏书
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {books.map((novel) => (
          <div
            key={novel.id}
            className="group relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 hover:border-amber-400 dark:hover:border-amber-700/80 transition-all shadow-sm flex flex-col justify-between"
          >
            <div className="flex gap-3.5">
              <div className="w-20 h-28 shrink-0 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 shadow-sm border border-stone-200/60 dark:border-stone-700/60">
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
                <h3
                  onClick={() => onSelect(novel)}
                  className="text-base font-serif font-bold text-stone-900 dark:text-stone-100 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer truncate"
                >
                  {novel.title}
                </h3>
                <div className="text-xs text-stone-500 mt-0.5 mb-2 truncate">
                  <span>{novel.author}</span> · <span>{novel.category || '玄幻'}</span>
                </div>

                <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-stone-800/80 px-2.5 py-1.5 rounded-lg border border-amber-200/60 dark:border-stone-700 truncate">
                  上次读到: {novel.lastReadChapterTitle || '第一章'}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
              <button
                onClick={() => onRemove(novel.id)}
                className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                title="移出书架"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelect(novel)}
                  className="px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出TXT</span>
                </button>

                <button
                  onClick={() => onRead(novel, novel.lastReadChapterIndex || 1)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>继续阅读</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
