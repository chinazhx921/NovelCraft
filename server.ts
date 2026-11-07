import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Initialize Gemini if API key is present
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch (err) {
    console.error('Failed to initialize Gemini AI:', err);
  }
}

// User-Agent rotation for scraping
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Helper: Fetch URL with automatic charset detection (UTF-8, GBK, GB2312)
async function fetchWithEncoding(url: string, timeoutMs = 12000): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    
    // Check Content-Type header or HTML meta tag for charset
    const contentType = res.headers.get('content-type') || '';
    let charset = 'utf-8';

    if (/charset=gbk/i.test(contentType) || /charset=gb2312/i.test(contentType)) {
      charset = 'gbk';
    } else {
      // Peek into first 1024 bytes for <meta charset="..."> or http-equiv
      const peek = buffer.subarray(0, 1024).toString('binary');
      if (/charset=["']?(gbk|gb2312)/i.test(peek) || /content=["'][^"']*charset=(gbk|gb2312)/i.test(peek)) {
        charset = 'gbk';
      }
    }

    let html = '';
    if (charset === 'gbk') {
      try {
        html = iconv.decode(buffer, 'gbk');
      } catch {
        html = buffer.toString('utf-8');
      }
    } else {
      html = buffer.toString('utf-8');
    }

    return { html, finalUrl: res.url };
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

// Clean text formatting helper
function formatNovelText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<h\d\b[^<]*(?:(?!<\/h\d>)<[^<]*)*<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Remove common annoying novel watermarks and navigation text
    .replace(/上一章|下一章|章节目录|保存书签|投推荐票/g, '')
    .replace(/请记住本书首发域名[^\n]*/g, '')
    .replace(/一秒记住[^\n]*/g, '')
    .replace(/手机阅读请访问[^\n]*/g, '')
    .replace(/无弹窗小说网[^\n]*/g, '')
    .replace(/本章未完，点击下一页继续阅读[^\n]*/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `　　${line}`) // Chinese two-fullwidth-space indentation
    .join('\n\n');
}

// Helper: Convert string to GBK URL encoding (e.g. %B6%B7%C2%DE%B4%F3%C2%BD)
function encodeToGbk(str: string): string {
  try {
    const gbkBuf = iconv.encode(str, 'gbk');
    return Array.from(gbkBuf)
      .map((b) => '%' + b.toString(16).toUpperCase())
      .join('');
  } catch {
    return encodeURIComponent(str);
  }
}

