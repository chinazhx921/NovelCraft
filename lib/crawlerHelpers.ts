import iconv from 'iconv-lite';

export function normalizeCrawlUrl(raw: string): string {
  let trimmed = (raw || '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('//')) {
    trimmed = 'https:' + trimmed;
  } else if (!/^https?:\/\//i.test(trimmed)) {
    // Allow users to paste domain/path without scheme (e.g. www.baishuwu.com/info/188122/)
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*|\?.*)?$/i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http:// 或 https:// 网址');
  }
  return parsed.toString();
}

export function decodeHtmlBuffer(buffer: Buffer | Uint8Array, contentType = ''): string {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const ct = contentType.toLowerCase();
  const peek = buf.subarray(0, 4096).toString('binary');

  let charset = 'utf-8';
  if (/charset\s*=\s*["']?(gbk|gb2312|gb18030)/i.test(ct)) {
    charset = 'gb18030';
  } else if (/charset\s*=\s*["']?big5/i.test(ct)) {
    charset = 'big5';
  } else if (
    /charset\s*=\s*["']?(gbk|gb2312|gb18030)/i.test(peek) ||
    /content=["'][^"']*charset\s*=\s*(gbk|gb2312|gb18030)/i.test(peek)
  ) {
    charset = 'gb18030';
  } else if (
    /charset\s*=\s*["']?big5/i.test(peek) ||
    /content=["'][^"']*charset\s*=\s*big5/i.test(peek)
  ) {
    charset = 'big5';
  }

  if (charset !== 'utf-8') {
    try {
      return iconv.decode(buf, charset);
    } catch {
      return buf.toString('utf-8');
    }
  }

  const utf8Text = buf.toString('utf-8');
  // Heuristic fallback: if UTF-8 decoding produces many replacement characters, try gb18030
  const replacementMatches = utf8Text.match(/\uFFFD/g);
  if (replacementMatches && replacementMatches.length > 5) {
    try {
      const gbkText = iconv.decode(buf, 'gb18030');
      const gbkReplacements = gbkText.match(/\uFFFD/g);
      if (!gbkReplacements || gbkReplacements.length < replacementMatches.length) {
        return gbkText;
      }
    } catch {}
  }

  return utf8Text;
}

export function formatNovelText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/?(?:p|div)\b[^>]*>/gi, '\n')
    .replace(/<h\d\b[^<]*(?:(?!<\/h\d>)<[^<]*)*<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Remove common annoying novel watermarks and navigation text
    .replace(/上一章|下一章|章节目录|保存书签|投推荐票|加入书签|返回目录|返回书页/g, '')
    .replace(/请记住本书首发域名[^\n]*/g, '')
    .replace(/一秒记住[^\n]*/g, '')
    .replace(/手机阅读请访问[^\n]*/g, '')
    .replace(/无弹窗小说网[^\n]*/g, '')
    .replace(/本章未完，[请]?点击下一页继续阅读[^\n]*/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^(上章|下章|目录|存书签|上一页|下一页|首页|书架|报错|投票)$/.test(line))
    .map((line) => `　　${line}`)
    .join('\n\n');
}

export function parseChineseNumber(str: string): number {
  const map: Record<string, number> = {
    '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  };
  const units: Record<string, number> = {
    '十': 10, '百': 100, '千': 1000, '万': 10000,
  };

  let total = 0;
  let current = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (map[char] !== undefined) {
      current = map[char];
    } else if (units[char] !== undefined) {
      const unit = units[char];
      if (unit === 10 && current === 0 && (i === 0 || map[str[i - 1]] === undefined)) {
        current = 1;
      }
      if (unit === 10000) {
        total = (total + current) * 10000;
        current = 0;
      } else {
        total += current * unit;
        current = 0;
      }
    }
  }
  total += current;
  return total;
}

export function extractChapterNumber(title: string): number {
  if (!title) return 999999;

  const arabicMatch = title.match(/第\s*(\d+)\s*[章回节集部篇卷]/);
  if (arabicMatch) {
    return parseInt(arabicMatch[1], 10);
  }

  const cnMatch = title.match(/第\s*([零〇一二两三四五六七八九十百千万]+)\s*[章回节集部篇卷]/);
  if (cnMatch) {
    const num = parseChineseNumber(cnMatch[1]);
    if (num > 0) return num;
  }

  const startNumMatch = title.match(/^(\d+)[\s.、_-]/);
  if (startNumMatch) {
    return parseInt(startNumMatch[1], 10);
  }

  const bareMatch = title.match(/第\s*(\d+)/);
  if (bareMatch) {
    return parseInt(bareMatch[1], 10);
  }

  const enMatch = title.match(/chapter\s*(\d+)/i);
  if (enMatch) {
    return parseInt(enMatch[1], 10);
  }

  return 999999;
}

function getBaseHost(hostname: string): string {
  return hostname.replace(/^(www|m|wap)\./i, '').toLowerCase();
}

export function isSameSiteHost(urlA: string, urlB: string): boolean {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    return getBaseHost(a.hostname) === getBaseHost(b.hostname);
  } catch {
    return false;
  }
}

export function isCatalogUpgradeLink(text: string, href: string, currentUrl: string): boolean {
  const cleanText = (text || '').replace(/\s+/g, ' ').trim();
  if (!href || href.startsWith('javascript') || href === '#') return false;

  // Must explicitly say it's a catalog / TOC / all-chapters link
  const isTocText = /^(查看)?(完整|全部|所有)?(章节)?(目录|章节列表|书目)(页)?$|^查看更多章节|^查看全部章节|^查看完整目录|^返回目录|^章节目录$/.test(
    cleanText.replace(/[.。…>]+$/g, '')
  );
  if (!isTocText) return false;

  try {
    const resolved = new URL(href, currentUrl);
    if (!isSameSiteHost(resolved.toString(), currentUrl)) return false;
    if (resolved.toString() === currentUrl) return false;
    // Reject category/home links
    if (resolved.pathname === '/' || /^\/(?:list\/\d+_\d+|rank|top|sort|category)/i.test(resolved.pathname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const NON_CHAPTER_TEXT_REGEX =
  /^(首页|书架|登录|注册|留言|推荐|排行榜|下载|分类|加书签|投推荐|返回书页|开始阅读|继续阅读|最新更新|txt下载|手机版|电脑版|下一页|上一页|上一章|下一章|目录|加入书签|加入书架|繁體|简体|设为首页|收藏本站|章节目录|保存书签|全部章节|查看目录|查看全部章节|查看完整目录|查看更多章节|书评|报错)$/i;

export const CATEGORY_OR_NAV_TEXT_REGEX =
  /玄幻修真|都市言情|武侠仙侠|历史军事|科幻灵异|恐怖惊悚|网游竞技|女生耽美|其它类型|全本小说|完结小说|设为首页|收藏本站|会员书架|阅读记录|问题反馈/i;

export function isLikelyChapterLink(
  fullUrl: string,
  pageUrl: string,
  chTitle: string,
  inCatalogContainer: boolean
): boolean {
  if (!fullUrl || fullUrl === pageUrl) return false;
  const cleanTitle = (chTitle || '').trim();
  if (cleanTitle.length > 90) return false;
  if (NON_CHAPTER_TEXT_REGEX.test(cleanTitle) || CATEGORY_OR_NAV_TEXT_REGEX.test(cleanTitle)) {
    return false;
  }
  if (/^第\s*\d+\s*页$/i.test(cleanTitle)) return false;

  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(fullUrl);
    base = new URL(pageUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (getBaseHost(parsed.hostname) !== getBaseHost(base.hostname)) return false;

  const p = parsed.pathname;
  if (p === '/' || p === '') return false;

  // Reject auth, user, author, search, category, tag, ranking, and static root pages
  if (
    /\/(login|register|mybook|tmpbook|bookshelf|user|author|search|rank|top|sort|category|tag|tags|reviews|age_verify|feedback|about|privacy|contact)\b/i.test(
      p
    )
  ) {
    return false;
  }
  if (/^\/(?:list|wanben|all|hot|update|new|end|full|index)(?:\.html|\/)?$/i.test(p)) {
    return false;
  }
  // Reject book-info / catalog root pages like /info/188122/, /info/188122/2/, /book/30570/, /book/30570/list/, /index/4188/
  if (
    /^\/info\/\d+(?:\/\d+)?\/?$/i.test(p) ||
    /^\/info\/\d+_\d+\/?$/i.test(p) ||
    /^\/book\/\d+(?:\/list)?\/?$/i.test(p) ||
    /^\/bk\/\d+(?:\/chapters)?\/?$/i.test(p) ||
    /^\/index\/\d+(?:\/\d+)?\/?$/i.test(p) ||
    /^\/xs\/\d+\/?$/i.test(p) ||
    /^\/mulu\/\d+\.html?$/i.test(p) ||
    /^\/novel\/[^/]+(?:\/chapters)?\/?$/i.test(p)
  ) {
    return false;
  }

  // Known chapter URL patterns (with or without .html)
  if (
    /\.(?:html?|shtml?)(?:$|\/)/i.test(p) ||
    /\/(?:read|html|section|chapter|chapters|article|view|txt|xs|p|archives)\//i.test(p) ||
    /\/info\/\d+\/\d+/i.test(p) ||
    /\/book\/\d+\/\d+/i.test(p) ||
    /\/novel\/[^/]+\/(?:chapter\/)?\d+/i.test(p) ||
    /[?&](?:chapter|cid|id|aid)=\d+/i.test(parsed.search)
  ) {
    return true;
  }

  // Fallback inside explicit catalog containers: accept deeper paths ending with digits/slug
  if (inCatalogContainer && /\/\d+(?:\/|$)/.test(p) && p.split('/').filter(Boolean).length >= 2) {
    return true;
  }

  return false;
}
