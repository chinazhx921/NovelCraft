import test from 'node:test';
import assert from 'node:assert/strict';
import iconv from 'iconv-lite';
import {
  normalizeCrawlUrl,
  decodeHtmlBuffer,
  formatNovelText,
  extractChapterNumber,
  isCatalogUpgradeLink,
  isLikelyChapterLink,
} from './crawlerHelpers';

test('normalizeCrawlUrl prepends https:// for bare domains and trims whitespace', () => {
  assert.equal(normalizeCrawlUrl('  www.baishuwu.com/info/188122/  '), 'https://www.baishuwu.com/info/188122/');
  assert.equal(normalizeCrawlUrl('//yunshuzhai.com/book/30570/list/'), 'https://yunshuzhai.com/book/30570/list/');
  assert.equal(normalizeCrawlUrl('http://example.com/1.html'), 'http://example.com/1.html');
  assert.equal(normalizeCrawlUrl(''), '');
});

test('decodeHtmlBuffer decodes UTF-8, GBK/GB18030 meta tags, and mislabeled GBK fallback', () => {
  const gbkHtml = '<html><head><meta charset="gbk"><title>斗破苍穹</title></head></html>';
  const gbkBuf = iconv.encode(gbkHtml, 'gbk');
  assert.match(decodeHtmlBuffer(gbkBuf, 'text/html'), /斗破苍穹/);

  const mislabeledGbk = iconv.encode('<html><body>第一章 陨落的天才 斗破苍穹</body></html>', 'gbk');
  assert.match(decodeHtmlBuffer(mislabeledGbk, 'text/html; charset=utf-8'), /斗破苍穹/);
});

test('formatNovelText strips mobile and desktop navigation clutter and indents paragraphs', () => {
  const raw = '上章<br>目录<br>存书签<br>下章<p>第一段正文内容。</p><p>第二段正文内容。</p>本章未完，点击下一页继续阅读';
  const formatted = formatNovelText(raw);
  assert.equal(formatted, '　　第一段正文内容。\n\n　　第二段正文内容。');
});

test('extractChapterNumber parses arabic, chinese numerals, and bare numbers', () => {
  assert.equal(extractChapterNumber('第12章 叶家女人'), 12);
  assert.equal(extractChapterNumber('第二百零一章 重逢'), 201);
  assert.equal(extractChapterNumber('005 初入江湖'), 5);
  assert.equal(extractChapterNumber('Chapter 42'), 42);
});

test('isCatalogUpgradeLink follows explicit TOC links and ignores category/unrelated links', () => {
  assert.equal(
    isCatalogUpgradeLink('查看完整目录', '/book/30570/list/', 'https://yunshuzhai.com/book/30570/'),
    true
  );
  assert.equal(
    isCatalogUpgradeLink('查看全部章节', '/index/4188/', 'https://www.diyizhan.org/book/4188.html'),
    true
  );
  assert.equal(
    isCatalogUpgradeLink('章节目录', '/info/48727_1/', 'https://www.kyankanshu.com/info/48727/'),
    true
  );
  assert.equal(
    isCatalogUpgradeLink('玄幻', '/list/1_1/', 'https://www.diyizhan.org/book/4188.html'),
    false
  );
  assert.equal(
    isCatalogUpgradeLink('查看目录', 'https://other-site.com/book/1/', 'https://www.diyizhan.org/book/4188.html'),
    false
  );
});

test('isLikelyChapterLink accepts kkddkk, kanxiaoshuo, kyankanshu, baishuwu, yunshuzhai and rejects nav/book-info', () => {
  // kkddkk (/section/633980 without .html)
  assert.equal(
    isLikelyChapterLink('https://www.kkddkk.com/section/633980', 'https://www.kkddkk.com/bk/18316/chapters', '第16章 结局 下', true),
    true
  );
  // kanxiaoshuo (/novel/.../chapter/1 without .html)
  assert.equal(
    isLikelyChapterLink('https://www.kanxiaoshuo.org/novel/mushanggonglve/chapter/1', 'https://www.kanxiaoshuo.org/novel/mushanggonglve/chapters', '第一章', true),
    true
  );
  // kyankanshu (/info/48727/655067.html)
  assert.equal(
    isLikelyChapterLink('https://www.kyankanshu.com/info/48727/655067.html', 'https://www.kyankanshu.com/info/48727_1/', '第一章', true),
    true
  );
  // Rejects catalog root & nav
  assert.equal(
    isLikelyChapterLink('https://www.baishuwu.com/info/188122/', 'https://www.baishuwu.com/info/188122/1/', '第1页', true),
    false
  );
  assert.equal(
    isLikelyChapterLink('https://www.baishuwu.com/mybook.html', 'https://www.baishuwu.com/info/188122/', '会员书架', false),
    false
  );
  assert.equal(
    isLikelyChapterLink('https://other.com/read/1.html', 'https://www.baishuwu.com/info/188122/', '第一章', true),
    false
  );
});