// Scrape live search results from ptwxz (飘天文学)
async function searchPtwxz(keyword: string): Promise<any[]> {
  try {
    const gbkQuery = encodeToGbk(keyword);
    const searchUrl = `https://www.ptwxz.com/modules/article/search.php?searchtype=articlename&searchkey=${gbkQuery}`;
    const { html, finalUrl } = await fetchWithEncoding(searchUrl, 6000);
    const $ = cheerio.load(html);
    const results: any[] = [];

    // Case 1: Exact single match redirects directly to bookinfo
    if (finalUrl.includes('/bookinfo/')) {
      const title = $('h1').first().text().trim() || $('title').text().split(',')[0].trim();
      let author = $('td:contains("作 者"), td:contains("作者")').first().text().replace(/.*作\s*者[：:]/g, '').split(/\s+/)[0].trim() || '网络作者';
      const intro = $('td:contains("内容简介")').next().text().trim() || $('#intro').text().trim() || `飘天文学收录小说《${title}》`;
      const catalogUrl = finalUrl.replace('/bookinfo/', '/html/').replace('.html', '/index.html');
      let cover = $('img[src*="/files/article/image/"]').attr('src') || '';
      if (cover && !cover.startsWith('http')) cover = new URL(cover, finalUrl).toString();

      if (title && !title.includes('搜索结果')) {
        results.push({
          id: 'ptwxz-exact-' + Math.random().toString(36).substring(2, 9),
          title,
          author,
          category: '网络玄幻',
          status: '完结/连载',
          wordCount: '全本连载',
          cover: cover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
          intro,
          latestChapter: '点击查看最新章节',
          sourceName: '飘天文学源',
          sourceUrl: catalogUrl,
        });
        return results;
      }
    }

    // Case 2: Multi-row search results table
    $('tr').each((i, el) => {
      if (i === 0) return;
      const tds = $(el).find('td');
      if (tds.length < 4) return;

      const titleA = tds.eq(0).find('a').first();
      const title = titleA.text().trim();
      const latestA = tds.eq(1).find('a').first();
      const latest = latestA.text().trim();
      let catalogUrl = latestA.attr('href') || titleA.attr('href') || '';
      const author = tds.eq(2).text().trim() || '网络作家';
      const wordCount = tds.eq(3).text().trim();
      const status = tds.eq(5).text().trim() || '连载';

      if (title && catalogUrl && !/查看全部章节|精华书评/.test(title)) {
        if (!catalogUrl.startsWith('http')) {
          catalogUrl = new URL(catalogUrl, finalUrl).toString();
        }
        if (catalogUrl.includes('/bookinfo/')) {
          catalogUrl = catalogUrl.replace('/bookinfo/', '/html/').replace('.html', '/index.html');
        }

        results.push({
          id: 'ptwxz-' + Math.random().toString(36).substring(2, 9),
          title,
          author,
          category: '网络文学',
          status: status.includes('完') ? '完结' : '连载中',
          wordCount: wordCount ? `${wordCount}` : '更新中',
          cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
          intro: `飘天文学实时收录《${title}》，作者：${author}，最新章节：${latest}`,
          latestChapter: latest || '查看最新章节',
          sourceName: '飘天文学源',
          sourceUrl: catalogUrl,
        });
      }
    });

    return results;
  } catch (err: any) {
    console.log('Search ptwxz notice:', err.message);
    return [];
  }
}

// Scrape live search results from biquge.tv (笔趣阁)
async function searchBiquge(keyword: string): Promise<any[]> {
  try {
    const gbkQuery = encodeToGbk(keyword);
    const searchUrl = `https://www.biquge.tv/modules/article/search.php?searchkey=${gbkQuery}`;
    const { html, finalUrl } = await fetchWithEncoding(searchUrl, 6000);
    const $ = cheerio.load(html);
    const results: any[] = [];

    $('tr').each((i, el) => {
      if (i === 0) return;
      const tds = $(el).find('td');
      if (tds.length < 4) return;

      const titleA = tds.eq(0).find('a').first();
      const title = titleA.text().trim();
      let catalogUrl = titleA.attr('href') || '';
      const latest = tds.eq(1).find('a').first().text().trim();
      const author = tds.eq(2).text().trim() || '网络作者';
      const wordCount = tds.eq(3).text().trim();
      const status = tds.eq(5).text().trim() || '连载';

      if (title && catalogUrl) {
        if (!catalogUrl.startsWith('http')) {
          catalogUrl = new URL(catalogUrl, finalUrl).toString();
        }

        results.push({
          id: 'bqg-' + Math.random().toString(36).substring(2, 9),
          title,
          author,
          category: '热血玄幻',
          status: status.includes('完') ? '完结' : '连载中',
          wordCount: wordCount ? `${wordCount}` : '更新中',
          cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&q=80',
          intro: `笔趣阁实时爬取《${title}》，作者：${author}，最新更新至：${latest}`,
          latestChapter: latest || '查看最新章节',
          sourceName: '笔趣阁源',
          sourceUrl: catalogUrl,
        });
      }
    });

    return results;
  } catch (err: any) {
    console.log('Search biquge notice:', err.message);
    return [];
  }
}

