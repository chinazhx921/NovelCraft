import React, { useState, useEffect, useRef } from 'react';
import { Novel, Chapter, TxtFormatOptions } from '../types';
import { X, Download, CheckCircle2, AlertCircle, Pause, Play, Loader2, FileDown, BookOpen } from 'lucide-react';

interface DownloaderModalProps {
  novel: Novel;
  chaptersToDownload: Chapter[];
  formatOptions: TxtFormatOptions;
  onClose: () => void;
  onOpenReader: (novel: Novel, chapterIndex: number) => void;
}

export const DownloaderModal: React.FC<DownloaderModalProps> = ({
  novel,
  chaptersToDownload,
  formatOptions,
  onClose,
  onOpenReader,
}) => {
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [currentChapterTitle, setCurrentChapterTitle] = useState('');
  const [status, setStatus] = useState<'downloading' | 'paused' | 'completed' | 'cancelled' | 'error'>('downloading');
  const [logs, setLogs] = useState<string[]>([]);
  const [txtBlobUrl, setTxtBlobUrl] = useState<string | null>(null);
  const [totalWords, setTotalWords] = useState(0);

  const downloadedDataRef = useRef<Map<number, { title: string; content: string }>>(new Map());
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);

  const total = chaptersToDownload.length;
  const progressPercent = total > 0 ? Math.round((downloadedCount / total) * 100) : 0;

  useEffect(() => {
    let isMounted = true;
    isPausedRef.current = false;
    isCancelledRef.current = false;

    const runBatchDownload = async () => {
      setStatus('downloading');
      setLogs([`🚀 开始批量抓取《${novel.title}》，共计 ${total} 章节...`]);

      const CONCURRENCY = 3;
      let currentIndex = 0;
      let wordCounter = 0;

      const worker = async () => {
        while (currentIndex < total && !isCancelledRef.current) {
          // Handle pause
          while (isPausedRef.current && !isCancelledRef.current) {
            await new Promise((r) => setTimeout(r, 400));
          }

          if (isCancelledRef.current) break;

          const itemIndex = currentIndex++;
          const ch = chaptersToDownload[itemIndex];
          if (!ch) continue;

          setCurrentChapterTitle(ch.title);

          try {
            // Check if novel is demo preset
            let chapterText = '';
            if (novel.id.startsWith('demo-')) {
              const res = await fetch(
                `/api/chapter-content?bookId=${encodeURIComponent(novel.id)}&chapterIndex=${ch.index}&chapterTitle=${encodeURIComponent(ch.title)}`
              );
              const data = await res.json();
              chapterText = data.content || '';
            } else {
              const res = await fetch(
                `/api/chapter-content?url=${encodeURIComponent(ch.url)}&chapterTitle=${encodeURIComponent(ch.title)}`
              );
              const data = await res.json();
              chapterText = data.content || '';
            }

            if (!chapterText) {
              chapterText = '（本章节内容获取为空或暂时缺失）';
            }

            downloadedDataRef.current.set(ch.index, {
              title: ch.title,
              content: chapterText,
            });

            wordCounter += chapterText.length;
            setTotalWords(wordCounter);

            if (isMounted) {
              setDownloadedCount((prev) => prev + 1);
              setLogs((prev) => [
                `✓ 已成功采集 [${ch.index}/${total}] ${ch.title} (${chapterText.length}字)`,
                ...prev.slice(0, 7),
              ]);
            }
          } catch (err: any) {
            console.error(`Error scraping chapter ${ch.index}:`, err);
            downloadedDataRef.current.set(ch.index, {
              title: ch.title,
              content: `　　（本章节爬取超时或网络波动，原章节标题：${ch.title}）`,
            });
            if (isMounted) {
              setDownloadedCount((prev) => prev + 1);
              setLogs((prev) => [
                `⚠️ 章节 [${ch.index}] 采集异常，已自动跳过或记录`,
                ...prev.slice(0, 7),
              ]);
            }
          }

          // Gentle throttle to respect source server
          await new Promise((r) => setTimeout(r, 120));
        }
      };

      // Run parallel workers
      const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker());
      await Promise.all(workers);

      if (isCancelledRef.current) {
        setStatus('cancelled');
        return;
      }

      // Generate complete TXT file content
      const generatedTxt = assembleTxtFile(
        novel,
        chaptersToDownload,
        downloadedDataRef.current,
        formatOptions
      );

      const blob = new Blob([generatedTxt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setTxtBlobUrl(url);
      setStatus('completed');

      // Auto trigger download
      triggerBrowserDownload(url, `${novel.title}_${novel.author}.txt`);
    };

    runBatchDownload();

    return () => {
      isMounted = false;
      isCancelledRef.current = true;
    };
  }, [novel, chaptersToDownload, formatOptions]);

  const handleTogglePause = () => {
    if (status === 'downloading') {
      isPausedRef.current = true;
      setStatus('paused');
    } else if (status === 'paused') {
      isPausedRef.current = false;
      setStatus('downloading');
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setStatus('cancelled');
    onClose();
  };

  const handleManualDownload = () => {
    if (txtBlobUrl) {
      triggerBrowserDownload(txtBlobUrl, `${novel.title}_${novel.author}.txt`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 flex flex-col space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {status === 'completed' ? 'TXT 小说生成完毕' : '批量爬取与 TXT 打包'}
              </h3>
              <p className="text-xs text-stone-500">《{novel.title}》· {novel.author}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar & Numerical Metrics */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium text-stone-700 dark:text-stone-300">
              {status === 'completed'
                ? '全部章节已完成净化并打包'
                : `正在采集: ${currentChapterTitle || '准备中...'}`}
            </span>
            <span className="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
              {progressPercent}% ({downloadedCount}/{total})
            </span>
          </div>

          <div className="w-full h-3 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden p-0.5 border border-stone-200 dark:border-stone-700">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-stone-400 pt-1">
            <span>已累计抓取约 {(totalWords / 10000).toFixed(1)} 万字</span>
            <span>并发线程: 3 节点自动轮询</span>
          </div>
        </div>

        {/* Live Scrape Log Terminal Stream */}
        <div className="bg-stone-950 text-stone-300 font-mono text-xs rounded-xl p-3 h-32 overflow-y-auto space-y-1 border border-stone-800 select-none">
          {logs.map((log, idx) => (
            <div key={idx} className="truncate">
              {log}
            </div>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          {status === 'completed' ? (
            <div className="w-full flex items-center gap-3">
              <button
                onClick={() => onOpenReader(novel, 1)}
                className="flex-1 py-2.5 px-4 text-xs font-medium text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <BookOpen className="w-4 h-4" />
                <span>在线阅读此书</span>
              </button>

              <button
                onClick={handleManualDownload}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md"
              >
                <FileDown className="w-4 h-4" />
                <span>再次保存 TXT 文件</span>
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between gap-3">
              <button
                onClick={handleTogglePause}
                className="px-4 py-2 text-xs font-medium text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-colors flex items-center gap-1.5"
              >
                {status === 'paused' ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-600" />
                    <span>继续抓取</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-600" />
                    <span>暂停抓取</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCancel}
                className="px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
              >
                终止并关闭
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper: Format and generate standard novel TXT text
function assembleTxtFile(
  novel: Novel,
  chapters: Chapter[],
  dataMap: Map<number, { title: string; content: string }>,
  format: TxtFormatOptions
): string {
  const parts: string[] = [];
  const divider = '='.repeat(64);

  // 1. Title & Intro
  if (format.includeTitleIntro) {
    parts.push(divider);
    parts.push(`书名：${novel.title}`);
    parts.push(`作者：${novel.author}`);
    parts.push(`分类：${novel.category || '网络文学'}`);
    parts.push(`状态：${novel.status || '连载/完结'}`);
    parts.push(`导出时间：${new Date().toLocaleDateString('zh-CN')} ${new Date().toLocaleTimeString('zh-CN')}`);
    parts.push(`生成工具：NovelCraft 全网小说聚合爬虫与下载器`);
    parts.push(divider);
    parts.push('');
    parts.push('【作品简介】');
    parts.push(novel.intro || '暂无作品简介。');
    parts.push('');
  }

  // 2. Table of Contents
  if (format.includeCatalog) {
    parts.push(divider);
    parts.push('【目录索引】');
    parts.push(divider);
    chapters.forEach((ch) => {
      parts.push(ch.title);
    });
    parts.push('');
    parts.push(divider);
    parts.push('');
  }

  // 3. Chapters content
  chapters.forEach((ch) => {
    const data = dataMap.get(ch.index);
    const title = data?.title || ch.title;
    const content = data?.content || '（暂无正文内容）';

    let headerLine = '';
    if (format.dividerStyle === 'equals') {
      headerLine = `\n==================== ${title} ====================\n`;
    } else if (format.dividerStyle === 'dashes') {
      headerLine = `\n-------------------- ${title} --------------------\n`;
    } else if (format.dividerStyle === 'stars') {
      headerLine = `\n******************** ${title} ********************\n`;
    } else {
      headerLine = `\n${title}\n`;
    }

    parts.push(headerLine);
    parts.push(content);
    parts.push('\n');
  });

  return parts.join('\n');
}

// Helper: Trigger browser file download
function triggerBrowserDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
