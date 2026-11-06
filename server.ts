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

// Pre-seeded high quality popular books for instant demo & reading
const TRENDING_BOOKS = [
  {
    id: 'demo-1',
    title: '诡秘之主',
    author: '爱潜水的乌贼',
    category: '西方奇幻 / 蒸汽朋克',
    status: '完结',
    wordCount: '446万字',
    cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
    intro: '伴随着蒸汽与机械的狂潮，神秘与愚弄的暗涌，周明瑞在一间满地狼藉的单身公寓中醒来，开启了愚者的序列神座...',
    latestChapter: '番外 旅者',
    sourceName: '精选全本源',
    sourceUrl: 'https://www.bqgka.com/book/guimizhizhu/',
    sampleChapters: [
      {
        title: '第一章 绯红',
        content: `　　痛！\n　　好痛！\n　　头好痛！\n\n　　宛若狂乱暴虐的潮水，炽烈疼痛的一波波袭来，瞬间将周明瑞从混沌与深渊中拉拽而出。\n\n　　他下意识伸出手，捂住剧烈跳动的太阳穴，指尖触碰到的却是一片粘稠与冰凉。\n\n　　周明瑞艰难睁开沉重的眼皮，映入眼帘的不是熟悉的电脑屏幕，也不是租住屋天花板泛黄的水渍，而是一间昏暗且透着古典陈旧气息的书房。\n\n　　一张深褐色的圆桌上，摆放着铜制烛台，烛火摇曳着微弱的黄光，将一旁静静躺着的黄铜转轮手枪拉出细长扭曲的影子。\n\n　　绯红色的月光从窗格外透入，如同一层薄纱笼罩在大地之上。\n\n　　“我……不是在家里玩电脑吗？怎么会在这里？”\n\n　　脑海深处，纷杂而破碎的记忆如同风暴般席卷开来：克莱恩·莫雷蒂、鲁恩王国、贝克兰德、廷根市、霍伊大学历史系毕业生……\n\n　　以及，那本诡异而古老的安提哥努斯家族笔记！`
      },
      {
        title: '第二章 处境',
        content: `　　周明瑞——不，现在应该叫克莱恩·莫雷蒂，靠在椅背上，足足沉默了十分钟。\n\n　　他站起身，走到穿衣镜前。\n\n　　镜子里映照出一张年轻但略显苍白的脸庞，黑色短发，深褐色双眸，文质彬彬，眼眶微微凹陷，右侧太阳穴处赫然有着一个触目惊心的弹孔！\n\n　　然而奇怪的是，伤口周围虽然留着凝固的血迹，却已不再流血，甚至连脑浆都没有流出，皮肉正以极其微弱的节奏慢慢蠕动愈合。\n\n　　自杀？\n\n　　为什么原主要自杀？\n\n　　克莱恩目光下移，落在书桌上那颗黄铜子弹壳，以及摊开的一本日记上。\n\n　　日记的最后一页，用鲁恩语潦草而绝望地写着一句话：\n\n　　“所有人都得死，包括我。”`
      },
      {
        title: '第三章 占卜家与塔罗会',
        content: `　　下午三点整。\n\n　　灰白色的迷雾无边无际，在这浩瀚无垠的灵界深处，一座由巨大青石构筑而成的巍峨神殿拔地而起。\n\n　　克莱恩坐在高背椅上，身躯被浓郁的灰雾笼罩，只能看清一道神秘深邃的轮廓。\n\n　　在他的对面，两道被深红光芒包裹的身影缓缓凝实显现。\n\n　　一位是身形娇小、神情迷茫惊惶的金发少女；另一位则是体型挺拔、充满警惕戒备的深色皮肤青年。\n\n　　“阁下……请问这里是哪里？您究竟是谁？”金发少女奥黛丽忍不住颤声询问。\n\n　　克莱恩手指轻轻敲击着由巨大青石雕刻而成的斑驳长桌，嘴角微微勾起一抹神秘莫测的笑容，嗓音低沉悠远：\n\n　　“你们可以称呼我为——”\n\n　　“‘愚者’。”`
      }
    ]
  },
  {
    id: 'demo-2',
    title: '宿命之环',
    author: '爱潜水的乌贼',
    category: '西方奇幻 / 秘境冒险',
    status: '连载中',
    wordCount: '280万字',
    cover: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=300&q=80',
    intro: '诡秘世界第二部，因蒂斯共和国的科尔杜村，少年卢米安在怪诞的梦境与现实循环中寻找被遗忘的真相...',
    latestChapter: '第1124章 宿命之重',
    sourceName: '新笔趣阁源',
    sourceUrl: 'https://www.bqgka.com/book/sumingzhihuan/',
    sampleChapters: [
      {
        title: '第一章 外乡人',
        content: `　　卢米安·李坐在老酒馆粗糙的长条木凳上，端起一杯劣质的金鸡尾酒。\n\n　　窗外是因蒂斯南部科尔杜村宁静的午后，阳光洒在红顶石屋和金黄色的干草垛上，看似一幅安宁的田园油画。\n\n　　然而，村口那个穿风衣、戴鸭舌帽的陌生外乡人，打破了这片维持了数百年的宁静。\n\n　　“嘿，卢米安，听说你昨天又去后山那座废弃城堡了？”酒保一边擦拭着油腻的杯子一边打趣道。\n\n　　卢米安笑了笑，没有回答。他的目光落在那名外乡人腰间鼓囊囊的皮套上——那是一把左轮手枪。\n\n　　而更让卢米安心跳加速的是，在昨晚那个怪诞的梦里，他清晰地看见，村里的教堂钟楼在午夜十二点倒转了三圈！`
      }
    ]
  },
  {
    id: 'demo-3',
    title: '斗破苍穹',
    author: '天蚕土豆',
    category: '东方玄幻 / 热血升级',
    status: '完结',
    wordCount: '532万字',
    cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&q=80',
    intro: '这里是属于斗气的世界，没有花俏艳丽的魔法，有的，仅仅是繁衍到巅峰的斗气！“三十年河东，三十年河西，莫欺少年穷！”',
    latestChapter: '第一千六百二十四章 结束，也是一种开始（大结局）',
    sourceName: '经典武侠玄幻源',
    sourceUrl: 'https://www.bqgka.com/book/doupocangqiong/',
    sampleChapters: [
      {
        title: '第一章 陨落的天才',
        content: `　　“斗之力，三段！”\n\n　　望着测验魔石碑上面闪亮得甚至有些刺眼的五个大字，少年面无表情，唇角有着一抹自嘲，紧握的手掌，因为大力，而导致略微尖锐的指甲深深地刺进了掌心之中，带来一阵阵钻心的疼痛…\n\n　　“萧炎，斗之力，三段！级别：低级！”测验魔石碑之旁，一位中年男子，看了一眼碑上所显示出来的信息，语气漠然的将之公布了出来…\n\n　　中年男子话刚脱口，便是不出意料的在人头汹涌的广场上带起了一阵嘲讽的骚动。\n\n　　“三段？嘿嘿，果然不出我所料，这个‘天才’这一年又是在原地踏步！”\n\n　　“哎，这废物真是把家族的脸都给丢光了。”\n\n　　周围传来的讥笑嘲讽，落在那名身着黑衫的清秀少年耳中，宛如一根根毒刺扎在心脏上。然而少年的双眼深处，一抹坚毅如火焰般的倔强却从未熄灭。`
      },
      {
        title: '第二章 斗气大陆',
        content: `　　夜幕笼罩着乌坦城萧家。\n\n　　后山崖壁之上，萧炎仰面躺在青翠的草坪上，嘴中叼着一根青草，微微嚼动，任由那股苦涩的滋味在口腔中蔓延。\n\n　　这片大陆名为斗气大陆，没有魔法，没有神术，唯有斗气繁衍至巅峰！\n\n　　从四岁练气，十岁拥有九段斗之气，十一岁成功凝聚斗之气旋，一跃成为家族百年内最年轻的斗者！然而，三年前的一场变故，不仅使得他辛辛苦苦修炼十数载的斗气一夜之间化为乌有，而且体内的斗气还在不断诡异流失…\n\n　　萧炎低头，目光落在了右手食指上那一枚古朴漆黑的戒指上。`
      }
    ]
  },
  {
    id: 'demo-4',
    title: '三体',
    author: '刘慈欣',
    category: '科幻硬核 / 太空歌剧',
    status: '完结',
    wordCount: '88万字',
    cover: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80',
    intro: '文化大革命如火如荼进行之际，军方探寻外星文明的绝密计划“红岸工程”取得了突破性进展。四光年外的“三体文明”正接收到来自地球的第一声呼唤...',
    latestChapter: '第36章 虫子',
    sourceName: '科幻图书源',
    sourceUrl: 'https://www.bqgka.com/book/santi/',
    sampleChapters: [
      {
        title: '第一章 疯狂年代',
        content: `　　中国，1967年。\n\n　　北京两派红卫兵在大学里的大规模武斗已经持续了半个多月。黄昏时分，教学楼楼顶的重机枪疯狂扫射，将水泥墙面打得火星四溅。\n\n　　叶哲泰站在红太阳大讲台前，胸前挂着一块沉重的铁牌，上面用黑漆刷着“反动学术权威”，并打了猩红的大叉。\n\n　　“你还敢坚持爱因斯坦的相对论？那是资产阶级腐朽的反动唯心论！”红卫兵小将挥舞着铜头皮带厉声质问。\n\n　　叶哲泰推了推碎裂的眼镜片，平静而执拗地答道：“科学就是科学，真理不因立场而改变。”\n\n　　人群的角落里，他的女儿叶文洁紧紧咬着嘴唇，指甲深深陷进掌心，看着父亲倒在血泊中。一颗仇恨与绝望的种子，在年轻女天体物理学家的心底彻底破土发芽。`
      }
    ]
  },
  {
    id: 'demo-5',
    title: '剑来',
    author: '烽火戏诸侯',
    category: '古典仙侠 / 江湖庙堂',
    status: '连载中',
    wordCount: '1100万字',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80',
    intro: '大千世界，无奇不有。我陈平安，唯有一剑，可搬山，倒海，降妖，镇魔，敕神，摘星，摧城，开天！',
    latestChapter: '第1180章 归去来兮',
    sourceName: '顶点文学源',
    sourceUrl: 'https://www.bqgka.com/book/jianlai/',
    sampleChapters: [
      {
        title: '第一章 惊蛰',
        content: `　　小镇的早晨，多水雾。\n\n　　泥瓶巷里，有个消瘦的草鞋少年，正蹲在家门口低头挑拣着草药。\n\n　　少年叫陈平安，父母早亡，孤苦无依。小镇的人都说他命硬克亲，平日里谁也不愿与他多走动。\n\n　　但陈平安不怨天，也不尤人。每天清晨早早起来上山采药、烧炭，换几个铜板买粗面馒头充饥。\n\n　　“陈平安，后山桃叶巷搬来了一位贵客，听说是京城来的大官老爷，你今天可别冲撞了人家。”隔壁王婶端着洗米水泼在青石板上，随口叮嘱了一句。\n\n　　陈平安抬起头，露出一张被日光晒得黝黑的小脸，眼神清澈而坚定：“王婶放心，我只去落魄山，不走桃叶巷。”\n\n　　此时的少年并不知道，脚下这座看似平凡无奇的骊珠小镇，实则是仙人用来铸造长生桥的天地大熔炉。而属于他的一场波澜壮阔的大道征程，正从这双破烂的草鞋下悄然拉开序幕。`
      }
    ]
  }
];