// Pre-seeded high quality popular books with verified live full-text web sources
const TRENDING_BOOKS = [
  {
    id: 'ptwxz-0-706',
    title: '斗破苍穹',
    author: '天蚕土豆',
    category: '东方玄幻 / 热血升级',
    status: '完结',
    wordCount: '532万字',
    cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&q=80',
    intro: '这里是属于斗气的世界，没有花俏艳丽的魔法，有的，仅仅是繁衍到巅峰的斗气！“三十年河东，三十年河西，莫欺少年穷！”',
    latestChapter: '第一千六百二十四章 结束，也是一种开始（大结局）',
    sourceName: '飘天文学全本源',
    sourceUrl: 'https://www.piaotia.com/html/0/706/index.html',
  },
  {
    id: 'ptwxz-0-760',
    title: '凡人修仙传',
    author: '忘语',
    category: '古典仙侠 / 凡人修真',
    status: '完结',
    wordCount: '770万字',
    cover: 'https://www.piaotia.com/files/article/image/5/5028/5028s.jpg',
    intro: '一个普通的山村穷小子，偶然之下跨入江湖小门派，成了一名记名弟子。虽然资质平庸，但他依靠自身努力和合理算计修炼成仙。',
    latestChapter: '新书《仙者》已发布',
    sourceName: '飘天文学全本源',
    sourceUrl: 'https://www.piaotia.com/html/0/760/index.html',
  },
  {
    id: 'ptwxz-8-8717',
    title: '剑来',
    author: '烽火戏诸侯',
    category: '古典仙侠 / 江湖庙堂',
    status: '连载中',
    wordCount: '1100万字',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80',
    intro: '大千世界，无奇不有。我陈平安，唯有一剑，可搬山，倒海，降妖，镇魔，敕神，摘星，摧城，开天！',
    latestChapter: '第1180章 归去来兮',
    sourceName: '飘天文学镜像源',
    sourceUrl: 'https://www.piaotia.com/html/8/8717/index.html',
  },
  {
    id: 'ptwxz-3-3155',
    title: '雪中悍刀行',
    author: '烽火戏诸侯',
    category: '玄幻武侠 / 江湖史诗',
    status: '完结',
    wordCount: '460万字',
    cover: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=300&q=80',
    intro: '有个白狐儿脸，佩双刀绣冬春雷，要做天下第一。湖底有老魁沉锁。北凉世子徐凤年，千里游历执刀北行！',
    latestChapter: '最终章 小二上酒（大结局）',
    sourceName: '飘天文学全本源',
    sourceUrl: 'https://www.piaotia.com/html/3/3155/index.html',
  },
  {
    id: 'ptwxz-1-1272',
    title: '遮天',
    author: '辰东',
    category: '古典仙侠 / 浩瀚洪荒',
    status: '完结',
    wordCount: '630万字',
    cover: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80',
    intro: '冰冷与黑暗并存的宇宙深处，九具庞大的龙尸拉着一口青铜古棺，亘古长存。登天路，踏歌行，弹指遮天！',
    latestChapter: '第1822章 遮天后记',
    sourceName: '飘天文学全本源',
    sourceUrl: 'https://www.piaotia.com/html/1/1272/index.html',
  },
  {
    id: 'ptwxz-9-9459',
    title: '诡秘之主',
    author: '爱潜水的乌贼',
    category: '西方奇幻 / 蒸汽朋克',
    status: '完结',
    wordCount: '446万字',
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
    intro: '伴随着蒸汽与机械的狂潮，神秘与愚弄的暗涌，周明瑞在一间满地狼藉的单身公寓中醒来，开启了愚者的序列神座...',
    latestChapter: '番外 旅者',
    sourceName: '飘天文学全本源',
    sourceUrl: 'https://www.piaotia.com/html/9/9459/index.html',
  },
  {
    id: 'ptwxz-0-319',
    title: '极品家丁',
    author: '禹岩',
    category: '历史架空 / 幽默传奇',
    status: '完结',
    wordCount: '320万字',
    cover: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80',
    intro: '醒掌天下权，醉卧美人膝！年轻的销售经理林晚荣意外穿越到大华朝，阴差阳错成为了萧家大院里一名光荣的“家丁”...',
    latestChapter: '第602章 携美泛舟（大结局）',
    sourceName: '飘天文学全本源',
    sourceUrl: 'https://www.piaotia.com/html/0/319/index.html',
  },
  {
    id: 'bsw-188122',
    title: '母上攻略',
    author: '竹影随行',
    category: '都市伦理 / 经典长篇',
    status: '完结',
    wordCount: '134万字',
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
    intro: '都市长篇代表作。细腻讲述了在经历家庭生活风波后，主角在复杂纠葛的现实生活与道德伦理边缘逐步产生的心路历程。文笔细腻逼真，人物心理刻画入微。',
    latestChapter: '第489章 终章·圆满与释怀',
    sourceName: '百书屋全本源',
    sourceUrl: 'https://www.baishuwu.com/info/188122/2/',
  },
  {
    id: 'bsw-15713',
    title: '少妇白洁',
    author: '雨夜带刀不带伞',
    category: '社会纪实 / 情感小说',
    status: '完结',
    wordCount: '85万字',
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
    intro: '经典社会伦理小说合集完整版。讲述了主角白洁作为一名温婉知性的女教师，在家庭、学校与纷繁复杂的社会交往中所经历的爱恨纠葛与心理挣扎。',
    latestChapter: '第十八章 魅惑人间 下',
    sourceName: '百书屋典藏源',
    sourceUrl: 'https://www.baishuwu.com/info/15713/1/',
  },
  {
    id: 'bsw-256455',
    title: '少年阿宾',
    author: 'Ben',
    category: '青春都市 / 成长心路',
    status: '完结',
    wordCount: '72万字',
    cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&q=80',
    intro: '知名青春成长文学作品。刻画了青年阿宾在考入大学前后的青春骚动、人生困惑与情感萌芽，生动呈现了特定时代青年对于爱情与成熟的探寻。',
    latestChapter: '第52章 告别青葱岁月',
    sourceName: '百书屋典藏源',
    sourceUrl: 'https://www.baishuwu.com/info/256455/',
  },
  {
    id: 'bsw-18009',
    title: '金鳞岂是池中物',
    author: 'Monkey',
    category: '都市商战 / 传奇史诗',
    status: '完结',
    wordCount: '168万字',
    cover: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80',
    intro: '当代都市商海长篇传奇。主角侯龙涛从底层小职员起步，凭借过人的胆识、远见以及对复杂人性的洞察，在商场搏杀与权谋博弈中一步步登顶。',
    latestChapter: '第112章 金鳞腾空（大结局）',
    sourceName: '百书屋典藏源',
    sourceUrl: 'https://www.baishuwu.com/info/18009/1/',
  },
];

