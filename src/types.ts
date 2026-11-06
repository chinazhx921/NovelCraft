export interface Chapter {
  index: number;
  title: string;
  url: string;
  content?: string;
  wordCount?: number;
}

export interface Novel {
  id: string;
  title: string;
  author: string;
  category: string;
  status: string;
  wordCount?: string;
  cover: string;
  intro: string;
  latestChapter?: string;
  sourceName?: string;
  sourceUrl?: string;
  chapters?: Chapter[];
  totalChapters?: number;
  sampleChapters?: { title: string; content: string }[];
  lastReadChapterIndex?: number;
  lastReadChapterTitle?: string;
  addedAt?: number;
}

export interface ReaderSettings {
  theme: 'default' | 'sepia' | 'parchment' | 'green' | 'dark' | 'oled';
  fontSize: number; // in px, e.g. 18
  lineHeight: number; // e.g. 1.8
  fontFamily: 'serif' | 'sans' | 'kaiti';
  maxWidth: 'compact' | 'normal' | 'wide';
}

export interface TxtFormatOptions {
  includeTitleIntro: boolean;
  includeCatalog: boolean;
  indentParagraphs: boolean;
  dividerStyle: 'dashes' | 'stars' | 'equals' | 'simple';
  encoding: 'utf-8' | 'gbk';
}