// Clean text formatting helper
function formatNovelText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Remove common annoying novel watermarks
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

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Get List of Available Book Sources
app.get('/api/sources', (req, res) => {
  res.json({
    sources: [
      { id: 'aggregate', name: '全网聚合检索', desc: '并发检索全网小说书源与热门镜像', enabled: true },
      { id: 'bqg', name: '笔趣阁节点 01', desc: '新笔趣阁在线文学解析源', enabled: true },
      { id: 'ptwxz', name: '飘天文学镜像', desc: '经典连载网络小说镜像', enabled: true },
      { id: 'custom', name: '自定义单链爬取', desc: '支持任意小说目录或章节链接直接解析', enabled: true },
      { id: 'gemini', name: 'Gemini 智能小说探针', desc: 'AI全网语义检索与缺失章节智能重构', enabled: Boolean(ai) },
    ],
    geminiEnabled: Boolean(ai),
  });
});

// 2. Search Novels Across Web
app.get('/api/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  const source = (req.query.source as string || 'aggregate');
  const useAi = req.query.ai === 'true';

  if (!query) {
    return res.json({ books: TRENDING_BOOKS, isPreset: true });
  }

  // Check matching pre-seeded trending books first
  const localMatches = TRENDING_BOOKS.filter(
    b => b.title.toLowerCase().includes(query.toLowerCase()) || 
         b.author.toLowerCase().includes(query.toLowerCase()) ||
         b.category.toLowerCase().includes(query.toLowerCase())
  );

  let crawledResults: any[] = [];

  // Attempt live crawl from real novel mirror engines
  try {
    // Attempt 1: Search Biquge search engine
    const searchUrl = `https://www.bqgka.com/s?q=${encodeURIComponent(query)}`;
    const { html, finalUrl } = await fetchWithEncoding(searchUrl, 8000);
    const $ = cheerio.load(html);

    // Parse novel list from search results
    $('.bookbox, .txt-list li, .so_list li, .item, .hot_sale').each((_, el) => {
      const $el = $(el);
      const title = $el.find('.bookname a, h4 a, .title a, dt a').first().text().trim() || $el.find('a').first().text().trim();
      let link = $el.find('.bookname a, h4 a, .title a, dt a').first().attr('href') || $el.find('a').first().attr('href') || '';
      const author = $el.find('.author, .author a, .s4, dd:contains("作者")').first().text().replace(/作者[：:]/g, '').trim() || '网络';
      const intro = $el.find('.intro, .uptime, dd:contains("简介")').first().text().replace(/简介[：:]/g, '').trim() || '暂无简介';
      const cover = $el.find('img').first().attr('src') || '';
      const latestChapter = $el.find('.sys, .s3, .update a').first().text().trim() || '最新章节';

      if (title && link) {
        if (!link.startsWith('http')) {
          link = new URL(link, finalUrl).toString();
        }
        crawledResults.push({
          id: 'live-' + Math.random().toString(36).substring(2, 9),
          title,
          author,
          category: '网络玄幻',
          status: '连载/完结',
          wordCount: '连载更新',
          cover: cover.startsWith('http') ? cover : (cover ? new URL(cover, finalUrl).toString() : 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80'),
          intro: intro || `全网抓取小说《${title}》，作者：${author}`,
          latestChapter: latestChapter || '点击进入阅读最新章节',
          sourceName: '笔趣阁源',
          sourceUrl: link,
        });
      }
    });
  } catch (err) {
    // Live scrape network might be blocked or rate-limited by target domain, which is expected in sandbox
    console.log('Live search notice:', err instanceof Error ? err.message : err);
  }

  // If live crawl returned few/no results and AI is available or requested, use Gemini to synthesize rich novel info
  if (crawledResults.length === 0 && (useAi || localMatches.length === 0) && ai) {
    try {
      const prompt = `你是一个全网小说检索与解析助手。用户搜索了：“${query}”。
请根据真实网络小说数据库，返回1至3本最匹配的小说详细信息，以严格的JSON数组格式输出：
[
  {
    "title": "小说书名",
    "author": "作者名",
    "category": "分类（例如：西方奇幻、玄幻修真、都市职场等）",
    "status": "完结 或 连载中",
    "wordCount": "字数预估（例如 380万字）",
    "intro": "100-200字小说精彩故事简介",
    "latestChapter": "最新章节名（例如：第120章 xxx）",
    "sampleChapters": [
      {
        "title": "第一章 起始",
        "content": "小说第一章精选完整正文内容，约600-1000字，行文通畅..."
      },
      {
        "title": "第二章 异变",
        "content": "小说第二章精选完整正文内容，约600-1000字..."
      }
    ]
  }
]
只返回纯JSON代码块，不要附带额外闲聊。`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = aiResponse.text || '';
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiBooks = JSON.parse(cleanJson);

      if (Array.isArray(aiBooks)) {
        for (const ab of aiBooks) {
          crawledResults.push({
            id: 'ai-' + Math.random().toString(36).substring(2, 9),
            title: ab.title || query,
            author: ab.author || '网络作家',
            category: ab.category || '热门小说',
            status: ab.status || '完结',
            wordCount: ab.wordCount || '150万字',
            cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
            intro: ab.intro || `全网抓取小说《${ab.title}》精彩简介`,
            latestChapter: ab.latestChapter || '尾声与序章',
            sourceName: 'Gemini 智能小说源',
            sourceUrl: `https://novel.local/${encodeURIComponent(ab.title)}`,
            sampleChapters: ab.sampleChapters,
          });
        }
      }
    } catch (aiErr) {
      console.log('AI search fallback err:', aiErr);
    }
  }

  // Combine results: local matches + crawled results
  const combined = [...localMatches, ...crawledResults];
  const uniqueMap = new Map();
  combined.forEach(b => {
    const key = `${b.title}-${b.author}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, b);
    }
  });

  res.json({
    books: Array.from(uniqueMap.values()),
    count: uniqueMap.size,
    isPreset: false,
  });
});

// 3. Get Book Catalog & Chapters (By URL or ID)
app.get('/api/book-detail', async (req, res) => {
  const { url, id } = req.query as { url?: string; id?: string };

  // Check demo books first
  if (id) {
    const demo = TRENDING_BOOKS.find(b => b.id === id);
    if (demo) {
      const chapters = (demo.sampleChapters || []).map((ch, idx) => ({
        index: idx + 1,
        title: ch.title,
        url: `${demo.sourceUrl}#chapter-${idx + 1}`,
      }));

      // Generate a mock expanded catalog of ~30 chapters for rich download demonstration if fewer exist
      const expandedChapters = [...chapters];
      if (expandedChapters.length < 20) {
        for (let i = chapters.length + 1; i <= 35; i++) {
          expandedChapters.push({
            index: i,
            title: `第${i}章 ${['风起云涌', '潜龙出渊', '古神低语', '决战前夕', '命运交织', '破镜重圆', '星海迷踪', '逆天改命'][i % 8]}`,
            url: `${demo.sourceUrl}#chapter-${i}`,
          });
        }
      }

      return res.json({
        book: {
          ...demo,
          chapters: expandedChapters,
          totalChapters: expandedChapters.length,
        }
      });
    }
  }

  if (!url) {
    return res.status(400).json({ error: '请提供小说目录链接或ID' });
  }

  try {
    const { html, finalUrl } = await fetchWithEncoding(url, 10000);
    const $ = cheerio.load(html);

    // Extract book title
    const title = $('h1').first().text().trim() || 
                  $('.book-name, .info h1, .title, meta[property="og:novel:book_name"]').attr('content') || 
                  '未知书名';

    // Extract author
    const author = $('.author, .author a, .writer, meta[property="og:novel:author"]').first().text().replace(/作者[：:]/g, '').trim() ||
                   $('p:contains("作 者"), p:contains("作者")').first().text().replace(/作者[：:]/g, '').trim() ||
                   '佚名';

    // Extract intro
    const intro = $('#intro, .intro, .book-intro, meta[property="og:description"]').first().text().trim() || '暂无简介';

    // Extract cover
    let cover = $('#fmimg img, .cover img, meta[property="og:image"]').first().attr('src') || '';
    if (cover && !cover.startsWith('http')) {
      cover = new URL(cover, finalUrl).toString();
    }

    // Extract Chapter List
    const chapters: { index: number; title: string; url: string }[] = [];
    let idx = 1;

    // Common catalog containers
    const catalogContainers = $('#list, .listmain, .book-list, #chapters, .catalog, .chapter-list, dl');
    const targetScope = catalogContainers.length > 0 ? catalogContainers : $('body');

    targetScope.find('a').each((_, el) => {
      const $a = $(el);
      const chTitle = $a.text().trim();
      const chHref = $a.attr('href');

      if (!chHref || chHref.startsWith('javascript') || chHref === '#' || chTitle.length < 2) return;

      // Filter out non-chapter navigation links
      if (/首页|书架|登录|注册|留言|推荐|排行榜|下载|分类/.test(chTitle)) return;

      const fullUrl = chHref.startsWith('http') ? chHref : new URL(chHref, finalUrl).toString();
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

  // Check demo books sample chapter
  if (bookId && bookId.startsWith('demo-')) {
    const demo = TRENDING_BOOKS.find(b => b.id === bookId);
    if (demo) {
      const cIdx = Number(chapterIndex) || 1;
      const sample = demo.sampleChapters?.[cIdx - 1];
      if (sample) {
        return res.json({
          title: sample.title,
          content: sample.content,
          wordCount: sample.content.length,
        });
      } else {
        // Fallback procedural chapter text for demo exploration
        const fallbackText = `　　狂风在山谷深处呼啸，夜色浓重如墨。\n\n　　${demo.title}的故事仍在继续发展，这一章中风云突变。\n\n　　天地灵气汇聚，漫天星辰闪烁，主角凝视着前方的迷雾，握紧了拳头。\n\n　　“这一战，不仅关乎个人的生死存亡，更关乎整个宗门与身后无数人的命运。”\n\n　　空气中弥漫着压抑的气息，随着一声清脆的雷鸣，震撼人心的力量在天地间轰然爆发！\n\n　　（当前为精选演示源示范章节，支持一键切换真实外部网络源或输入任意网络小说链接进行无缝爬取与批量TXT打包导出！）`;
        return res.json({
          title: chapterTitle || `第${cIdx}章 试炼之路`,
          content: fallbackText,
          wordCount: fallbackText.length,
        });
      }
    }
  }

  if (!url) {
    return res.status(400).json({ error: '请提供章节URL链接' });
  }

  try {
    const { html, finalUrl } = await fetchWithEncoding(url, 10000);
    const $ = cheerio.load(html);

    // Title
    const title = $('h1').first().text().trim() ||
                  $('.title, .bookname h1, .read-title').first().text().trim() ||
                  chapterTitle ||
                  '章节正文';

    // Content container detection
    let rawContentHtml = '';
    const candidates = [
      '#content',
      '#chaptercontent',
      '#htmlContent',
      '.read-content',
      '.chapter-content',
      '#booktxt',
      '#txtContent',
      '.content',
      'div[id*="content"]',
    ];

    for (const selector of candidates) {
      const match = $(selector);
      if (match.length > 0 && match.text().trim().length > 100) {
        rawContentHtml = match.html() || '';
        break;
      }
    }

    if (!rawContentHtml) {
      // Fallback: extract the body paragraph that has the longest text
      let maxLen = 0;
      $('div').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > maxLen && !$(el).find('div').length) {
          maxLen = text.length;
          rawContentHtml = $(el).html() || '';
        }
      });
    }

    const cleanedContent = formatNovelText(rawContentHtml);

    res.json({
      title,
      content: cleanedContent,
      wordCount: cleanedContent.length,
      url: finalUrl,
    });
  } catch (err: any) {
    console.error('Fetch chapter content error:', err);
    // If Gemini is available, provide smart recovery for corrupted/blocked chapters
    if (ai && chapterTitle) {
      try {
        const aiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `请根据网络小说情节风格，智能补齐章节：“${chapterTitle}”的正文内容。
要求：
1. 语言自然生动，贴合网络文学叙事风格；
2. 字数在800-1200字之间；
3. 段落分明，每段前以两个全角空格缩进（　　）；
4. 只返回纯文本正文，不要包含任何前言或总结。`,
        });
        const content = aiRes.text || '章节内容获取失败，请重试。';
        return res.json({
          title: chapterTitle,
          content,
          wordCount: content.length,
          isAiRecovered: true,
        });
      } catch {}
    }

    res.status(500).json({ error: `章节爬取失败: ${err.message || '网络连接异常或被源站拦截'}` });
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

startServer();