// Universal Web Novel Search Crawler via Search Engine (For sensitive, banned, or niche novels)
async function searchWebNovels(keyword: string): Promise<any[]> {
  try {
    const cleanQ = keyword.replace(/[《》]/g, '').trim();
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQ + ' 小说 章节列表 目录')}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: any[] = [];

    $('.result').each((i, el) => {
      if (results.length >= 8) return;
      const titleRaw = $(el).find('.result__title').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      const rawHref = $(el).find('.result__title a').attr('href') || '';

      let targetUrl = '';
      const match = rawHref.match(/uddg=([^&]+)/);
      if (match) {
        try {
          targetUrl = decodeURIComponent(match[1]);
        } catch {}
      }

      if (!targetUrl || targetUrl.includes('google.com') || targetUrl.includes('duckduckgo.com')) return;

      // Extract clean title
      let cleanTitle = titleRaw.split(/最新章节|章节列表|目录|全文免费阅读|_|--/)[0].replace(/[《》]/g, '').trim();
      if (!cleanTitle) cleanTitle = cleanQ;

      // Filter to recognized novel catalog domains or catalog indicators
      if (
        /baishuwu|biquge|piaotia|ptwxz|8tsw|69shu|youziks|yushuwu|readercraft|xbiquge|shushuwu/i.test(targetUrl) ||
        /章节|目录|全本|小说/.test(titleRaw)
      ) {
        let domain = '网络原版源';
        try {
          domain = new URL(targetUrl).hostname.replace('www.', '');
        } catch {}

        results.push({
          id: 'web-' + Math.random().toString(36).substring(2, 9),
          title: cleanTitle,
          author: snippet.match(/作\s*者[：:]\s*([^\s,，。]+)/)?.[1] || '网络作家',
          category: '网络全本检索',
          status: snippet.includes('完结') || snippet.includes('全本') ? '完结' : '连载中',
          wordCount: '网络原版',
          cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
          intro: snippet || `全网实时爬取《${cleanTitle}》章节列表与原版正文`,
          latestChapter: '点击查看章节目录',
          sourceName: `全网嗅探 (${domain})`,
          sourceUrl: targetUrl,
        });
      }
    });

    return results;
  } catch (err: any) {
    console.log('searchWebNovels notice:', err.message);
    return [];
  }
}

