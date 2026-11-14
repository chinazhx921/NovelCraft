import express from 'express';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { GoogleGenAI } from '@google/genai';
import {
  normalizeCrawlUrl,
  decodeHtmlBuffer,
  formatNovelText,
  extractChapterNumber,
  isCatalogUpgradeLink,
  isLikelyChapterLink,
  isSameSiteHost,
} from './lib/crawlerHelpers.ts';

const app = express();

// Lightweight health endpoint for Cloudflare deployment verification.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'NovelCraft API' });
});
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

// Desktop User-Agent rotation for consistent desktop HTML scraping
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function isBotChallengeHtml(html: string): boolean {
  if (!html) return false;
  return (
    html.includes('Just a moment...') ||
    html.includes('cf-browser-verification') ||
    html.includes('__cf_chl_') ||
    html.includes('Enable JavaScript and cookies to continue')
  );
}

// Helper: Fetch URL with automatic charset detection, Referer, age-gate bypass, and HTTP fallback
async function fetchWithEncoding(
  rawUrl: string,
  timeoutMs = 12000,
  extraInit?: { method?: string; headers?: Record<string, string>; body?: string },
  allowHttpFallback = true
): Promise<{ html: string; finalUrl: string }> {
  const url = normalizeCrawlUrl(rawUrl) || rawUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let origin = '';
  try {
    origin = new URL(url).origin + '/';
  } catch {}

  const ua = getRandomUserAgent();

  try {
    const res = await fetch(url, {
      method: extraInit?.method || 'GET',
      body: extraInit?.body,
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        ...(origin ? { Referer: origin } : {}),
        ...(extraInit?.headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      if (res.status === 403 || res.status === 503 || res.status === 520) {
        const errBody = await res.text().catch(() => '');
        if (isBotChallengeHtml(errBody)) {
          throw new Error(`目标站点开启了人机验证防火墙 (HTTP ${res.status})，无法直接抓取`);
        }
      }
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || '';
    const html = decodeHtmlBuffer(buffer, contentType);

    if (isBotChallengeHtml(html)) {
      throw new Error('目标站点返回了人机验证页面，暂不支持直接抓取');
    }

    // Automatic age-verification gate bypass (e.g. age_verify.php?return=...)
    if (
      (res.url.includes('age_verify') || (html.includes('年龄确认') && html.includes('action') && html.includes('yes'))) &&
      !extraInit?.headers?.Cookie
    ) {
      try {
        const verifyRes = await fetch(res.url, {
          method: 'POST',
          headers: {
            'User-Agent': ua,
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: res.url,
          },
          body: `return=${encodeURIComponent(url)}&action=yes`,
          signal: AbortSignal.timeout(Math.min(timeoutMs, 8000)),
        });
        const setCookie = verifyRes.headers.get('set-cookie');
        if (setCookie) {
          const cookiePair = setCookie.split(';')[0];
          return await fetchWithEncoding(
            url,
            timeoutMs,
            {
              ...extraInit,
              headers: {
                ...(extraInit?.headers || {}),
                Cookie: cookiePair,
              },
            },
            false
          );
        }
      } catch {}
    }

    return { html, finalUrl: res.url };
  } catch (err: any) {
    clearTimeout(timer);
    // Fallback from https:// to http:// if TLS certificate failed
    if (allowHttpFallback && url.startsWith('https://')) {
      const causeMsg = `${err?.message || ''} ${err?.cause?.message || ''} ${err?.cause?.code || ''}`.toLowerCase();
      if (
        causeMsg.includes('certificate') ||
        causeMsg.includes('ssl') ||
        causeMsg.includes('tls') ||
        causeMsg.includes('fetch failed')
      ) {
        try {
          return await fetchWithEncoding(url.replace(/^https:\/\//i, 'http://'), timeoutMs, extraInit, false);
        } catch {}
      }
    }
    throw err;
  }
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
    sourceUrl: 'https://www.baishuwu.com/info/188122/',
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
    sourceUrl: 'https://www.baishuwu.com/info/15713/',
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
    sourceUrl: 'https://www.baishuwu.com/info/18009/',
  },
];

// Direct Ethical & Urban Novel Search Sources
async function searchBaishuwu(keyword: string): Promise<any[]> {
  try {
    const { html, finalUrl } = await fetchWithEncoding(
      'https://www.baishuwu.com/search.html',
      7000,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `s=${encodeURIComponent(keyword)}`,
      }
    );
    const $ = cheerio.load(html);
    const byUrl = new Map<string, any>();

    $('.txt-list li').each((_, el) => {
      const $li = $(el);
      const titleA = $li.find('.s2 a').first();
      const href = titleA.attr('href') || '';
      const title = titleA.text().trim();
      if (!title || !href.includes('/info/')) return;

      const catalogUrl = href.startsWith('http') ? href : new URL(href, finalUrl).toString();
      const rawAuthor3 = $li.find('.s3').text().trim();
      const rawAuthor5 = $li.find('.s5').text().trim();
      const author =
        (rawAuthor3 && !rawAuthor3.includes('{?') ? rawAuthor3 : '') ||
        (rawAuthor5 && !/^\d{2}-\d{2}$/.test(rawAuthor5) ? rawAuthor5 : '') ||
        '网络作家';
      const latest = $li.find('.s4 a').text().trim();

      const existing = byUrl.get(catalogUrl);
      if (!existing || (latest && existing.latestChapter === '点击查看章节目录')) {
        byUrl.set(catalogUrl, {
          id: 'bsw-' + Math.random().toString(36).substring(2, 9),
          title,
          author,
          category: '都市伦理 / 典藏',
          status: '完结/连载',
          wordCount: '百书屋全本',
          cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
          intro: `百书屋实时收录《${title}》，作者：${author}${latest ? `，最新章节：${latest}` : ''}`,
          latestChapter: latest || '点击查看章节目录',
          sourceName: '百书屋源',
          sourceUrl: catalogUrl,
        });
      }
    });

    return Array.from(byUrl.values()).slice(0, 10);
  } catch (err: any) {
    console.log('Search baishuwu notice:', err.message);
    return [];
  }
}

async function searchYunshuzhai(keyword: string): Promise<any[]> {
  try {
    const searchUrl = `https://yunshuzhai.com/search/result.html?searchkey=${encodeURIComponent(keyword)}`;
    const { html, finalUrl } = await fetchWithEncoding(searchUrl, 7000);
    const $ = cheerio.load(html);
    const results: any[] = [];

    $('tr').each((_, el) => {
      const tds = $(el).find('td');
      if (tds.length < 4) return;
      const category = tds.eq(0).text().trim() || '都市伦理';
      const titleA = tds.eq(1).find('a').first();
      const title = titleA.text().trim();
      const href = titleA.attr('href') || '';
      const latest = tds.eq(2).find('a').first().text().trim();
      const author = tds.eq(3).text().trim() || '网络作家';

      if (!title || !href.includes('/book/')) return;
      const baseBookUrl = href.startsWith('http') ? href : new URL(href, finalUrl).toString();
      const catalogUrl = baseBookUrl.replace(/\/$/, '') + '/list/';

      results.push({
        id: 'ysz-' + Math.random().toString(36).substring(2, 9),
        title,
        author,
        category,
        status: '全本/连载',
        wordCount: '云书斋源',
        cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&q=80',
        intro: `云书斋实时收录《${title}》，作者：${author}${latest ? `，最新：${latest}` : ''}`,
        latestChapter: latest || '点击查看章节目录',
        sourceName: '云书斋源',
        sourceUrl: catalogUrl,
      });
    });

    return results.slice(0, 10);
  } catch (err: any) {
    console.log('Search yunshuzhai notice:', err.message);
    return [];
  }
}

async function searchDiyizhan(keyword: string): Promise<any[]> {
  try {
    const { html, finalUrl } = await fetchWithEncoding(
      'https://www.diyizhan.org/search/',
      7000,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `searchtype=articlename&searchkey=${encodeURIComponent(keyword)}`,
      }
    );
    const $ = cheerio.load(html);
    const results: any[] = [];
    const seen = new Set<string>();

    $('a[href*="/book/"]').each((_, el) => {
      if (results.length >= 10) return;
      const href = $(el).attr('href') || '';
      const match = href.match(/\/book\/(\d+)\.html$/);
      if (!match) return;
      const title = $(el).text().trim();
      if (!title || title.length < 2) return;
      const catalogUrl = new URL(`/index/${match[1]}/`, finalUrl).toString();
      if (seen.has(catalogUrl)) return;
      seen.add(catalogUrl);

      const containerText = $(el).closest('li, tr, div').text().replace(/\s+/g, ' ').trim();
      const authorMatch = containerText.match(/作者[：:]\s*([^\s/]+)/);

      results.push({
        id: 'dyz-' + match[1],
        title,
        author: authorMatch?.[1] || '网络作家',
        category: '伦理 / 热门连载',
        status: '连载/完结',
        wordCount: '第一站源',
        cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
        intro: `第一站实时收录《${title}》完整目录与原版正文`,
        latestChapter: '点击查看章节目录',
        sourceName: '第一站书源',
        sourceUrl: catalogUrl,
      });
    });

    return results;
  } catch (err: any) {
    console.log('Search diyizhan notice:', err.message);
    return [];
  }
}

async function searchKyankanshu(keyword: string): Promise<any[]> {
  try {
    const searchUrl = `https://www.kyankanshu.com/search/?keyword=${encodeURIComponent(keyword)}`;
    const { html, finalUrl } = await fetchWithEncoding(searchUrl, 7000);
    const $ = cheerio.load(html);
    const results: any[] = [];
    const seen = new Set<string>();

    $('a[href*="/info/"]').each((_, el) => {
      if (results.length >= 10) return;
      const href = $(el).attr('href') || '';
      const match = href.match(/\/info\/(\d+)\/?$/);
      if (!match) return;
      const title = $(el).text().trim();
      if (!title || title.length < 2) return;
      const catalogUrl = new URL(`/info/${match[1]}_1/`, finalUrl).toString();
      if (seen.has(catalogUrl)) return;
      seen.add(catalogUrl);

      results.push({
        id: 'ky-' + match[1],
        title,
        author: '网络作家',
        category: '经典 / 伦理全本',
        status: '全本/连载',
        wordCount: '快眼书源',
        cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80',
        intro: `快眼看书实时收录《${title}》完整目录`,
        latestChapter: '点击查看章节目录',
        sourceName: '快眼书源',
        sourceUrl: catalogUrl,
      });
    });

    return results;
  } catch (err: any) {
    console.log('Search kyankanshu notice:', err.message);
    return [];
  }
}

// Universal Web Novel Search Crawler via Search Engine (For niche or long-tail novels)
async function searchWebNovels(keyword: string): Promise<any[]> {
  try {
    const cleanQ = keyword.replace(/[《》]/g, '').trim();
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQ + ' 小说 章节列表 目录')}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: any[] = [];

    // Filter out paywall / Cloudflare-Turnstile / dead domains that fail direct crawling
    const BLOCKED_DOMAINS = /google\.com|duckduckgo\.com|qidian\.com|chuangshi\.qq\.com|faloo\.com|jjwxc\.net|zongheng\.com|8xsk\.com|haijiaobook\.com|baijie\.boats|xbiquge\.la/i;

    $('.result').each((_, el) => {
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

      if (!targetUrl || BLOCKED_DOMAINS.test(targetUrl)) return;

      let cleanTitle = titleRaw.split(/最新章节|章节列表|目录|全文免费阅读|_|--/)[0].replace(/[《》]/g, '').trim();
      if (!cleanTitle) cleanTitle = cleanQ;

      if (
        /baishuwu|yunshuzhai|diyizhan|kyankanshu|kkddkk|kanxiaoshuo|axikin|yzwpo|lushuwu|biquge|piaotia|ptwxz|8tsw|69shu|youziks|yushuwu|shushuwu/i.test(targetUrl) ||
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

    const aExact = aTitle === q;
    const bExact = bTitle === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aStarts = aTitle.startsWith(q);
    const bStarts = bTitle.startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

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
      { id: 'aggregate', name: '全网聚合检索', desc: '并发检索全网各大主流小说书源与伦理典藏源', enabled: true },
      { id: 'ethic', name: '伦理/百书屋', desc: '百书屋、云书斋、第一站、快眼等伦理与都市经典全本源', enabled: true },
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

  // Direct URL support: accept http(s):// or bare domain URLs (e.g. www.baishuwu.com/info/188122/)
  let normalizedDirectUrl = '';
  if (
    /^https?:\/\//i.test(query) ||
    /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(query)
  ) {
    try {
      normalizedDirectUrl = normalizeCrawlUrl(query);
    } catch {}
  }

  if (normalizedDirectUrl) {
    try {
      const { html, finalUrl } = await fetchWithEncoding(normalizedDirectUrl, 8000);
      const $ = cheerio.load(html);
      const pageTitle = $('h1').first().text().trim() || $('title').text().split(/_|-|最新章节|章节列表/)[0].trim() || '网络小说/文章';
      const pageAuthor = $('.author, .writer').first().text().replace(/作者[：:]/g, '').trim() || '网络源';

      return res.json({
        books: [
          {
            id: 'direct-' + Math.random().toString(36).substring(2, 9),
            title: pageTitle,
            author: pageAuthor,
            category: '网络网址直转',
            status: '在线解析',
            wordCount: '网页直连',
            cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
            intro: `已探测解析网络链接：${finalUrl}，点击即可立即进入纯净阅读模式或提取完整全书。`,
            latestChapter: '点击进入阅读/解析目录',
            sourceName: '单链直转阅读',
            sourceUrl: finalUrl,
            isDirectUrl: true,
          },
        ],
        count: 1,
        isPreset: false,
      });
    } catch {
      return res.json({
        books: [
          {
            id: 'direct-' + Math.random().toString(36).substring(2, 9),
            title: '自定义网络小说链接',
            author: '网络源',
            category: '网络网址直转',
            status: '待解析',
            wordCount: '点击解析',
            cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
            intro: `目标网址：${normalizedDirectUrl}，点击进入阅读或提取章节。`,
            latestChapter: '点击进入',
            sourceName: '单链直转',
            sourceUrl: normalizedDirectUrl,
            isDirectUrl: true,
          },
        ],
        count: 1,
        isPreset: false,
      });
    }
  }

  const cleanQ = query.replace(/(小说|全集|最新|无删减|完结|txt|TXT|全文|目录)/g, '').replace(/[《》]/g, '').trim() || query;

  // Local preset exact matches
  const localMatches = TRENDING_BOOKS.filter(
    b => b.title.toLowerCase().includes(cleanQ.toLowerCase()) || 
         cleanQ.toLowerCase().includes(b.title.toLowerCase()) ||
         b.author.toLowerCase().includes(cleanQ.toLowerCase())
  );

  let crawledResults: any[] = [];

  // Concurrently scrape direct sources + web search fallback
  try {
    let promises: Promise<any[]>[] = [];
    if (source === 'ptwxz') {
      promises = [searchPtwxz(cleanQ)];
    } else if (source === 'bqg') {
      promises = [searchBiquge(cleanQ)];
    } else if (source === 'ethic') {
      promises = [
        searchBaishuwu(cleanQ),
        searchYunshuzhai(cleanQ),
        searchDiyizhan(cleanQ),
        searchKyankanshu(cleanQ),
      ];
    } else {
      promises = [
        searchBaishuwu(cleanQ),
        searchYunshuzhai(cleanQ),
        searchDiyizhan(cleanQ),
        searchKyankanshu(cleanQ),
        searchPtwxz(cleanQ),
        searchBiquge(cleanQ),
      ];
    }

    const settled = await Promise.allSettled(promises);
    for (const s of settled) {
      if (s.status === 'fulfilled' && Array.isArray(s.value)) {
        crawledResults.push(...s.value);
      }
    }

    // Invoke universal web search if direct sources returned fewer than 3 results
    if (crawledResults.length < 3) {
      const webResults = await searchWebNovels(cleanQ);
      crawledResults.push(...webResults);
    }
  } catch (err: any) {
    console.log('Search aggregation notice:', err.message);
  }

  // Combine and deduplicate by sourceUrl (so same book from different working sources remains selectable!)
  const combined = [...localMatches, ...crawledResults];
  const uniqueMap = new Map();
  combined.forEach(b => {
    const key = `${(b.sourceUrl || '').trim() || `${b.title.trim()}-${b.author.trim()}`}`;
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

// 3. Get Book Catalog & Chapters (By URL or ID) with Full Pagination & Numerical Ordering
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
    targetUrl = normalizeCrawlUrl(targetUrl);

    // Normalization for ptwxz
    if (targetUrl.includes('/bookinfo/')) {
      targetUrl = targetUrl.replace('/bookinfo/', '/html/').replace('.html', '/index.html');
    }

    const initialRes = await fetchWithEncoding(targetUrl, 10000);
    const originalFinalUrl = initialRes.finalUrl;
    let { html, finalUrl } = initialRes;
    let $ = cheerio.load(html);

    // Check if current page is a book-info / single-chapter page with an explicit TOC / all-chapters link
    let catalogUpgradeUrl = '';
    $('a').each((_, el) => {
      if (catalogUpgradeUrl) return;
      const txt = $(el).text().trim();
      const href = $(el).attr('href') || '';
      if (isCatalogUpgradeLink(txt, href, finalUrl)) {
        try {
          catalogUpgradeUrl = new URL(href, finalUrl).toString();
        } catch {}
      }
    });

    if (catalogUpgradeUrl && catalogUpgradeUrl !== finalUrl) {
      try {
        const catRes = await fetchWithEncoding(catalogUpgradeUrl, 10000);
        if (catRes.html && catRes.html.length > 500) {
          html = catRes.html;
          finalUrl = catRes.finalUrl;
          $ = cheerio.load(html);
        }
      } catch {}
    }

    // Extract book title
    const title = $('h1').first().text().replace(/百书屋|看小说网/g, '').replace(/作者[：:].*/g, '').replace(/[《》]/g, '').trim() ||
                  $('.book-name, .info h1, .title, meta[property="og:novel:book_name"]').attr('content') ||
                  $('title').text().split(/最新章节|章节列表|章节目录|无弹窗|,|_|-/)[0].replace(/[《》]/g, '').trim() ||
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

    // -------------------------------------------------------------
    // Full Catalog Discovery Across Pagination Pages
    // -------------------------------------------------------------
    const catalogPageUrls = new Set<string>();
    catalogPageUrls.add(finalUrl);

    // Follow pagination links (下一页, 更多目录, select options, .pages)
    $('a').each((_, el) => {
      const txt = $(el).text().trim();
      const href = $(el).attr('href');
      if (!href || href.startsWith('javascript') || href === '#') return;
      if (/^(查看更多章节|下一页|下页|更多目录|全部目录|完整目录|第\s*\d+\s*页)$/i.test(txt)) {
        try {
          const resolved = new URL(href, finalUrl).toString();
          if (isSameSiteHost(resolved, finalUrl)) catalogPageUrls.add(resolved);
        } catch {}
      }
    });

    $('select option').each((_, opt) => {
      const val = $(opt).attr('value');
      const txt = $(opt).text().trim();
      if (val && !val.startsWith('javascript') && (val.includes('/info/') || val.includes('/book/') || val.includes('/html/') || /\d+/.test(val) || /第\s*\d+\s*页/.test(txt))) {
        try {
          const resolved = new URL(val, finalUrl).toString();
          if (isSameSiteHost(resolved, finalUrl)) catalogPageUrls.add(resolved);
        } catch {}
      }
    });

    $('.pages a, .page a, .pagination a, #pagelist a, .listpage a, .page-box a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('javascript') && href !== '#') {
        try {
          const resolved = new URL(href, finalUrl).toString();
          if (isSameSiteHost(resolved, finalUrl)) catalogPageUrls.add(resolved);
        } catch {}
      }
    });

    // Baishuwu fallback pagination only if DOM didn't expose multiple pages
    const bswMatch = finalUrl.match(/baishuwu\.com\/info\/(\d+)/);
    if (bswMatch && catalogPageUrls.size <= 1) {
      const bswId = bswMatch[1];
      catalogPageUrls.add(`https://www.baishuwu.com/info/${bswId}/`);
      for (let p = 1; p <= 6; p++) {
        catalogPageUrls.add(`https://www.baishuwu.com/info/${bswId}/${p}/`);
      }
    }

    // Fetch up to 10 catalog pages concurrently (respects Cloudflare Workers subrequest budget)
    const pagesToFetch = Array.from(catalogPageUrls).slice(0, 10);
    const catalogHtmlList: { html: string; pageUrl: string }[] = [{ html, pageUrl: finalUrl }];

    if (pagesToFetch.length > 1) {
      const otherPages = pagesToFetch.filter(p => p !== finalUrl);
      const settledPages = await Promise.allSettled(
        otherPages.map(pageUrl => fetchWithEncoding(pageUrl, 8000))
      );
      for (const res of settledPages) {
        if (res.status === 'fulfilled' && res.value.html) {
          catalogHtmlList.push({ html: res.value.html, pageUrl: res.value.finalUrl });
        }
      }
    }

    // -------------------------------------------------------------
    // Extract & Merge Chapters From All Catalog Pages
    // -------------------------------------------------------------
    interface ChapterRawItem {
      title: string;
      url: string;
      chapterNumber: number;
      pageOrder: number;
    }

    const uniqueChapterMap = new Map<string, ChapterRawItem>();
    let orderCounter = 0;

    for (const { html: pageHtml, pageUrl } of catalogHtmlList) {
      const page$ = cheerio.load(pageHtml);
      const catalogContainers = page$(
        '#list, .listmain, .centent, .book-list, #chapters, .catalog, .chapter-list, .chapter-list-box, .book_chapter, .volume, .chapterlist, dl, .layout-col1, .section-list, .grid, .mulu, ul.chapter, #chapterlist'
      );
      const inContainer = catalogContainers.length > 0;
      const targetScope = inContainer ? catalogContainers : page$('body');

      targetScope.find('a').each((_, el) => {
        const $a = page$(el);
        const chHref = $a.attr('href');
        if (!chHref || chHref.startsWith('javascript') || chHref === '#') return;

        let fullUrl = '';
        try {
          fullUrl = chHref.startsWith('http') ? chHref : new URL(chHref, pageUrl).toString();
        } catch {
          return;
        }

        if (catalogPageUrls.has(fullUrl)) return;

        let chTitle = $a.text().replace(/\s+/g, ' ').trim() || ($a.attr('title') || '').trim();
        // Handle sites like yunshuzhai where chapter <a> text is empty or placeholder "（）"
        if (!chTitle || chTitle === '（）' || chTitle === '()') {
          if (inContainer && /\/\d+(?:\.html)?$/i.test(fullUrl)) {
            const numMatch = fullUrl.match(/\/(\d+)(?:\.html)?$/i);
            chTitle = numMatch ? `第${numMatch[1]}章` : `第${orderCounter + 1}章`;
          } else {
            return;
          }
        }

        if (!isLikelyChapterLink(fullUrl, pageUrl, chTitle, inContainer)) return;

        if (!uniqueChapterMap.has(fullUrl)) {
          const chNum = extractChapterNumber(chTitle);
          uniqueChapterMap.set(fullUrl, {
            title: chTitle,
            url: fullUrl,
            chapterNumber: chNum,
            pageOrder: orderCounter++,
          });
        }
      });
    }

    // Convert map to list
    const rawChapters = Array.from(uniqueChapterMap.values());

    // Sort chapters numerically if chapter numbers are present
    const hasValidNumbers = rawChapters.filter(c => c.chapterNumber < 999999).length > Math.min(rawChapters.length * 0.4, 5);

    if (hasValidNumbers) {
      rawChapters.sort((a, b) => {
        if (a.chapterNumber !== b.chapterNumber) {
          return a.chapterNumber - b.chapterNumber;
        }
        return a.pageOrder - b.pageOrder;
      });
    } else {
      rawChapters.sort((a, b) => a.pageOrder - b.pageOrder);
    }

    // Re-index sequentially from 1 to N
    const chapters = rawChapters.map((c, index) => ({
      index: index + 1,
      title: c.title,
      url: c.url,
    }));

    // Single-article / single-chapter fallback: keep user's original pasted URL
    if (chapters.length === 0 && html.length > 300) {
      chapters.push({
        index: 1,
        title: title || '第一章 正文',
        url: originalFinalUrl,
      });
    }

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

// 4. Get Chapter Content (With Recursive Subpage Concatenation & Guaranteed Full-Text)
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
    const initialRes = await fetchWithEncoding(targetUrl, 10000);
    let currentUrl = initialRes.finalUrl;
    let currentHtml = initialRes.html;
    let current$ = cheerio.load(currentHtml);

    // Chapter Title
    let title = '';
    const h3 = current$('h3').first().text().replace(/（第\d+页）|\(\d+\/\d+\)/g, '').trim();
    const h1 = current$('h1').first().text().replace(/（第\d+页）|\(\d+\/\d+\)/g, '').trim();
    if (h3 && !/百书屋|笔趣阁|飘天文学/.test(h3)) {
      title = h3;
    } else if (h1 && !/百书屋|笔趣阁|飘天文学/.test(h1)) {
      title = h1;
    } else if (chapterTitle) {
      title = chapterTitle;
    } else {
      title = current$('title').text().split(/第\d+页|最新章节|章节列表|_|-/)[0].trim() || '章节正文';
    }

    const candidates = [
      'article.reading-container',
      '.reading-container',
      '#nr1',
      '.showtxt',
      '#content',
      '#chaptercontent',
      '#BookText',
      '.txtnav',
      '.readmain',
      '.chapter_content',
      '.read-content',
      '.chapter-content',
      '[itemprop="articleBody"]',
      'article',
      '.word_read',
      '#htmlContent',
      '#booktxt',
      '#txtContent',
      '.read-text',
      'div[id*="content"]',
      '.content',
    ];

    // Helper: Extract content from HTML string without mutating Cheerio state
    const extractContentText = (htmlStr: string): string => {
      const $ctx = cheerio.load(htmlStr);
      let rawHtml = '';
      for (const selector of candidates) {
        const match = $ctx(selector);
        if (match.length > 0 && match.text().trim().length > 60) {
          match.find('script, style, iframe, button, select, noscript, .read_btn, .ad, .advertisement, .ads, .chapter-nav, .page-nav').remove();
          rawHtml = match.html() || '';
          break;
        }
      }

      if (!rawHtml || rawHtml.length < 60) {
        $ctx('script, style, a, table, button, select, noscript, .toplink, .bottem, .read_tip, h1, h2, h3, .header, .footer, .read_btn').remove();
        let bodyText = $ctx('body').text();
        bodyText = bodyText.replace(/选择背景颜色[^\n]*/g, '').replace(/选择字体大小[^\n]*/g, '');
        bodyText = bodyText.replace(/[\u00a0\s]{4,}/g, '\n\n');
        rawHtml = bodyText;
      }

      return formatNovelText(rawHtml);
    };

    let fullChapterText = extractContentText(currentHtml);
    let subpageCount = 1;
    const visitedUrls = new Set<string>();
    visitedUrls.add(currentUrl);

    // Detect base ID of chapter URL, e.g. 40915659 in /read/188122/40915659.html or 40915659_1.html
    const baseMatch = currentUrl.match(/\/(\d+)(?:_\d+)?\.html/);
    const chapterBaseId = baseMatch ? baseMatch[1] : '';

    // Loop through subpages to stitch complete chapter (up to 15 subpages)
    while (subpageCount < 15) {
      let nextSubpageUrl = '';

      // Primary check: look for href with ${chapterBaseId}_\d+\.html
      current$('a').each((_, el) => {
        if (nextSubpageUrl) return;
        const text = current$(el).text().trim();
        const href = current$(el).attr('href');
        if (!href || href.startsWith('javascript') || href === '#') return;
        if (href.includes('login') || href.includes('register') || href.includes('mybook')) return;

        try {
          const resolved = new URL(href, currentUrl);
          const resolvedUrl = resolved.toString();
          if (visitedUrls.has(resolvedUrl)) return;

          // Condition 1: Pathname matches ${chapterBaseId}_\d+\.html
          if (chapterBaseId && resolved.pathname.includes(chapterBaseId + '_') && resolved.pathname.endsWith('.html')) {
            nextSubpageUrl = resolvedUrl;
            return;
          }

          // Condition 2: Text is "下一页" or "下页"
          if (/下一页|下页/.test(text)) {
            if (chapterBaseId && resolved.pathname.includes(chapterBaseId)) {
              nextSubpageUrl = resolvedUrl;
              return;
            } else if (!chapterBaseId && !/index|info|catalog|list/i.test(resolved.pathname)) {
              nextSubpageUrl = resolvedUrl;
              return;
            }
          }
        } catch {}
      });

      // Secondary regex check on raw HTML if selector missed it
      if (!nextSubpageUrl && chapterBaseId) {
        const subpageRegex = new RegExp(`href=["']([^"']*${chapterBaseId}_\\d+\\.html)["']`, 'i');
        const rawMatch = currentHtml.match(subpageRegex);
        if (rawMatch && rawMatch[1]) {
          try {
            const rawResolved = new URL(rawMatch[1], currentUrl).toString();
            if (!visitedUrls.has(rawResolved)) {
              nextSubpageUrl = rawResolved;
            }
          } catch {}
        }
      }

      if (!nextSubpageUrl || visitedUrls.has(nextSubpageUrl)) {
        break; // No further subpages
      }

      visitedUrls.add(nextSubpageUrl);

      try {
        const subRes = await fetchWithEncoding(nextSubpageUrl, 6000);
        currentUrl = subRes.finalUrl;
        currentHtml = subRes.html;
        current$ = cheerio.load(currentHtml);

        const subText = extractContentText(currentHtml);
        if (subText.length > 30) {
          fullChapterText += '\n\n' + subText;
          subpageCount++;
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    // Final clean up of watermarks and pagination notices
    fullChapterText = fullChapterText
      .replace(/（本章未完，请点击下一页继续阅读）/g, '')
      .replace(/本章未完，点击下一页继续阅读/g, '')
      .replace(/请点击下一页继续阅读/g, '')
      .replace(/一秒记住.*免费阅读！/g, '')
      .trim();

    res.json({
      title,
      content: fullChapterText,
      wordCount: fullChapterText.length,
      subpageCount,
      url: initialRes.finalUrl,
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

// The Express app is exported for both the local Node.js server and Cloudflare Workers.
export default app;