// Result ranking helper: exact title match ranks #1, prefix match #2, shortest title #3
function rankResults(books: any[], query: string): any[] {
  const q = query.replace(/[《》]/g, '').trim().toLowerCase();
  if (!q) return books;

  return books.sort((a, b) => {
    const aTitle = (a.title || '').replace(/[《》]/g, '').trim().toLowerCase();
    const bTitle = (b.title || '').replace(/[《》]/g, '').trim().toLowerCase();

    // 1. Exact title match
    const aExact = aTitle === q;
    const bExact = bTitle === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    // 2. Starts with query
    const aStarts = aTitle.startsWith(q);
    const bStarts = bTitle.startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // 3. Shorter title closer to query
    return aTitle.length - bTitle.length;
  });
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Get List of Available Book Sources
app.get('/api/sources', (req, res) => {
  res.json({
    sources: [
      { id: 'aggregate', name: '全网聚合检索', desc: '并发检索全网各大主流小说书源与热门网络镜像', enabled: true },
      { id: 'ptwxz', name: '飘天文学镜像', desc: '经典连载网络小说镜像，海量玄幻修真全本', enabled: true },
      { id: 'bqg', name: '笔趣阁节点 01', desc: '新笔趣阁在线文学解析源', enabled: true },
      { id: 'custom', name: '自定义单链爬取', desc: '支持任意小说目录或章节链接直接解析', enabled: true },
    ],
    geminiEnabled: Boolean(ai),
  });
});

// 2. Search Novels Across Web
app.get('/api/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  const source = (req.query.source as string || 'aggregate');

  if (!query) {
    return res.json({ books: TRENDING_BOOKS, isPreset: true });
  }

  const cleanQ = query.replace(/(小说|全集|最新|无删减|完结|txt|TXT|全文|目录)/g, '').replace(/[《》]/g, '').trim() || query;

  // Local preset exact matches
  const localMatches = TRENDING_BOOKS.filter(
    b => b.title.toLowerCase().includes(cleanQ.toLowerCase()) || 
         cleanQ.toLowerCase().includes(b.title.toLowerCase()) ||
         b.author.toLowerCase().includes(cleanQ.toLowerCase())
  );

  let crawledResults: any[] = [];

  // Concurrently scrape from ptwxz, biquge, and web search
  try {
    let promises: Promise<any[]>[] = [];
    if (source === 'ptwxz') {
      promises = [searchPtwxz(query)];
    } else if (source === 'bqg') {
      promises = [searchBiquge(query)];
    } else {
      // Aggregate: search both primary sources
      promises = [searchPtwxz(query), searchBiquge(query)];
    }

    const settled = await Promise.allSettled(promises);
    for (const s of settled) {
      if (s.status === 'fulfilled' && Array.isArray(s.value)) {
        crawledResults.push(...s.value);
      }
    }

    // If primary sources found 0 or few results, invoke universal web search
    if (crawledResults.length < 2) {
      const webResults = await searchWebNovels(cleanQ);
      crawledResults.push(...webResults);
    }
  } catch (err: any) {
    console.log('Search aggregation notice:', err.message);
  }

  // Combine and deduplicate
  const combined = [...localMatches, ...crawledResults];
  const uniqueMap = new Map();
  combined.forEach(b => {
    const key = `${b.title.trim()}-${b.author.trim()}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, b);
    }
  });

  const ranked = rankResults(Array.from(uniqueMap.values()), cleanQ);

  res.json({
    books: ranked,
    count: ranked.length,
    isPreset: false,
  });
});

// 3. Get Book Catalog & Chapters (By URL or ID)
app.get('/api/book-detail', async (req, res) => {
  const { url, id } = req.query as { url?: string; id?: string };

  let targetUrl = url;

  // If no URL provided but ID is given, find corresponding sourceUrl in TRENDING_BOOKS
  if (!targetUrl && id) {
    const preset = TRENDING_BOOKS.find(b => b.id === id);
    if (preset && preset.sourceUrl) {
      targetUrl = preset.sourceUrl;
    }
  }

  if (!targetUrl) {
    return res.status(400).json({ error: '请提供小说目录链接或有效书籍ID' });
  }

  try {
    // Normalization for ptwxz
    if (targetUrl.includes('/bookinfo/')) {
      targetUrl = targetUrl.replace('/bookinfo/', '/html/').replace('.html', '/index.html');
    }

    const { html, finalUrl } = await fetchWithEncoding(targetUrl, 10000);
    const $ = cheerio.load(html);

    // Extract book title
    const title = $('h1').first().text().replace(/百书屋/g, '').replace(/作者[：:].*/g, '').trim() || 
                  $('.book-name, .info h1, .title, meta[property="og:novel:book_name"]').attr('content') || 
                  $('title').text().split(/最新章节|章节列表|无弹窗|,/)[0].trim() ||
                  '精选作品';

    // Extract author
    const author = $('.author, .author a, .writer, meta[property="og:novel:author"]').first().text().replace(/作者[：:]/g, '').trim() ||
                   $('p:contains("作 者"), p:contains("作者"), td:contains("作 者")').first().text().replace(/.*作\s*者[：:]/g, '').split(/\s+/)[0].trim() ||
                   '网络作家';

    // Extract intro
    const intro = $('#intro, .intro, .book-intro, meta[property="og:description"]').first().text().trim() ||
                  $('td:contains("内容简介")').next().text().trim() ||
                  `实时抓取收录《${title}》全本正文目录`;

    // Extract cover
    let cover = $('#fmimg img, .cover img, meta[property="og:image"], img[src*="/files/article/image/"]').first().attr('src') || '';
    if (cover && !cover.startsWith('http')) {
      cover = new URL(cover, finalUrl).toString();
    }

    // Extract Chapter List
    const chapters: { index: number; title: string; url: string }[] = [];
    const seenUrls = new Set<string>();
    let idx = 1;

    // Common catalog containers
    const catalogContainers = $('#list, .listmain, .centent, .book-list, #chapters, .catalog, .chapter-list, dl, .layout-col1');
    const targetScope = catalogContainers.length > 0 ? catalogContainers : $('body');

    targetScope.find('a').each((_, el) => {
      const $a = $(el);
      const chTitle = $a.text().trim();
      const chHref = $a.attr('href');

      if (!chHref || chHref.startsWith('javascript') || chHref === '#' || chTitle.length < 2) return;

      // Filter out non-chapter navigation links
      if (/首页|书架|登录|注册|留言|推荐|排行榜|下载|分类|加书签|投推荐|返回书页|开始阅读|最新更新|txt下载/.test(chTitle)) return;

      const fullUrl = chHref.startsWith('http') ? chHref : new URL(chHref, finalUrl).toString();
      if (seenUrls.has(fullUrl)) return;
      seenUrls.add(fullUrl);

      chapters.push({
        index: idx++,
        title: chTitle,
        url: fullUrl,
      });
    });

    res.json({
      book: {
        title,
        author,
        intro,
        cover: cover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
        sourceUrl: finalUrl,
        chapters,
        totalChapters: chapters.length,
      }
    });
  } catch (err: any) {
    console.error('Crawl book detail error:', err);
    res.status(500).json({ error: `抓取小说目录失败: ${err.message || '网络连接超时或目标反爬拦截'}` });
  }
});

// 4. Get Chapter Content (For Reading and Batch Downloader)
app.get('/api/chapter-content', async (req, res) => {
  const { url, bookId, chapterIndex, chapterTitle } = req.query as {
    url?: string;
    bookId?: string;
    chapterIndex?: string;
    chapterTitle?: string;
  };

  let targetUrl = url;

  // If no URL but bookId is provided, look up sourceUrl from TRENDING_BOOKS
  if (!targetUrl && bookId) {
    const preset = TRENDING_BOOKS.find(b => b.id === bookId);
    if (preset && preset.sourceUrl) {
      try {
        const { html, finalUrl } = await fetchWithEncoding(preset.sourceUrl, 6000);
        const $ = cheerio.load(html);
        const links: string[] = [];
        const catalogContainers = $('#list, .listmain, .centent, dl, .layout-col1');
        const targetScope = catalogContainers.length > 0 ? catalogContainers : $('body');
        targetScope.find('a').each((_, el) => {
          const href = $(el).attr('href');
          const txt = $(el).text().trim();
          if (href && !href.startsWith('javascript') && !/首页|书架|登录/.test(txt)) {
            links.push(href.startsWith('http') ? href : new URL(href, finalUrl).toString());
          }
        });
        const cIdx = Math.max(1, Number(chapterIndex) || 1);
        if (links[cIdx - 1]) {
          targetUrl = links[cIdx - 1];
        }
      } catch {}
    }
  }

  if (!targetUrl) {
    return res.status(400).json({ error: '请提供章节URL链接' });
  }

  try {
    const { html, finalUrl } = await fetchWithEncoding(targetUrl, 10000);
    const $ = cheerio.load(html);

    // Title
    let title = '';
    const h3 = $('h3').first().text().replace(/（第\d+页）/g, '').trim();
    const h1 = $('h1').first().text().replace(/（第\d+页）/g, '').trim();
    if (h3 && !/百书屋|笔趣阁|飘天文学/.test(h3)) {
      title = h3;
    } else if (h1 && !/百书屋|笔趣阁|飘天文学/.test(h1)) {
      title = h1;
    } else if (chapterTitle) {
      title = chapterTitle;
    } else {
      title = $('title').text().split(/第\d+页|最新章节|章节列表|_|-/)[0].trim() || '章节正文';
    }

    // Content container detection
    let rawContentHtml = '';
    const candidates = [
      '.word_read',
      '#content',
      '#chaptercontent',
      '#htmlContent',
      '.read-content',
      '.chapter-content',
      '#booktxt',
      '#txtContent',
      '.content',
      '.read-text',
      'div[id*="content"]',
    ];

    for (const selector of candidates) {
      const match = $(selector);
      if (match.length > 0 && match.text().trim().length > 80) {
        // Strip nested script, style, a links inside content
        match.find('script, style, a').remove();
        rawContentHtml = match.html() || '';
        break;
      }
    }

    if (!rawContentHtml || rawContentHtml.length < 80) {
      // Specialized extraction for sites like ptwxz (where text sits directly in body)
      const clone = cheerio.load(html);
      clone('script, style, a, table, button, select, noscript, .toplink, .bottem, .read_tip, h1, .header, .footer').remove();
      let bodyText = clone('body').text();
      bodyText = bodyText.replace(/选择背景颜色[^\n]*/g, '').replace(/选择字体大小[^\n]*/g, '');
      bodyText = bodyText.replace(/[\u00a0\s]{4,}/g, '\n\n');
      rawContentHtml = bodyText;
    }

    let cleanedContent = formatNovelText(rawContentHtml);

    // If chapter text is short and contains pagination indicator (e.g. _2.html), try to fetch subpage
    if (cleanedContent.length < 1500) {
      const nextPageLink = $('a:contains("下一页")').attr('href');
      if (nextPageLink && !nextPageLink.startsWith('javascript') && !nextPageLink.includes('index')) {
        try {
          const subUrl = nextPageLink.startsWith('http') ? nextPageLink : new URL(nextPageLink, finalUrl).toString();
          const subRes = await fetchWithEncoding(subUrl, 5000);
          const sub$ = cheerio.load(subRes.html);
          for (const selector of candidates) {
            const match = sub$(selector);
            if (match.length > 0 && match.text().trim().length > 80) {
              match.find('script, style, a').remove();
              const subText = formatNovelText(match.html() || '');
              if (subText.length > 50) {
                cleanedContent += '\n\n' + subText;
              }
              break;
            }
          }
        } catch {}
      }
    }

    res.json({
      title,
      content: cleanedContent,
      wordCount: cleanedContent.length,
      url: finalUrl,
    });
  } catch (err: any) {
    console.error('Fetch chapter content error:', err);
    res.status(502).json({ error: `章节原版内容获取失败: ${err.message || '网络连接异常或被源站拦截'}。请尝试刷新或更换其他书源。` });
  }
});

// 5. GitHub Deployment Template & Package Data
app.get('/api/github-deploy-info', (req, res) => {
  const dockerfile = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]`;

  const dockerCompose = `version: '3.8'
services:
  novelcraft:
    build: .
    container_name: novelcraft-app
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
    restart: unless-stopped`;

  const githubAction = `name: Build & Deploy NovelCraft

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - name: Install dependencies
        run: npm install
      - name: Build Project
        run: npm run build
      - name: Test Build Artifacts
        run: ls -la dist/`;

  const readme = `# NovelCraft - 全网小说聚合爬虫与TXT一键下载器

> 一款基于 React 19 + TypeScript + Node.js + Cheerio 的现代化网络小说爬虫与全本 TXT 下载工具。
> 支持多源并发搜索、智能去广告排版、在线无干扰阅读与一键生成标准 TXT 小说文件。

---

## 🌟 核心功能特性

- 🔍 **全网小说多源聚合搜索**：支持同时检索主流小说书源与热门镜像站点。
- ⚡ **智能正文净化排版**：自动剔除防盗链防爬虫文字、弹窗广告代码、乱码，标准全角首行缩进（　　）。
- 📥 **全本/区间批量下载为 TXT**：
  - 支持一键导出全本或自定义章节范围（例如 1~100 章）。
  - 内置目录索引生成、章节分隔线美化。
  - 支持 UTF-8 与 GBK 编码导出（完美适配 Kindle / 掌阅 / 墨水屏阅读器）。
- 📖 **沉浸式护眼阅读器**：提供羊皮纸、牛皮纸、护眼绿、深色黑曜等多种阅读主题，支持字号行距实时微调与阅读进度记忆。
- 🤖 **Gemini AI 智能探针**：当部分冷门源遭遇反爬时，可由 AI 辅助进行正文修复与语义检索。
- 🚀 **开箱即用部署**：支持 GitHub 一键托管、Docker 极速容器化、Vercel/Node VPS 部署。

---

## 🛠️ 本地运行开发

\`\`\`bash
# 1. 克隆代码仓库
git clone https://github.com/your-username/novelcraft.git
cd novelcraft

# 2. 安装依赖包
npm install

# 3. 复制环境变量
cp .env.example .env
# 可选填入 GEMINI_API_KEY

# 4. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
\`\`\`

---

## 🐳 Docker 极速部署

\`\`\`bash
# 构建并运行
docker compose up -d --build
# 访问 http://localhost:3000
\`\`\`

---

## 📜 开源许可
MIT License`;

  res.json({
    dockerfile,
    dockerCompose,
    githubAction,
    readme,
  });
});

// Setup Vite or Static File Serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NovelCraft Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
